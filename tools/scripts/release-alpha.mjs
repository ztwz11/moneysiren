import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(import.meta.dirname, "../..");
const gitSafeDirectory = repoRoot.replaceAll("\\", "/");

if (args.help) {
  printHelp();
  process.exit(0);
}

const packageJsonPath = resolve(repoRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const currentVersion = packageJson.version;
const nextVersion = args.version ?? nextAlphaVersion(currentVersion);
const releaseTag = `v${nextVersion}`;
const releaseMessage = args.message ?? `Release ${nextVersion}`;
const branch = capture("git", ["branch", "--show-current"]).trim();
const repository = args.repo ?? parseGitHubRepository(capture("git", ["remote", "get-url", "origin"]).trim());
const expectedWorkflows = ["ci", "secret-scan", "npm-publish-cli", "desktop-release"];

if (!isAlphaVersion(nextVersion)) {
  fail(`Expected an alpha version such as 0.1.0-alpha.33, received: ${nextVersion}`);
}

if (branch !== args.branch) {
  fail(`Refusing to release from branch "${branch}". Expected "${args.branch}". Use --branch to override.`);
}

if (tagExistsLocally(releaseTag)) {
  fail(`Local tag already exists: ${releaseTag}`);
}

if (!args.skipRemoteChecks && tagExistsRemotely(releaseTag)) {
  fail(`Remote tag already exists on origin: ${releaseTag}`);
}

if (args.dryRun) {
  console.log([
    `Release dry run plan`,
    `- current version: ${currentVersion}`,
    `- next version: ${nextVersion}`,
    `- branch: ${branch}`,
    `- repository: ${repository}`,
    `- commit message: ${releaseMessage}`,
    "",
    "No files were changed because --dry-run was used.",
  ].join("\n"));
  process.exit(0);
}

if (!args.includeWorkingTree) {
  const status = capture("git", ["status", "--porcelain"]);

  if (status.trim().length > 0) {
    fail([
      "Working tree is not clean.",
      "Commit or stash your changes first, or rerun with --include-working-tree to include current changes in the release commit.",
    ].join("\n"));
  }
}

console.log(`Preparing MoneySiren ${nextVersion} from ${currentVersion}.`);
replaceVersionInTrackedFiles(currentVersion, nextVersion);

run("git", ["diff", "--check"]);

if (!args.skipValidation) {
  run("npm", ["run", "secret:scan"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "test"], {
    env: {
      ...process.env,
      CI: "true",
    },
  });
  run("npm", ["run", "build"]);
  run("npm", ["run", "publish:cli:dry-run"]);
  run("npm", ["run", "publish:app:dry-run"]);
}

run("git", ["add", "--all"]);

const staged = capture("git", ["diff", "--cached", "--name-only"]).trim();
if (staged.length === 0) {
  fail("No release changes were staged.");
}

run("git", ["commit", "-m", releaseMessage]);
const releaseSha = capture("git", ["rev-parse", "HEAD"]).trim();
run("git", ["tag", "-a", releaseTag, "-m", releaseTag]);

if (!args.skipPush) {
  run("git", ["push", "origin", branch]);
  run("git", ["push", "origin", releaseTag]);
}

if (!args.skipPoll && !args.skipPush) {
  await waitForGitHubActions({
    repository,
    releaseSha,
    timeoutMs: args.pollTimeoutMinutes * 60_000,
  });
}

if (!args.skipPublishVerify && !args.skipPush) {
  run("npm", ["view", `@moneysiren/cli@${nextVersion}`, "version", "dist-tags", "--json"]);
  run("npm", ["view", `@moneysiren/app@${nextVersion}`, "version", "dist-tags", "--json"]);

  const releaseCheckArgs = ["tools/scripts/check-release-readiness.mjs", releaseTag];
  if (args.allowUnsignedPrereleaseWindows) {
    releaseCheckArgs.push("--allow-unsigned-prerelease-windows");
  }
  run("node", releaseCheckArgs);
}

console.log(`MoneySiren ${nextVersion} release complete.`);

function parseArgs(rawArgs) {
  const options = {
    allowUnsignedPrereleaseWindows: !envFlag("require_signed_windows"),
    branch: envValue("branch") ?? "main",
    dryRun: envFlag("dry_run"),
    help: false,
    includeWorkingTree: envFlag("include_working_tree"),
    message: envValue("message"),
    pollTimeoutMinutes: parsePositiveInteger(envValue("poll_timeout_minutes") ?? "45", "--poll-timeout-minutes"),
    repo: envValue("repo"),
    skipPoll: envFlag("skip_poll"),
    skipPublishVerify: envFlag("skip_publish_verify"),
    skipPush: envFlag("skip_push"),
    skipRemoteChecks: envFlag("skip_remote_checks"),
    skipValidation: envFlag("skip_validation"),
    version: envValue("target_version") ?? process.env.MONEYSIREN_RELEASE_VERSION ?? null,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--include-working-tree") {
      options.includeWorkingTree = true;
    } else if (arg === "--skip-validation") {
      options.skipValidation = true;
    } else if (arg === "--skip-push") {
      options.skipPush = true;
    } else if (arg === "--skip-poll") {
      options.skipPoll = true;
    } else if (arg === "--skip-publish-verify") {
      options.skipPublishVerify = true;
    } else if (arg === "--skip-remote-checks") {
      options.skipRemoteChecks = true;
    } else if (arg === "--require-signed-windows") {
      options.allowUnsignedPrereleaseWindows = false;
    } else if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length);
    } else if (arg === "--version") {
      options.version = readValue(rawArgs, ++index, "--version");
    } else if (arg.startsWith("--target-version=")) {
      options.version = arg.slice("--target-version=".length);
    } else if (arg === "--target-version") {
      options.version = readValue(rawArgs, ++index, "--target-version");
    } else if (arg.startsWith("--message=")) {
      options.message = arg.slice("--message=".length);
    } else if (arg === "--message") {
      options.message = readValue(rawArgs, ++index, "--message");
    } else if (arg.startsWith("--branch=")) {
      options.branch = arg.slice("--branch=".length);
    } else if (arg === "--branch") {
      options.branch = readValue(rawArgs, ++index, "--branch");
    } else if (arg.startsWith("--repo=")) {
      options.repo = arg.slice("--repo=".length);
    } else if (arg === "--repo") {
      options.repo = readValue(rawArgs, ++index, "--repo");
    } else if (arg.startsWith("--poll-timeout-minutes=")) {
      options.pollTimeoutMinutes = parsePositiveInteger(arg.slice("--poll-timeout-minutes=".length), "--poll-timeout-minutes");
    } else if (arg === "--poll-timeout-minutes") {
      options.pollTimeoutMinutes = parsePositiveInteger(readValue(rawArgs, ++index, "--poll-timeout-minutes"), "--poll-timeout-minutes");
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readValue(rawArgs, index, name) {
  const value = rawArgs[index];

  if (value === undefined || value.startsWith("--")) {
    fail(`${name} requires a value.`);
  }

  return value;
}

function envFlag(name) {
  const value = process.env[`npm_config_${name}`] ?? process.env[`MONEYSIREN_RELEASE_${name.toUpperCase()}`];

  return value === "1" || value === "true" || value === "yes";
}

function envValue(name) {
  const value = process.env[`npm_config_${name}`] ?? process.env[`MONEYSIREN_RELEASE_${name.toUpperCase()}`];

  return value === undefined || value.trim().length === 0 ? null : value;
}

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${name} must be a positive integer.`);
  }

  return parsed;
}

function nextAlphaVersion(value) {
  const match = /^(\d+\.\d+\.\d+)-alpha\.(\d+)$/.exec(value);

  if (match === null) {
    fail(`Cannot compute next alpha version from ${value}. Use --version.`);
  }

  return `${match[1]}-alpha.${Number.parseInt(match[2], 10) + 1}`;
}

function isAlphaVersion(value) {
  return /^\d+\.\d+\.\d+-alpha\.\d+$/.test(value);
}

function replaceVersionInTrackedFiles(fromVersion, toVersion) {
  const files = capture("git", ["ls-files"])
    .split(/\r?\n/)
    .filter((file) => file.length > 0)
    .filter(isReleaseTextFile);
  let changedCount = 0;

  for (const file of files) {
    const path = resolve(repoRoot, file);
    const text = readFileSync(path, "utf8");

    if (!text.includes(fromVersion)) {
      continue;
    }

    writeFileSync(path, text.split(fromVersion).join(toVersion));
    changedCount += 1;
  }

  if (changedCount === 0) {
    fail(`No tracked release files contained ${fromVersion}.`);
  }

  console.log(`Updated ${changedCount} tracked release file(s).`);
}

function isReleaseTextFile(file) {
  const extension = extname(file).toLowerCase();
  const name = basename(file);

  return [
    ".json",
    ".md",
    ".mjs",
    ".js",
    ".ts",
    ".tsx",
    ".toml",
    ".yml",
    ".yaml",
  ].includes(extension) || name === "Cargo.lock";
}

function tagExistsLocally(tag) {
  const result = spawnSync("git", gitArgs(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]), {
    cwd: repoRoot,
    stdio: "ignore",
  });

  return result.status === 0;
}

function tagExistsRemotely(tag) {
  const stdout = capture("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`], {
    allowFailure: true,
  });

  return stdout.trim().length > 0;
}

async function waitForGitHubActions({ repository, releaseSha, timeoutMs }) {
  if (repository === null) {
    console.warn("Could not infer GitHub repository from origin remote; skipping Actions polling.");
    return;
  }

  const startedAt = Date.now();
  const pollIntervalMs = 30_000;

  while (Date.now() - startedAt < timeoutMs) {
    const runs = await fetchWorkflowRuns(repository, releaseSha);
    const relevant = expectedWorkflows
      .map((name) => runs.find((run) => run.name === name))
      .filter((run) => run !== undefined);

    printRunSummary(relevant);

    if (relevant.length >= expectedWorkflows.length && relevant.every((run) => run.status === "completed")) {
      const failed = relevant.filter((run) => run.conclusion !== "success");

      if (failed.length > 0) {
        fail(`GitHub Actions failed: ${failed.map((run) => `${run.name}=${run.conclusion}`).join(", ")}`);
      }

      return;
    }

    await sleep(pollIntervalMs);
  }

  fail(`Timed out waiting for GitHub Actions after ${timeoutMs / 60_000} minute(s).`);
}

async function fetchWorkflowRuns(repository, releaseSha) {
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs?per_page=50`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "moneysiren-release-alpha",
      ...(process.env.GITHUB_TOKEN === undefined ? {} : { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
    },
  });

  if (!response.ok) {
    fail(`Could not fetch GitHub Actions runs: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const workflowRuns = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];

  return workflowRuns
    .filter((run) => run.head_sha === releaseSha)
    .filter((run) => expectedWorkflows.includes(run.name))
    .map((run) => ({
      conclusion: run.conclusion ?? "",
      htmlUrl: run.html_url,
      name: run.name,
      status: run.status,
    }));
}

function printRunSummary(runs) {
  const summary = runs
    .map((run) => `${run.name}:${run.status}${run.conclusion === "" ? "" : `/${run.conclusion}`}`)
    .join(" | ");

  console.log(summary.length === 0 ? "Waiting for GitHub Actions runs..." : summary);
}

function parseGitHubRepository(remoteUrl) {
  const httpsMatch = /^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/.exec(remoteUrl);
  if (httpsMatch !== null) {
    return httpsMatch[1];
  }

  const sshMatch = /^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/.exec(remoteUrl);
  if (sshMatch !== null) {
    return sshMatch[1];
  }

  return null;
}

function run(command, commandArgs, options = {}) {
  const finalArgs = command === "git" ? gitArgs(commandArgs) : commandArgs;
  console.log(`$ ${[command, ...finalArgs].join(" ")}`);
  const result = spawnSync(command, finalArgs, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
    ...(command === "npm" && process.platform === "win32" ? { shell: true } : {}),
  });

  if (result.status !== 0) {
    fail(`${command} ${commandArgs.join(" ")} failed.`);
  }
}

function capture(command, commandArgs, options = {}) {
  const finalArgs = command === "git" ? gitArgs(commandArgs) : commandArgs;
  const result = spawnSync(command, finalArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    ...(command === "npm" && process.platform === "win32" ? { shell: true } : {}),
  });

  if (result.status !== 0 && options.allowFailure !== true) {
    fail([
      `${command} ${finalArgs.join(" ")} failed.`,
      result.stdout,
      result.stderr,
      result.error?.message,
    ].filter(Boolean).join("\n"));
  }

  return result.stdout ?? "";
}

function gitArgs(commandArgs) {
  return ["-c", `safe.directory=${gitSafeDirectory}`, ...commandArgs];
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function printHelp() {
  console.log(`
Usage:
  npm run release:alpha
  npm run release:alpha -- --version 0.1.0-alpha.33
  npm run release:alpha -- --include-working-tree

What it does:
  1. Bumps all tracked release version references to the next alpha version.
  2. Runs diff check, secret scan, typecheck, tests, build, and npm publish dry-runs.
  3. Commits the release bump, tags it, pushes main, and pushes the release tag.
  4. Waits for GitHub Actions deployment workflows.
  5. Verifies npm packages and GitHub Release assets.

Safety:
  The working tree must be clean by default. Use --include-working-tree only when
  you intentionally want current local changes included in the release commit.
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
