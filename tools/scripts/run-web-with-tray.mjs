import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const runPnpmScript = resolve(scriptDir, "run-pnpm.mjs");
const children = [];
let shuttingDown = false;
const options = parseArgs(process.argv.slice(2));

if (options === null) {
  console.error("Usage: node tools/scripts/run-web-with-tray.mjs [--web-script <dev|start>] [--tray-mode <dev|built>] [--skip-web] [--dashboard-url <url>]");
  process.exit(1);
}

if (options.help) {
  console.log("Usage: node tools/scripts/run-web-with-tray.mjs [--web-script <dev|start>] [--tray-mode <dev|built>] [--skip-web] [--dashboard-url <url>]");
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shutdown(0);
  });
}

const dashboardUrl = options.dashboardUrl ?? process.env.STACKSPEND_WEB_URL ?? "http://127.0.0.1:3000/ko/dashboard/overview";

if (!options.skipWeb) {
  children.push(startProcess({
    name: "web",
    args: [runPnpmScript, "--filter", "@stackspend/web", options.webScript],
  }));
}

await waitForDashboard(dashboardUrl);

const trayProcess = startTrayProcess(options.trayMode);
if (trayProcess !== null) {
  children.push(trayProcess);
}

function startProcess(processSpec) {
  const child = spawn(processSpec.command ?? process.execPath, processSpec.args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
    windowsHide: false,
  });

  prefixStream(child.stdout, processSpec.name);
  prefixStream(child.stderr, processSpec.name);

  child.on("error", (error) => {
    console.error(`[${processSpec.name}] ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const exitCode = code ?? 1;
    console.error(`[${processSpec.name}] exited${signal === null ? "" : ` from ${signal}`} with code ${exitCode}`);
    shutdown(exitCode);
  });

  return child;
}

function startTrayProcess(trayMode) {
  if (trayMode === "dev") {
    return startProcess({
      name: "tray",
      args: [runPnpmScript, "--filter", "@stackspend/tray", "tauri:dev"],
    });
  }

  const executablePath = resolve(
    repoRoot,
    "apps/tray/src-tauri/target/release",
    process.platform === "win32" ? "stackspend-tray.exe" : "stackspend-tray",
  );

  if (!existsSync(executablePath)) {
    console.error([
      `[tray] built executable was not found at ${executablePath}`,
      "[tray] Run npm run build:local or npm run build:native before npm start.",
    ].join("\n"));
    shutdown(1);
    return null;
  }

  return startProcess({
    name: "tray",
    command: executablePath,
    args: [],
  });
}

function parseArgs(args) {
  const parsed = {
    dashboardUrl: null,
    help: false,
    skipWeb: false,
    trayMode: "dev",
    webScript: "dev",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--skip-web") {
      parsed.skipWeb = true;
      continue;
    }

    if (arg === "--web-script") {
      const value = args[index + 1];

      if (value !== "dev" && value !== "start") {
        return null;
      }

      parsed.webScript = value;
      index += 1;
      continue;
    }

    if (arg === "--tray-mode") {
      const value = args[index + 1];

      if (value !== "dev" && value !== "built") {
        return null;
      }

      parsed.trayMode = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--tray-mode=")) {
      const value = arg.slice("--tray-mode=".length);

      if (value !== "dev" && value !== "built") {
        return null;
      }

      parsed.trayMode = value;
      continue;
    }

    if (arg?.startsWith("--web-script=")) {
      const value = arg.slice("--web-script=".length);

      if (value !== "dev" && value !== "start") {
        return null;
      }

      parsed.webScript = value;
      continue;
    }

    if (arg === "--dashboard-url") {
      const value = args[index + 1];

      if (value === undefined || value.trim().length === 0) {
        return null;
      }

      parsed.dashboardUrl = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--dashboard-url=")) {
      const value = arg.slice("--dashboard-url=".length);

      if (value.trim().length === 0) {
        return null;
      }

      parsed.dashboardUrl = value;
      continue;
    }

    return null;
  }

  return parsed;
}

async function waitForDashboard(url) {
  const deadline = Date.now() + 90_000;
  let lastError = "not ready";

  console.log(`[web] waiting for ${url}`);

  while (Date.now() < deadline && !shuttingDown) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
      });

      if (response.ok) {
        console.log(`[web] dashboard ready: ${url}`);
        return;
      }

      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1_000));
  }

  console.error(`[web] dashboard did not become ready: ${lastError}`);
  shutdown(1);
}

function prefixStream(stream, prefix) {
  let buffered = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        console.log(`[${prefix}] ${line}`);
      }
    }
  });
  stream.on("end", () => {
    if (buffered.length > 0) {
      console.log(`[${prefix}] ${buffered}`);
    }
  });
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    terminateProcessTree(child);
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 200);
}

function terminateProcessTree(child) {
  if (child.exitCode !== null || child.pid === undefined) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}
