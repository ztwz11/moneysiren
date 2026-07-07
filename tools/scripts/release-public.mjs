import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(import.meta.dirname, "../..");
const gitSafeDirectory = repoRoot.replaceAll("\\", "/");
const expectedWorkflows = ["ci", "secret-scan", "npm-publish-cli", "desktop-release"];

if (args.help) {
  printHelp();
  process.exit(0);
}

const packageJsonPath = resolve(repoRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const currentVersion = packageJson.version;
const requestedVersion = args.version ?? currentVersion;
const targetVersion = args.version === null && args.autoPatch
  ? resolveAutoPatchVersion(requestedVersion)
  : requestedVersion;
const releaseTag = `v${targetVersion}`;
const releaseMessage = args.message ?? `Release ${releaseTag}`;
const branch = capture("git", ["branch", "--show-current"]).trim();
const repository = args.repo ?? parseGitHubRepository(capture("git", ["remote", "get-url", "origin"]).trim());
const statusBefore = capture("git", ["status", "--porcelain"]).trim();
const hasWorkingTreeChanges = statusBefore.length > 0;
const autoPatched = targetVersion !== requestedVersion;

if (!isPublicReleaseVersion(requestedVersion)) {
  fail(`Expected a public release version such as 0.1.0, received: ${requestedVersion}`);
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
    "Public release dry run plan",
    `- current package version: ${currentVersion}`,
    `- requested version: ${requestedVersion}`,
    `- target version: ${targetVersion}`,
    `- auto patch bump: ${autoPatched ? "yes" : "no"}`,
    `- release tag: ${releaseTag}`,
    `- branch: ${branch}`,
    `- repository: ${repository ?? "unknown"}`,
    `- working tree: ${hasWorkingTreeChanges ? "has changes" : "clean"}`,
    `- include working tree: ${args.includeWorkingTree ? "yes" : "no"}`,
    `- push main and tag: ${args.skipPush ? "no" : "yes"}`,
    "",
    "No files were changed, no tag was created, no push was run, and no npm publish was run because --dry-run was used.",
  ].join("\n"));
  process.exit(0);
}

if (hasWorkingTreeChanges && !args.includeWorkingTree) {
  fail([
    "Working tree is not clean.",
    "Commit or stash your changes first, or rerun with --include-working-tree to include current changes in the release commit.",
  ].join("\n"));
}

console.log(`Preparing MoneySiren public release ${targetVersion}.`);

if (targetVersion !== currentVersion) {
  replaceVersionInTrackedFiles(currentVersion, targetVersion);
}

assertPackageManifestVersions(targetVersion);
run("git", ["diff", "--check"]);

if (!args.skipValidation) {
  run("npm", ["run", "secret:scan"]);
  run("npm", ["run", "secret:scan:all"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "test"], {
    env: {
      ...process.env,
      CI: "true",
    },
  });
  run("npm", ["run", "build"]);
  run("npm", ["run", "tray:native:check"]);
  run("npm", ["run", "publish:cli:dry-run"]);
  run("npm", ["run", "publish:app:dry-run"]);
}

if (targetVersion !== currentVersion || args.includeWorkingTree) {
  run("git", ["add", "--all"]);
  const staged = capture("git", ["diff", "--cached", "--name-only"]).trim();

  if (staged.length > 0) {
    run("git", ["commit", "-m", releaseMessage]);
  } else if (targetVersion !== currentVersion) {
    fail(`No release changes were staged after replacing ${currentVersion} with ${targetVersion}.`);
  } else {
    console.log("No release commit was needed; working tree changes were already staged or absent.");
  }
}

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
  run("npm", ["view", `@moneysiren/cli@${targetVersion}`, "version", "dist-tags", "--json"]);
  run("npm", ["view", `@moneysiren/app@${targetVersion}`, "version", "dist-tags", "--json"]);
  run("node", ["tools/scripts/check-release-readiness.mjs", releaseTag]);
}

console.log(`MoneySiren ${targetVersion} public release complete.`);

function parseArgs(rawArgs) {
  const options = {
    autoPatch: !envFlag("no_auto_patch"),
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
    } else if (arg === "--no-auto-patch") {
      options.autoPatch = false;
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

function isPublicReleaseVersion(value) {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function resolveAutoPatchVersion(version) {
  let candidate = version;

  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const tag = `v${candidate}`;

    if (!releaseTagExists(tag)) {
      if (candidate !== version) {
        console.log(`Auto-selected next public release version ${candidate}; ${version} is already tagged.`);
      }

      return candidate;
    }

    candidate = incrementPatchVersion(candidate);
  }

  fail(`Could not find an unused patch version after ${version}.`);
}

function releaseTagExists(tag) {
  return tagExistsLocally(tag) || (!args.skipRemoteChecks && tagExistsRemotely(tag));
}

function incrementPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (match === null) {
    fail(`Expected a public release version such as 0.1.0, received: ${version}`);
  }

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);

  return `${major}.${minor}.${patch + 1}`;
}

function assertPackageManifestVersions(version) {
  const manifests = capture("git", ["ls-files", "package.json", "apps/**/package.json", "packages/**/package.json"])
    .split(/\r?\n/)
    .filter((file) => file.length > 0);

  for (const file of manifests) {
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, file), "utf8"));

    if (manifest.version !== version) {
      fail(`${file} has version ${manifest.version}; expected ${version}.`);
    }
  }
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
      "User-Agent": "moneysiren-release-public",
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
  npm run release:public:dry-run
  npm run release:public
  npm run release:public -- --version 0.1.1
  npm run release:public -- --no-auto-patch
  npm run release:public:include-working-tree

What it does:
  1. Requires a non-prerelease semver such as 0.1.0.
  2. Defaults to package.json version, then auto-selects the next patch version when the matching v* tag already exists.
  3. Verifies package manifest versions match the target release.
  4. Runs diff check, secret scans, typecheck, tests, build, tray native check, and npm publish dry-runs.
  5. Commits included release changes when needed, creates the annotated v* tag, pushes main, and pushes the tag.
  6. Waits for GitHub Actions and verifies npm packages plus GitHub Release assets.

Safety:
  The working tree must be clean by default. Use --include-working-tree only when
  you intentionally want current local changes included in the release commit.
  Pass --version for an explicit release, or --no-auto-patch to fail instead of
  selecting the next patch version when the current tag already exists.
  This script never runs npm publish locally; tag-push workflows own publishing.
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
