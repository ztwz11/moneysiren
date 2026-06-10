import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const trayRoot = resolve(repoRoot, "apps/tray");
const commandEnv = buildCommandEnv();
const args = process.argv.slice(2);
const allowedCommands = new Set(["dev", "build"]);
const command = args[0];

if (command === undefined || !allowedCommands.has(command)) {
  console.error("Usage: node tools/scripts/run-tray-tauri.mjs <dev|build> [tauri args]");
  process.exit(1);
}

if (!isCommandAvailable("cargo", ["--version"])) {
  console.error([
    "Rust/Cargo is required to run the native StackSpend tray app.",
    "Install Rust from https://www.rust-lang.org/tools/install, then rerun this command.",
    "The TypeScript tray model can still be validated with: node tools/scripts/run-pnpm.mjs --filter @stackspend/tray native:check",
  ].join("\n"));
  process.exit(1);
}

const tauriArgs = [command, ...args.slice(1)];
const result = runCorepackPnpm(["exec", "tauri", ...tauriArgs]);

if (result.error !== undefined) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal !== null) {
  console.error(`tauri ${command} exited from signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

function isCommandAvailable(executable, versionArgs) {
  const result = spawnSync(executable, versionArgs, {
    cwd: trayRoot,
    env: commandEnv,
    encoding: "utf8",
    stdio: "ignore",
  });

  return result.status === 0;
}

function runCorepackPnpm(pnpmArgs) {
  const env = {
    ...commandEnv,
  };

  if (env.COREPACK_HOME === undefined || env.COREPACK_HOME.trim().length === 0) {
    env.COREPACK_HOME = resolve(repoRoot, ".stackspend", "corepack");
  }

  if (process.platform === "win32") {
    const commandLine = ["corepack", "pnpm", ...pnpmArgs].map(quoteWindowsArg).join(" ");

    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: trayRoot,
      env,
      stdio: "inherit",
    });
  }

  return spawnSync("corepack", ["pnpm", ...pnpmArgs], {
    cwd: trayRoot,
    env,
    stdio: "inherit",
  });
}

function buildCommandEnv() {
  const env = {
    ...process.env,
  };

  if (process.platform === "win32") {
    const userProfile = env.USERPROFILE;
    if (userProfile !== undefined && userProfile.trim().length > 0) {
      const cargoBin = resolve(userProfile, ".cargo", "bin");
      env.Path = [cargoBin, env.Path ?? env.PATH ?? ""].filter(Boolean).join(";");
      env.PATH = env.Path;
    }
  }

  return env;
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}
