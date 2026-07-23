#!/usr/bin/env node

import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  validateUnsignedPreviewMetadata,
  validateUnsignedPreviewRelease,
} from "./lib/unsigned-preview.mjs";

const MAX_CAPTURE_BYTES = 16 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_PREVIEW_METADATA_BYTES = 64 * 1024;
const COMMAND_TIMEOUT_MS = 120_000;
const SECRET_PATTERN = /(?:sk|sbp|xox[baprs])[-_][A-Za-z0-9_-]+|hooks\.slack\.com\/services\/[^\s]+|acct[_-][A-Za-z0-9_-]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const args = parseArgs(process.argv.slice(2));
const workspace = await mkdtemp(join(tmpdir(), "moneysiren-installed-smoke-"));

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
    allowUnsignedPreview: args.allowUnsignedPreview,
    candidateMode: candidate.webArchive !== null,
    data,
    dbPath,
    home,
    installDir,
    prefsPath,
    prefix,
    tag: args.tag,
  });
  const npm = resolveNpmInvocation();

  run("npm-install", npm.command, [
    ...npm.prefixArgs,
    "install",
    "--global",
    candidate.packageSpec,
    "--prefix",
    prefix,
    "--audit=false",
    "--fund=false",
  ], { env, timeoutMs: 300_000 });

  const cli = resolveCli(prefix);
  const version = run("version", cli.command, [...cli.prefixArgs, "--version"], { env });
  if (version.stdout.trim() !== args.tag.slice(1)) {
    throw new Error("VERSION_MISMATCH");
  }

  if (candidate.webArchive !== null && candidate.hudExecutable !== null) {
    run("candidate-profile", cli.command, [...cli.prefixArgs, "install", "--all", "--profile-only"], { env });
    await stageCandidateRuntime({
      hudExecutable: candidate.hudExecutable,
      installDir,
      sourceCommit: args.sourceCommit,
      tag: args.tag,
      webArchive: candidate.webArchive,
    });
  }

  await verifyInstalledRuntime({
    allowUnsignedPreview: args.allowUnsignedPreview,
    candidateMode: candidate.webArchive !== null,
    installDir,
    sourceCommit: args.sourceCommit,
    tag: args.tag,
  });
  if (args.allowUnsignedPreview) {
    await verifyUnsignedPreviewReleaseMetadata({
      platform: process.platform,
      sourceCommit: args.sourceCommit,
      tag: args.tag,
    });
  }
  run("install-status", cli.command, [...cli.prefixArgs, "install", "--status"], { env });
  run("doctor", cli.command, [...cli.prefixArgs, "doctor"], { env, allowedExitCodes: [0, 1] });
  run("mock-sync", cli.command, [...cli.prefixArgs, "sync", "--provider", "mock"], { env });

  const port = await reserveEphemeralPort();
  try {
    run("hud", cli.command, [...cli.prefixArgs, "hud", "--port", String(port)], {
      env,
      timeoutMs: 60_000,
    });
    await waitForHealth(port);
    await delay(750);
    const status = run("runtime-status", cli.command, [...cli.prefixArgs, "status"], { env });
    if (!/^Web runtime: running$/m.test(status.stdout) || !/^HUD: running$/m.test(status.stdout)) {
      throw new Error("HUD_RUNTIME_STATE_INVALID");
    }
  } finally {
    run("stop", cli.command, [...cli.prefixArgs, "stop", "--web", "--hud"], {
      env,
      allowedExitCodes: [0, 1],
      timeoutMs: 60_000,
    });
  }

  console.log("MoneySiren installed-package HUD smoke passed.");
  console.log(`Mode: ${candidate.webArchive === null ? "public-release" : "candidate-artifacts"}.`);
  console.log(`Unsigned desktop preview: ${args.allowUnsignedPreview ? "explicitly accepted" : "not accepted"}.`);
  console.log("Provider calls: mock only.");
  console.log("Secrets returned: false.");
} catch (error) {
  const message = error instanceof Error ? error.message : "SMOKE_FAILED";
  console.error(`MoneySiren installed-package HUD smoke failed: ${sanitize(message)}`);
  process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
}

async function resolveCandidate(options) {
  if (options.packageSpec !== null) {
    return {
      hudExecutable: null,
      packageSpec: options.packageSpec,
      webArchive: null,
    };
  }

  const entries = await readdir(resolve(options.candidateDir), { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const packageNames = files.filter((name) => /^moneysiren-app-.*\.tgz$/i.test(name));
  const webNames = files.filter((name) => /^moneysiren-web-runtime-v.*\.tar\.gz$/i.test(name));
  const hudPattern = process.platform === "darwin"
    ? /^MoneySiren\.Tray-macos-.*\.tar\.gz$/i
    : /^MoneySiren\.Tray_.*_x64-portable\.exe$/i;
  const hudNames = files.filter((name) => hudPattern.test(name));

  if (packageNames.length !== 1 || webNames.length !== 1 || hudNames.length !== 1) {
    throw new Error("SMOKE_CANDIDATE_LAYOUT_INVALID");
  }

  return {
    hudExecutable: resolve(options.candidateDir, hudNames[0]),
    packageSpec: resolve(options.candidateDir, packageNames[0]),
    webArchive: resolve(options.candidateDir, webNames[0]),
  };
}

async function stageCandidateRuntime(input) {
  const web = await copyAsset(input.webArchive, input.installDir);
  const hud = await copyAsset(input.hudExecutable, input.installDir);
  const manifest = {
    version: 1,
    repository: "ztwz11/moneysiren",
    tag: input.tag,
    sourceCommit: input.sourceCommit,
    releaseUrl: `https://github.com/ztwz11/moneysiren/releases/tag/${input.tag}`,
    installedAt: new Date().toISOString(),
    selectedSurfaces: ["cli", "web", "hud"],
    assets: [
      {
        surface: "web",
        ...web,
        checksumVerified: true,
        signatureVerified: false,
        signatureStatus: "not-required",
      },
      {
        surface: "hud",
        ...hud,
        checksumVerified: true,
        signatureVerified: false,
        signatureStatus: "unsigned-candidate-smoke",
      },
    ],
  };
  await writeFile(join(input.installDir, "install-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function copyAsset(source, installDir) {
  const name = source.split(/[\\/]/).at(-1);
  if (name === undefined) {
    throw new Error("SMOKE_ASSET_NAME_INVALID");
  }
  const path = join(installDir, name);
  await copyFile(source, path);
  const bytes = await readFile(path);
  return {
    name,
    path,
    size: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function verifyInstalledRuntime(input) {
  let manifest;
  try {
    const path = join(input.installDir, "install-manifest.json");
    const metadata = statSync(path);
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_MANIFEST_BYTES) {
      throw new Error("invalid manifest file");
    }
    manifest = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error("INSTALL_MANIFEST_INVALID");
  }

  if (
    manifest?.repository !== "ztwz11/moneysiren" ||
    manifest?.tag !== input.tag ||
    !Array.isArray(manifest.assets) ||
    (input.candidateMode && manifest?.sourceCommit !== input.sourceCommit)
  ) {
    throw new Error("INSTALL_MANIFEST_INVALID");
  }

  const web = manifest.assets.find((asset) => validAsset(asset, "web"));
  const hud = manifest.assets.find((asset) => validAsset(asset, "hud"));
  if (web === undefined || hud === undefined) {
    throw new Error("INSTALL_MANIFEST_SURFACES_INVALID");
  }
  if (!input.candidateMode && hud.signatureVerified !== true) {
    const explicitUnsignedPreview = input.allowUnsignedPreview === true &&
      hud.signatureStatus === "unsigned-opt-in-accepted";

    if (!explicitUnsignedPreview) {
      throw new Error("PUBLIC_HUD_SIGNATURE_NOT_VERIFIED");
    }
  }
}

function validAsset(asset, surface) {
  if (
    asset?.surface !== surface ||
    typeof asset?.name !== "string" ||
    typeof asset?.path !== "string" ||
    typeof asset?.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(asset.sha256) ||
    asset?.checksumVerified !== true
  ) {
    return false;
  }
  try {
    return statSync(asset.path).isFile();
  } catch {
    return false;
  }
}

async function verifyUnsignedPreviewReleaseMetadata(input) {
  const githubHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "moneysiren-installed-preview-smoke",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
  const releaseResponse = await fetch(
    `https://api.github.com/repos/ztwz11/moneysiren/releases/tags/${encodeURIComponent(input.tag)}`,
    {
      headers: githubHeaders,
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!releaseResponse.ok) {
    throw new Error("UNSIGNED_PREVIEW_RELEASE_METADATA_UNAVAILABLE");
  }

  const release = await releaseResponse.json();
  if (release?.tag_name !== input.tag || release?.prerelease !== true || !Array.isArray(release?.assets)) {
    throw new Error("UNSIGNED_PREVIEW_RELEASE_IDENTITY_INVALID");
  }

  const metadataUrl = validateUnsignedPreviewRelease(release, input);

  const metadataResponse = await fetch(metadataUrl, {
    headers: githubHeaders,
    signal: AbortSignal.timeout(30_000),
  });
  if (!metadataResponse.ok) {
    throw new Error("UNSIGNED_PREVIEW_METADATA_DOWNLOAD_FAILED");
  }

  const metadataBytes = Buffer.from(await metadataResponse.arrayBuffer());
  if (metadataBytes.byteLength === 0 || metadataBytes.byteLength > MAX_PREVIEW_METADATA_BYTES) {
    throw new Error("UNSIGNED_PREVIEW_METADATA_SIZE_INVALID");
  }

  validateUnsignedPreviewMetadata(JSON.parse(metadataBytes.toString("utf8")), input);
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
  return result;
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/local/health`, {
        headers: { Host: `127.0.0.1:${port}` },
        signal: AbortSignal.timeout(2_000),
      });
      const body = await response.json();
      if (response.ok && body?.status === "ok" && body?.localOnly === true && body?.secretsReturned === false) {
        return;
      }
    } catch {
      // Bounded retry. Raw network failures are never printed.
    }
    await delay(500);
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
      server.close((error) => error !== undefined || port === 0
        ? reject(error ?? new Error("EPHEMERAL_PORT_UNAVAILABLE"))
        : resolvePort(port));
    });
  });
}

function smokeEnvironment(input) {
  const base = {};
  for (const key of [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "COMSPEC",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "GITHUB_TOKEN",
    "GH_TOKEN",
  ]) {
    if (process.env[key] !== undefined) base[key] = process.env[key];
  }
  return {
    ...base,
    APPDATA: input.data,
    CI: "true",
    HOME: input.home,
    LOCALAPPDATA: input.data,
    MONEYSIREN_APP_STRICT_POSTINSTALL: "true",
    MONEYSIREN_ALLOW_UNSIGNED_HUD: input.allowUnsignedPreview ? "true" : "false",
    MONEYSIREN_DB_PATH: input.dbPath,
    MONEYSIREN_DISABLE_LIVE_PROVIDERS: "true",
    MONEYSIREN_NOTIFICATION_PREFS_PATH: input.prefsPath,
    MONEYSIREN_RELEASE_INSTALL_DIR: input.installDir,
    MONEYSIREN_RELEASE_TAG: input.tag,
    MONEYSIREN_SKIP_RELEASE_ASSET_INSTALL: input.candidateMode ? "true" : "false",
    MONEYSIREN_SKIP_STARTUP_INTRO: "true",
    NO_COLOR: "1",
    PATH: [binDirectory(input.prefix), base.PATH ?? base.Path ?? ""].filter(Boolean).join(delimiter),
    USERPROFILE: input.home,
    XDG_DATA_HOME: input.data,
  };
}

function resolveCli(prefix) {
  const packageRoot = process.platform === "win32"
    ? join(prefix, "node_modules", "@moneysiren", "app")
    : join(prefix, "lib", "node_modules", "@moneysiren", "app");
  const entry = join(packageRoot, "dist", "apps", "cli", "src", "index.js");
  const shim = process.platform === "win32" ? join(prefix, "msiren.cmd") : join(prefix, "bin", "msiren");
  try {
    if (!statSync(entry).isFile() || !statSync(shim).isFile()) throw new Error("invalid");
  } catch {
    throw new Error("CLI_INSTALL_LAYOUT_INVALID");
  }
  return { command: process.execPath, prefixArgs: [entry] };
}

function resolveNpmInvocation() {
  const nodeDir = dirname(process.execPath);
  const candidates = [
    join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    resolve(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    resolve(nodeDir, "..", "node_modules", "npm", "bin", "npm-cli.js"),
    resolve(nodeDir, "..", "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    "/usr/local/lib/node_modules/npm/bin/npm-cli.js",
    "/usr/lib/node_modules/npm/bin/npm-cli.js",
    "/usr/share/nodejs/npm/bin/npm-cli.js",
  ];
  const npmCli = candidates.find((candidate) => {
    try { return statSync(candidate).isFile(); } catch { return false; }
  });
  if (npmCli === undefined) throw new Error("NPM_CLI_UNAVAILABLE");
  return { command: process.execPath, prefixArgs: [npmCli] };
}

function binDirectory(prefix) {
  return process.platform === "win32" ? prefix : join(prefix, "bin");
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
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
    allowUnsignedPreview: false,
    candidateDir: null,
    packageSpec: null,
    sourceCommit: process.env.GITHUB_SHA ?? "",
    tag: process.env.MONEYSIREN_RELEASE_TAG ?? "",
  };
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    const value = values[index + 1];
    if (name === "--allow-unsigned-preview") {
      options.allowUnsignedPreview = true;
    } else if (["--candidate-dir", "--package", "--source-commit", "--tag"].includes(name) && value !== undefined && !value.startsWith("--")) {
      if (name === "--candidate-dir") options.candidateDir = value;
      if (name === "--package") options.packageSpec = value;
      if (name === "--source-commit") options.sourceCommit = value;
      if (name === "--tag") options.tag = value;
      index += 1;
    } else {
      throw new Error("SMOKE_ARGUMENT_INVALID");
    }
  }
  if ((options.candidateDir === null) === (options.packageSpec === null)) throw new Error("SMOKE_REQUIRES_ONE_SOURCE");
  if (options.allowUnsignedPreview && options.packageSpec === null) throw new Error("UNSIGNED_PREVIEW_REQUIRES_PUBLIC_PACKAGE");
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(options.tag)) throw new Error("SMOKE_TAG_INVALID");
  if (!/^[a-f0-9]{40}$/.test(options.sourceCommit)) throw new Error("SMOKE_SOURCE_COMMIT_INVALID");
  return options;
}
