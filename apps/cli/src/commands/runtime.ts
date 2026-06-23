import type { CliExecutionContext } from "../cli.js";
import {
  createFallbackDesktopRuntimeAdapter,
  type CliDesktopRuntimeAdapter,
  type DesktopProcessStatus,
  type DesktopRuntimeResult,
  type DesktopShellResult,
  type StopDesktopRuntimeResult,
} from "../desktop-runtime.js";
import {
  createFallbackLocalRuntimeAdapter,
  type CliLocalRuntimeAdapter,
  type LocalRuntime,
  type StartRuntimeResult,
} from "../runtime-adapter.js";
import { removeRuntimeLock } from "../../../../packages/runtime/src/index.js";

const SERVE_USAGE = "Usage: moneysiren serve [--port <port>]";
const START_USAGE = "Usage: msiren start [--port <port>] [--open|--no-open] [--hud]";
const HUD_USAGE = "Usage: msiren hud [--port <port>]";
const STATUS_USAGE = "Usage: msiren status";
const STOP_USAGE = "Usage: msiren stop [--web|--hud|--api|--all]";
const RESTART_USAGE = "Usage: msiren restart [--port <port>] [--open|--no-open] [--hud]";
const OPEN_USAGE = "Usage: moneysiren open";
const DESKTOP_USAGE = "Usage: moneysiren desktop status";

interface ParsedServeArgs {
  port?: number;
}

interface ParsedStartArgs {
  launchHud: boolean;
  openBrowser: boolean;
  port?: number;
}

interface ParsedHudArgs {
  port?: number;
}

interface StopSelection {
  api: boolean;
  hud: boolean;
  web: boolean;
}

export async function runServeCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(SERVE_USAGE);
    return 0;
  }

  const parsed = parseServeArgs(args);

  if (parsed === undefined) {
    context.stderr(SERVE_USAGE);
    return 1;
  }

  const result = await runtimeAdapter(context).startRuntime({
    headless: false,
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });

  return writeStartRuntimeResult(context, result, "MoneySiren local runtime");
}

export async function runStatusCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(STATUS_USAGE);
    return 0;
  }

  if (args.length > 0) {
    context.stderr(STATUS_USAGE);
    return 1;
  }

  const desktop = await desktopRuntimeAdapter(context).status();
  const api = await runtimeAdapter(context).findRuntime();

  context.stdout("MoneySiren status");
  writeDesktopProcessStatus(context, "Web runtime", desktop.web);
  writeDesktopProcessStatus(context, "HUD", desktop.hud);
  context.stdout(`Desktop state: ${desktop.statePath}`);

  if (api === null) {
    context.stdout("Local API runtime: not running");
    return 0;
  }

  const healthy = await runtimeAdapter(context).assertRuntimeHealthy(api);
  context.stdout(`Local API runtime: ${healthy ? "healthy" : "unhealthy"}`);
  context.stdout(`  PID: ${api.pid}`);
  context.stdout(`  URL: ${api.baseUrl}`);
  return healthy ? 0 : 1;
}

export async function runStartCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(START_USAGE);
    return 0;
  }

  const parsed = parseStartArgs(args);

  if (parsed === undefined) {
    context.stderr(START_USAGE);
    return 1;
  }

  const adapter = desktopRuntimeAdapter(context);
  const web = await adapter.startWebRuntime({
    openBrowser: parsed.openBrowser,
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });
  const webExitCode = writeDesktopRuntimeResult(context, web, "MoneySiren dashboard runtime");

  if (webExitCode !== 0) {
    return webExitCode;
  }

  if (web.status !== "unavailable" && parsed.openBrowser) {
    await context.openUrl(web.dashboardUrl);
    context.stdout(`Dashboard URL: ${web.dashboardUrl}`);
  }

  if (!parsed.launchHud) {
    context.stdout("HUD: run `msiren hud` to open the floating desktop widget.");
    return 0;
  }

  const hud = await adapter.startHud({
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });

  return writeDesktopShellResult(context, hud, "MoneySiren HUD");
}

export async function runStopCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(STOP_USAGE);
    return 0;
  }

  const selection = parseStopArgs(args);

  if (selection === undefined) {
    context.stderr(STOP_USAGE);
    return 1;
  }

  context.stdout("MoneySiren stop");

  const desktopResults = await desktopRuntimeAdapter(context).stop({
    hud: selection.hud,
    web: selection.web,
  });

  for (const result of desktopResults) {
    writeStopDesktopRuntimeResult(context, result);
  }

  let exitCode = desktopResults.some((result) => result.status === "failed") ? 1 : 0;

  if (selection.api) {
    const apiResult = await stopLocalApiRuntime(context);
    context.stdout(`Local API runtime: ${apiResult.status}`);
    context.stdout(`  ${apiResult.detail}`);

    if (apiResult.pid !== undefined) {
      context.stdout(`  PID: ${apiResult.pid}`);
    }

    if (apiResult.status === "failed") {
      exitCode = 1;
    }
  }

  return exitCode;
}

export async function runRestartCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(RESTART_USAGE);
    return 0;
  }

  const parsed = parseStartArgs(args);

  if (parsed === undefined) {
    context.stderr(RESTART_USAGE);
    return 1;
  }

  const stopExitCode = await runStopCommand(["--web", "--hud"], context);

  if (stopExitCode !== 0) {
    return stopExitCode;
  }

  return runStartCommand(args, context);
}

export async function runHudCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(HUD_USAGE);
    return 0;
  }

  const parsed = parseHudArgs(args);

  if (parsed === undefined) {
    context.stderr(HUD_USAGE);
    return 1;
  }

  const adapter = desktopRuntimeAdapter(context);
  const web = await adapter.startWebRuntime({
    openBrowser: false,
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });
  const webExitCode = writeDesktopRuntimeResult(context, web, "MoneySiren dashboard runtime");

  if (webExitCode !== 0) {
    return webExitCode;
  }

  const hud = await adapter.startHud({
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });

  return writeDesktopShellResult(context, hud, "MoneySiren HUD");
}

async function stopLocalApiRuntime(context: CliExecutionContext): Promise<{
  status: "stopped" | "not-running" | "stale" | "failed";
  detail: string;
  pid?: number;
}> {
  const adapter = runtimeAdapter(context);
  const runtime = await adapter.findRuntime();

  if (runtime === null) {
    return {
      status: "not-running",
      detail: "No managed local API runtime lock was found.",
    };
  }

  try {
    process.kill(runtime.pid, "SIGTERM");
    await waitForProcessExit(runtime.pid, 3_000);

    if (isProcessAlive(runtime.pid)) {
      return {
        status: "failed",
        detail: "Local API runtime did not exit after SIGTERM.",
        pid: runtime.pid,
      };
    }

    await removeRuntimeLock({
      cwd: context.cwd,
      env: context.env,
    });

    return {
      status: "stopped",
      detail: "Managed local API runtime stopped.",
      pid: runtime.pid,
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") {
      await removeRuntimeLock({
        cwd: context.cwd,
        env: context.env,
      });

      return {
        status: "stale",
        detail: "Removed stale local API runtime lock.",
        pid: runtime.pid,
      };
    }

    return {
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
      pid: runtime.pid,
    };
  }
}

export async function runOpenCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(OPEN_USAGE);
    return 0;
  }

  if (args.length > 0) {
    context.stderr(OPEN_USAGE);
    return 1;
  }

  const adapter = runtimeAdapter(context);
  const runtime = await findHealthyRuntime(adapter);
  const startResult = runtime === null
    ? await adapter.startRuntime({
        headless: true,
      })
    : {
        status: "running" as const,
        runtime,
      };

  if (startResult.status === "unavailable") {
    return writeStartRuntimeResult(context, startResult, "MoneySiren open");
  }

  context.stdout("MoneySiren local API runtime ready");
  context.stdout(`Runtime: ${startResult.status}`);
  context.stdout(`Local API URL: ${startResult.runtime.baseUrl}`);
  context.stdout("Dashboard UI: not opened because this runtime URL is a JSON API.");
  context.stdout("Start the web dashboard:");
  context.stdout("  pnpm --filter @moneysiren/web dev");
  context.stdout("Then open: http://localhost:3000");
  return 0;
}

export async function runDesktopCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
    context.stdout(DESKTOP_USAGE);
    return 0;
  }

  if (subcommand !== "status" || rest.length > 0) {
    context.stderr(DESKTOP_USAGE);
    return 1;
  }

  const adapter = runtimeAdapter(context);
  const runtime = await adapter.findRuntime();

  context.stdout("MoneySiren desktop status");

  if (runtime === null) {
    context.stdout("Runtime: not running");
    context.stdout("Runtime lock: not found");
    context.stdout("Desktop shell: not detected by CLI");
    context.stdout("Next step: run `moneysiren serve` or start the native tray app.");
    return 0;
  }

  const healthy = await adapter.assertRuntimeHealthy(runtime);

  context.stdout(`Runtime: ${healthy ? "healthy" : "unhealthy"}`);
  context.stdout(`Base URL: ${runtime.baseUrl}`);
  context.stdout(`PID: ${runtime.pid}`);
  context.stdout(`Started at: ${runtime.startedAt}`);
  context.stdout(`Version: ${runtime.version}`);
  context.stdout("Desktop shell: not detected by CLI");
  return healthy ? 0 : 1;
}

function runtimeAdapter(context: CliExecutionContext): CliLocalRuntimeAdapter {
  return context.localRuntime ?? createFallbackLocalRuntimeAdapter(context);
}

function desktopRuntimeAdapter(context: CliExecutionContext): CliDesktopRuntimeAdapter {
  return context.desktopRuntime ?? createFallbackDesktopRuntimeAdapter(context);
}

async function findHealthyRuntime(adapter: CliLocalRuntimeAdapter): Promise<LocalRuntime | null> {
  const runtime = await adapter.findRuntime();

  if (runtime === null) {
    return null;
  }

  return await adapter.assertRuntimeHealthy(runtime) ? runtime : null;
}

function writeStartRuntimeResult(
  context: CliExecutionContext,
  result: StartRuntimeResult,
  heading: string,
): number {
  if (result.status !== "unavailable") {
    context.stdout(heading);
    context.stdout(`Runtime: ${result.status}`);
    context.stdout(`Base URL: ${result.runtime.baseUrl}`);
    context.stdout(`PID: ${result.runtime.pid}`);
    return 0;
  }

  context.stderr(`${heading}: unavailable`);
  context.stderr(result.reason);

  for (const line of result.guidance) {
    context.stderr(line);
  }

  return 1;
}

function writeDesktopRuntimeResult(
  context: CliExecutionContext,
  result: DesktopRuntimeResult,
  heading: string,
): number {
  if (result.status !== "unavailable") {
    context.stdout(heading);
    context.stdout(`Runtime: ${result.status}`);
    context.stdout(`Dashboard URL: ${result.dashboardUrl}`);

    if (result.pid !== undefined) {
      context.stdout(`PID: ${result.pid}`);
    }

    for (const note of result.notes) {
      context.stdout(`Note: ${note}`);
    }

    return 0;
  }

  context.stderr(`${heading}: unavailable`);
  context.stderr(result.reason);

  for (const line of result.guidance) {
    context.stderr(line);
  }

  return 1;
}

function writeDesktopShellResult(
  context: CliExecutionContext,
  result: DesktopShellResult,
  heading: string,
): number {
  if (result.status !== "unavailable") {
    context.stdout(heading);
    context.stdout(`Desktop shell: ${result.status}`);

    if (result.pid !== undefined) {
      context.stdout(`PID: ${result.pid}`);
    }

    for (const note of result.notes) {
      context.stdout(`Note: ${note}`);
    }

    return 0;
  }

  context.stderr(`${heading}: unavailable`);
  context.stderr(result.reason);

  for (const line of result.guidance) {
    context.stderr(line);
  }

  return 1;
}

function writeDesktopProcessStatus(context: CliExecutionContext, label: string, status: DesktopProcessStatus): void {
  context.stdout(`${label}: ${status.status}`);

  if (status.pid !== undefined) {
    context.stdout(`  PID: ${status.pid}`);
  }

  context.stdout(`  ${status.detail}`);
}

function writeStopDesktopRuntimeResult(context: CliExecutionContext, result: StopDesktopRuntimeResult): void {
  const label = result.target === "web" ? "Web runtime" : "HUD";

  context.stdout(`${label}: ${result.status}`);
  context.stdout(`  ${result.detail}`);

  if (result.pid !== undefined) {
    context.stdout(`  PID: ${result.pid}`);
  }
}

function parseServeArgs(args: readonly string[]): ParsedServeArgs | undefined {
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--port") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return undefined;
      }

      port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }

    return undefined;
  }

  if (port === undefined) {
    return {};
  }

  return Number.isSafeInteger(port) && port > 0 && port <= 65_535 ? { port } : undefined;
}

function parseStopArgs(args: readonly string[]): StopSelection | undefined {
  let web = false;
  let hud = false;
  let api = false;
  let all = false;

  for (const arg of args) {
    if (arg === "--web") {
      web = true;
    } else if (arg === "--hud") {
      hud = true;
    } else if (arg === "--api") {
      api = true;
    } else if (arg === "--all") {
      all = true;
    } else {
      return undefined;
    }
  }

  if (all || (!web && !hud && !api)) {
    return {
      api: true,
      hud: true,
      web: true,
    };
  }

  return {
    api,
    hud,
    web,
  };
}

function parseStartArgs(args: readonly string[]): ParsedStartArgs | undefined {
  let launchHud = false;
  let openBrowser = true;
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--hud") {
      launchHud = true;
      continue;
    }

    if (arg === "--open") {
      openBrowser = true;
      continue;
    }

    if (arg === "--no-open") {
      openBrowser = false;
      continue;
    }

    if (arg === "--port") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return undefined;
      }

      port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }

    return undefined;
  }

  if (port !== undefined && (!Number.isSafeInteger(port) || port <= 0 || port > 65_535)) {
    return undefined;
  }

  return {
    launchHud,
    openBrowser,
    ...(port === undefined ? {} : { port }),
  };
}

function parseHudArgs(args: readonly string[]): ParsedHudArgs | undefined {
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--port") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return undefined;
      }

      port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }

    return undefined;
  }

  if (port !== undefined && (!Number.isSafeInteger(port) || port <= 0 || port > 65_535)) {
    return undefined;
  }

  return port === undefined ? {} : { port };
}

function parsePort(value: string): number {
  return Number.parseInt(value, 10);
}

function isProcessAlive(pid: number): boolean {
  if (pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isNodeError(error) && error.code === "EPERM";
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return;
    }

    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 100));
  }
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
