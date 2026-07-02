import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const cliRoot = resolve(repoRoot, "apps", "cli");
const packageJsonPath = resolve(cliRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const shouldPublish = process.argv.includes("--publish");
const publishOtp = getCliValue("--otp");
const npmTag = "latest";
const npmBin = "npm";
const npmSpawnOptions = process.platform === "win32" ? { shell: true } : {};
const npmCache = resolve(repoRoot, ".tmp", "npm-cache");

mkdirSync(npmCache, {
  recursive: true,
});

run("node", ["tools/scripts/secret-scan.mjs", "--history"], {
  cwd: repoRoot,
});

if (shouldPublish) {
  run(npmBin, withNpmCache(["whoami"]), {
    cwd: repoRoot,
    failureMessage: [
      "npm is not logged in.",
      "Run `npm login` in your terminal, then retry this command.",
      "Do not paste npm tokens into repository files or chat.",
    ].join("\n"),
  });
}

if (packageJson.private !== false) {
  fail(`${packageJson.name} must have "private": false before publishing.`);
}

if (packageJson.publishConfig?.access !== "public") {
  fail(`${packageJson.name} must publish with public access.`);
}

if (/-(?:alpha|beta|rc)(?:[.\d-]*)?$/i.test(packageJson.version)) {
  fail(`Refusing to publish ${packageJson.name}@${packageJson.version} to latest; expected a public release version.`);
}

const existingVersion = spawnSync(npmBin, withNpmCache(["view", `${packageJson.name}@${packageJson.version}`, "version"]), {
  cwd: repoRoot,
  encoding: "utf8",
  ...npmSpawnOptions,
});

if (existingVersion.status === 0) {
  fail(`${packageJson.name}@${packageJson.version} already exists on npm. Bump the version before publishing.`);
}

if (!isNpmNotFound(existingVersion)) {
  fail(getSpawnOutput(existingVersion) || `Could not check npm registry for ${packageJson.name}@${packageJson.version}.`);
}

run(npmBin, getPublishArgs({ dryRun: true }), {
  cwd: cliRoot,
});

if (!shouldPublish) {
  console.log([
    "",
    `Dry run passed for ${packageJson.name}@${packageJson.version}.`,
    `Run \`npm run publish:cli:latest\` to publish with tag "${npmTag}".`,
  ].join("\n"));
  process.exit(0);
}

run(npmBin, getPublishArgs({ dryRun: false }), {
  cwd: cliRoot,
  failureMessage: [
    "npm publish failed.",
    "Publishing requires npm account 2FA approval, npm web/passkey authentication, or a granular access token with bypass 2FA enabled.",
    "If npm printed an authentication URL, open it in the browser, complete the approval, and rerun this command.",
    "If your account has an authenticator OTP, retry with `npm run publish:cli:latest -- --otp=123456` using the current code.",
    "For CI, create a granular npm token with publish access and bypass 2FA enabled, then store it only as `NPM_TOKEN` in GitHub Secrets or your shell.",
  ].join("\n"),
});

console.log(`Published ${packageJson.name}@${packageJson.version} with npm tag "${npmTag}".`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: "inherit",
    ...(command === npmBin ? npmSpawnOptions : {}),
  });

  if (result.status !== 0) {
    fail(options.failureMessage || `${command} ${args.join(" ")} failed.`);
  }
}

function withNpmCache(args) {
  return ["--cache", npmCache, ...args];
}

function getPublishArgs({ dryRun }) {
  const args = ["publish"];

  if (dryRun) {
    args.push("--dry-run");
  }

  args.push("--tag", npmTag, "--access", "public");

  if (publishOtp) {
    args.push("--otp", publishOtp);
  }

  return withNpmCache(args);
}

function getCliValue(name) {
  const exactIndex = process.argv.indexOf(name);

  if (exactIndex !== -1) {
    const value = process.argv[exactIndex + 1];
    return value && !value.startsWith("--") ? value : null;
  }

  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function isNpmNotFound(result) {
  return result.status !== 0 && /E404|404 Not Found|could not be found/i.test(getSpawnOutput(result));
}

function getSpawnOutput(result) {
  return [
    result.stdout,
    result.stderr,
    result.error?.message,
  ]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .join("\n");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
