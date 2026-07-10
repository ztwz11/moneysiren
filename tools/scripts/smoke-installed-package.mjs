#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const MAX_CAPTURE_BYTES = 16 * 1024;
const COMMAND_TIMEOUT_MS = 120_000;
const HEALTH_ATTEMPTS = 30;
const HEALTH_DELAY_MS = 500;
const SECRET_PATTERN = /(?:sk|sbp|xox[baprs])[-_][A-Za-z0-9_-]+|hooks\.slack\.com\/services\/[^\s]+|acct[_-][A-Za-z0-9_-]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const args = parseArgs(process.argv.slice(2));
const workspace = await mkdtemp(join(tmpdir(), "moneysiren-smoke-"));
let failure = null;

try {
  const prefix = join(workspace, "prefix");
  const home = join(workspace, "home");
  const data = join(workspace, "data");
  const installDir = join(workspace, "runtime");
  const dbPath = join(workspace, "moneysiren.sqlite");
  const prefsPath = join(workspace, "preferences.json");
  await Promise.all([mkdir(prefix), mkdir(home), mkdir(data), mkdir(installDir)]);

  const candidate = await resolveCandidate(args);
  const env = smokeEnvironment({
    data,
    dbPath,
    home,
    installDir,
    prefsPath,
    prefix,
    tag: args.tag,
  });

  run("npm-install", npmCommand(), [
    "install",
    "--global",
    candidate.packageSpec,
    "--prefix",
    prefix,
    "--audit=false",
    "--fund=false",
  ], { env, timeoutMs: 240_000 });

  const cli = resolveCli(prefix);
  run("version", cli.command, [...cli.prefixArgs, "--version"], { env });
  run("install-status-before", cli.command, [...cli.prefixArgs, "install", "--status"], {
    env,
    allowedExitCodes: [0, 1],
  });
  run("doctor-before", cli.command, [...cli.prefixArgs, "doctor"], {
    env,
    allowedExitCodes: [0, 1],
  });

  if (candidate.runtimeArchive !== null) {
    run("install-web-profile", cli.command, [...cli.prefixArgs, "install", "--web", "--profile-only"], { env });
    await stageCandidateRuntime({
      archivePath: candidate.runtimeArchive,
      installDir,
      sourceCommit: args.sourceCommit,
      tag: args.tag,
    });
  } else {
    run("install-web-public", cli.command, [
      ...cli.prefixArgs,
      "install",
      "--web",
      "--tag",
      args.tag,
      "--dir",
      installDir,
    ], { env, timeoutMs: 240_000 });
  }

  run("install-status-ready", cli.command, [...cli.prefixArgs, "install", "--status"], { env });
  run("doctor-ready", cli.command, [...cli.prefixArgs, "doctor"], {
    env,
    allowedExitCodes: [0, 1],
  });
  run("mock-sync", cli.command, [...cli.prefixArgs, "sync", "--provider", "mock"], { env });

  const port = await reserveEphemeralPort();
  run("start", cli.command, [...cli.prefixArgs, "start", "--no-open", "--port", String(port)], {
    env,
    timeoutMs: 60_000,
  });

  try {
    await waitForHealth(port);
  } finally {
    run("stop", cli.command, [...cli.prefixArgs, "stop"], {
      env,
      allowedExitCodes: [0, 1],
      timeoutMs: 60_000,
    });
  }

  console.log("MoneySiren installed-package smoke passed.");
  console.log(`Mode: ${candidate.runtimeArchive === null ? "public-registry" : "candidate-artifact"}`);
  console.log("Provider calls: mock only.");
  console.log("Secrets returned: false.");
} catch (error) {
  failure = error instanceof Error ? error.message : "SMOKE_FAILED";
  console.error(`MoneySiren installed-package smoke failed: ${sanitize(failure)}`);
  process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
}

async function resolveCandidate(options) {
  if (options.packageSpec !== null) {
    return {
      packageSpec: options.packageSpec,
      runtimeArchive: null,
    };
  }

  const entries = await readdir(resolve(options.candidateDir), { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const packageNames = files.filter((name) => /^moneysiren-app-.*\.tgz$/i.test(name));
  const runtimeNames = files.filter((name) => /^moneysiren-web-runtime-v.*\.tar\.gz$/i.test(name));

  if (packageNames.length !== 1 || runtimeNames.length !== 1) {
    throw new Error("SMOKE_CANDIDATE_LAYOUT_INVALID");
  }

  return {
    packageSpec: resolve(options.candidateDir, packageNames[0]),
    runtimeArchive: resolve(options.candidateDir, runtimeNames[0]),
  };
}

async function stageCandidateRuntime(input) {
  const name = basename(input.archivePath);
  const destination = join(input.installDir, name);
  await copyFile(input.archivePath, destination);
  const bytes = await readFile(destination);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const manifest = {
    schemaVersion: 2,
    status: "ready",
    repository: "ztwz11/moneysiren",
    tag: input.tag,
    version: input.tag.slice(1),
    sourceCommit: input.sourceCommit,
    provenance: "manifest",
    releaseUrl: `https://github.com/ztwz11/moneysiren/releases/tag/${input.tag}`,
    installedAt: new Date().toISOString(),
    selectedSurfaces: ["web"],
    assets: [{
      surface: "web",
      name,
      path: destination,
      size: bytes.byteLength,
      sha256,
      checksumVerified: true,
      signatureVerified: false,
      signatureStatus: "not-required",
      platform: "any",
      signingState: "not-required",
    }],
  };
  await writeFile(join(input.installDir, "install-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function run(label, command, commandArgs, options) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    env: options.env,
    maxBuffer: MAX_CAPTURE_BYTES,
    shell: false,
    timeout: options.timeoutMs ?? COMMAND_TIMEOUT_MS,
    windowsHide: true,
  });
  const allowed = options.allowedExitCodes ?? [0];

  if (result.error !== undefined || !allowed.includes(result.status ?? -1)) {
    const detail = sanitize([result.stdout, result.stderr, result.error?.code].filter(Boolean).join("\n"));
    throw new Error(`${label.toUpperCase().replaceAll("-", "_")}_FAILED${detail.length === 0 ? "" : `: ${detail.slice(-1000)}`}`);
  }
}

async function waitForHealth(port) {
  const url = `http://127.0.0.1:${port}/api/local/health`;

  for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Host: `127.0.0.1:${port}` },
        signal: AbortSignal.timeout(2_000),
      });
      const body = await response.json();

      if (
        response.ok &&
        body?.status === "ok" &&
        body?.localOnly === true &&
        body?.secretsReturned === false
      ) {
        return;
      }
    } catch {
      // Bounded retry; no raw network error is printed.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, HEALTH_DELAY_MS));
  }

  throw new Error("LOCAL_HEALTH_TIMEOUT");
}

function reserveEphemeralPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close((error) => {
        if (error !== undefined || port === 0) {
          reject(error ?? new Error("EPHEMERAL_PORT_UNAVAILABLE"));
        } else {
          resolvePort(port);
        }
      });
    });
  });
}

function smokeEnvironment(input) {
  const base = {};
  for (const key of ["PATH", "Path", "PATHEXT", "SystemRoot", "COMSPEC", "TMP", "TEMP", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) {
      base[key] = process.env[key];
    }
  }

  return {
    ...base,
    CI: "true",
    HOME: input.home,
    USERPROFILE: input.home,
    APPDATA: input.data,
    LOCALAPPDATA: input.data,
    XDG_DATA_HOME: input.data,
    MONEYSIREN_DB_PATH: input.dbPath,
    MONEYSIREN_NOTIFICATION_PREFS_PATH: input.prefsPath,
    MONEYSIREN_RELEASE_INSTALL_DIR: input.installDir,
    MONEYSIREN_RELEASE_TAG: input.tag,
    MONEYSIREN_SKIP_STARTUP_INTRO: "true",
    MONEYSIREN_DISABLE_LIVE_PROVIDERS: "true",
    NO_COLOR: "1",
    PATH: [binDirectory(input.prefix), base.PATH ?? base.Path ?? ""].filter(Boolean).join(delimiter),
  };
}

function resolveCli(prefix) {
  if (process.platform === "win32") {
    return {
      command: join(prefix, "msiren.cmd"),
      prefixArgs: [],
    };
  }

  return {
    command: join(prefix, "bin", "msiren"),
    prefixArgs: [],
  };
}

function binDirectory(prefix) {
  return process.platform === "win32" ? prefix : join(prefix, "bin");
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function sanitize(value) {
  return String(value)
    .replace(SECRET_PATTERN, "[redacted]")
    .replace(/[A-Za-z]:\\[^\r\n]+|\/(?:home|Users|tmp)\/[^\r\n]+/g, "[local-path]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 2000);
}

function parseArgs(values) {
  const options = {
    candidateDir: null,
    packageSpec: null,
    sourceCommit: process.env.GITHUB_SHA ?? "",
    tag: process.env.MONEYSIREN_RELEASE_TAG ?? "",
  };

  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    const value = values[index + 1];

    if (["--candidate-dir", "--package", "--source-commit", "--tag"].includes(name) && value !== undefined && !value.startsWith("--")) {
      if (name === "--candidate-dir") options.candidateDir = value;
      if (name === "--package") options.packageSpec = value;
      if (name === "--source-commit") options.sourceCommit = value;
      if (name === "--tag") options.tag = value;
      index += 1;
    } else {
      throw new Error("SMOKE_ARGUMENT_INVALID");
    }
  }

  if ((options.candidateDir === null) === (options.packageSpec === null)) {
    throw new Error("SMOKE_REQUIRES_EXACTLY_ONE_CANDIDATE_SOURCE");
  }

  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(options.tag)) {
    throw new Error("SMOKE_TAG_INVALID");
  }

  if (!/^[a-f0-9]{40}$/.test(options.sourceCommit)) {
    throw new Error("SMOKE_SOURCE_COMMIT_INVALID");
  }

  return options;
}
