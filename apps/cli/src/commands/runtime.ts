import type { CliExecutionContext } from "../cli.js";
import {
  createFallbackLocalRuntimeAdapter,
  type CliLocalRuntimeAdapter,
  type LocalRuntime,
  type StartRuntimeResult,
} from "../runtime-adapter.js";

const SERVE_USAGE = "Usage: stackspend serve [--port <port>]";
const OPEN_USAGE = "Usage: stackspend open";
const DESKTOP_USAGE = "Usage: stackspend desktop status";

interface ParsedServeArgs {
  port?: number;
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

  return writeStartRuntimeResult(context, result, "StackSpend local runtime");
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
    return writeStartRuntimeResult(context, startResult, "StackSpend open");
  }

  context.stdout("StackSpend local API runtime ready");
  context.stdout(`Runtime: ${startResult.status}`);
  context.stdout(`Local API URL: ${startResult.runtime.baseUrl}`);
  context.stdout("Dashboard UI: not opened because this runtime URL is a JSON API.");
  context.stdout("Start the web dashboard:");
  context.stdout("  pnpm --filter @stackspend/web dev");
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

  context.stdout("StackSpend desktop status");

  if (runtime === null) {
    context.stdout("Runtime: not running");
    context.stdout("Runtime lock: not found");
    context.stdout("Desktop shell: not detected by CLI");
    context.stdout("Next step: run `stackspend serve` or start the native tray app.");
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

function parsePort(value: string): number {
  return Number.parseInt(value, 10);
}
