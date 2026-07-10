import type { CliExecutionContext } from "../cli.js";
import { readReleaseRuntimeInstallStatus } from "../release-installer.js";
import { runInitCommand } from "./init.js";
import { runInstallCommand } from "./install.js";
import { runStartCommand } from "./runtime.js";
import { runSyncCommand } from "./sync.js";

const DEMO_USAGE = "Usage: msiren demo [--port <port>] [--open|--no-open]";

export interface DemoOptions {
  openBrowser: boolean;
  port?: number;
}

export interface GuidedDemoActions {
  runtimeStatus(): Promise<"ready" | "needs-install">;
  installWeb(): Promise<number>;
  initialize(): Promise<number>;
  syncMock(): Promise<number>;
  start(options: DemoOptions): Promise<number>;
}

export async function runDemoCommand(
  args: readonly string[],
  context: CliExecutionContext,
): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(DEMO_USAGE);
    return 0;
  }

  const options = parseDemoArgs(args);

  if (options === undefined) {
    context.stderr(DEMO_USAGE);
    return 1;
  }

  return runGuidedDemo(options, context.stdout, {
    async runtimeStatus() {
      const status = await readReleaseRuntimeInstallStatus({ env: context.env });
      return status.status === "ready" ? "ready" : "needs-install";
    },
    installWeb: () => runInstallCommand(["--web"], context),
    initialize: () => runInitCommand([], context),
    syncMock: () => runSyncCommand(["--provider", "mock"], context),
    start: (startOptions) => runStartCommand([
      ...(startOptions.port === undefined ? [] : ["--port", String(startOptions.port)]),
      startOptions.openBrowser ? "--open" : "--no-open",
    ], context),
  });
}

export async function runGuidedDemo(
  options: DemoOptions,
  stdout: (line: string) => void,
  actions: GuidedDemoActions,
): Promise<number> {
  stdout("MoneySiren credential-free demo");
  stdout("Data mode: fake local snapshots only.");

  if (await actions.runtimeStatus() !== "ready") {
    stdout("Step 1/4: installing the verified local web runtime...");
    const installExitCode = await actions.installWeb();

    if (installExitCode !== 0) {
      return installExitCode;
    }
  } else {
    stdout("Step 1/4: verified local web runtime already installed; reusing it.");
  }

  stdout("Step 2/4: preparing local SQLite storage...");
  const initExitCode = await actions.initialize();

  if (initExitCode !== 0) {
    return initExitCode;
  }

  stdout("Step 3/4: writing synthetic mock snapshots...");
  const syncExitCode = await actions.syncMock();

  if (syncExitCode !== 0) {
    return syncExitCode;
  }

  stdout("Step 4/4: starting the local dashboard...");
  const startExitCode = await actions.start(options);

  if (startExitCode === 0) {
    stdout("Demo ready: no provider credential was read and no provider API was called.");
    stdout("Run `msiren demo` again at any time; completed local setup is reused.");
  }

  return startExitCode;
}

export function parseDemoArgs(args: readonly string[]): DemoOptions | undefined {
  let openBrowser = true;
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

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

  if (port !== undefined && (!Number.isSafeInteger(port) || port < 1 || port > 65_535)) {
    return undefined;
  }

  return {
    openBrowser,
    ...(port === undefined ? {} : { port }),
  };
}

function parsePort(value: string): number {
  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}
