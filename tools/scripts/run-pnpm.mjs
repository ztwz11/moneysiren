import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ALLOWED_WORKSPACE_SCRIPTS = new Set(["build", "test", "typecheck", "lint"]);
const RUNTIME_WORKSPACE_PACKAGES = new Set(["@stackspend/cli", "@stackspend/web", "@stackspend/tray"]);
const RUNTIME_WORKSPACE_SCRIPTS = new Set(["dev", "start", "tauri:dev", "tauri:build", "tauri:build:unsigned"]);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const args = process.argv.slice(2);
const env = {
  ...process.env,
};

if (env.COREPACK_HOME === undefined || env.COREPACK_HOME.trim().length === 0) {
  env.COREPACK_HOME = resolve(repoRoot, ".stackspend", "corepack");
}

if (env.STACKSPEND_DB_PATH === undefined || env.STACKSPEND_DB_PATH.trim().length === 0) {
  if (usesRuntimeWorkspace(args)) {
    env.STACKSPEND_DB_PATH = resolve(repoRoot, ".stackspend", "stackspend.sqlite");
  }
}

let pnpmArgs = args;

if (args[0] === "--workspace-script") {
  const workspaceScript = args[1];

  if (workspaceScript === undefined || !ALLOWED_WORKSPACE_SCRIPTS.has(workspaceScript)) {
    console.error("Usage: node tools/scripts/run-pnpm.mjs --workspace-script <build|test|typecheck|lint>");
    process.exit(1);
  }

  pnpmArgs = ["-r", workspaceScript];

  if (workspaceScript === "test") {
    const tmpDir = resolve(repoRoot, ".stackspend", "tmp");
    mkdirSync(tmpDir, { recursive: true });
    env.TMPDIR = tmpDir;
  }
}

const result = runCorepackPnpm(pnpmArgs, env);

if (result.error !== undefined) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal !== null) {
  console.error(`corepack pnpm exited from signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

function runCorepackPnpm(pnpmArgs, env) {
  if (process.platform === "win32") {
    const commandLine = ["corepack", "pnpm", ...pnpmArgs].map(quoteWindowsArg).join(" ");

    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: repoRoot,
      env,
      stdio: "inherit",
    });
  }

  return spawnSync("corepack", ["pnpm", ...pnpmArgs], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
}

function usesRuntimeWorkspace(args) {
  const filterIndex = args.indexOf("--filter");

  if (filterIndex === -1) {
    return false;
  }

  const packageName = args[filterIndex + 1];

  if (!RUNTIME_WORKSPACE_PACKAGES.has(packageName)) {
    return false;
  }

  return args.some((arg) => RUNTIME_WORKSPACE_SCRIPTS.has(arg));
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}
