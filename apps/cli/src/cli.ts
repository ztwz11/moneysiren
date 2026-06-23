import { runDashboardCommand } from "./commands/dashboard.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runInitCommand } from "./commands/init.js";
import { runInstallCommand } from "./commands/install.js";
import { runModesCommand } from "./commands/modes.js";
import { runNotifyCommand } from "./commands/notify.js";
import { runReportCommand } from "./commands/report.js";
import {
  runDesktopCommand,
  runHudCommand,
  runOpenCommand,
  runRestartCommand,
  runServeCommand,
  runStartCommand,
  runStatusCommand,
  runStopCommand,
} from "./commands/runtime.js";
import { runSummaryCommand } from "./commands/summary.js";
import { runSyncCommand } from "./commands/sync.js";
import { runThemeCommand } from "./commands/theme.js";
import { renderHelpScreen, renderHomeScreen } from "./home.js";
import { runSlashPrompt } from "./interactive.js";
import { openUrlInBrowser, type CliLocalRuntimeAdapter } from "./runtime-adapter.js";
import type { CliDesktopRuntimeAdapter } from "./desktop-runtime.js";
import { resolveSlashCommand } from "./slash.js";
import { createTheme, type Theme } from "./theme.js";
import { CLI_VERSION } from "./version.js";
import type { SlackReportTransport } from "../../../packages/report/src/index.js";
import type { AwsCostExplorerClientAdapter } from "../../../packages/connectors/aws/src/index.js";
import type { CloudflareBillingUsageClient } from "../../../packages/connectors/cloudflare/src/index.js";
import type { OpenAiUsageCostsClient } from "../../../packages/connectors/openai/src/index.js";
import type { SupabaseManagementClient } from "../../../packages/connectors/supabase/src/index.js";

export { CLI_VERSION } from "./version.js";

const HELP = renderHelpScreen(CLI_VERSION);

export interface CliRuntime {
  cwd?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  stdin?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  interactive?: boolean;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  stdoutBuffer?: string[];
  stderrBuffer?: string[];
  slackTransport?: SlackReportTransport;
  liveClients?: CliLiveClients;
  fetch?: typeof fetch;
  localRuntime?: CliLocalRuntimeAdapter;
  desktopRuntime?: CliDesktopRuntimeAdapter;
  openUrl?: (url: string) => Promise<void> | void;
}

export interface CliLiveClients {
  awsCostExplorer?: AwsCostExplorerClientAdapter;
  cloudflareBillingUsage?: CloudflareBillingUsageClient;
  openaiUsageCosts?: OpenAiUsageCostsClient;
  supabaseUsageHealth?: SupabaseManagementClient;
}

export interface CliExecutionContext {
  cwd: string;
  env: Record<string, string | undefined>;
  now: () => Date;
  stdout(line: string): void;
  stderr(line: string): void;
  slackTransport?: SlackReportTransport;
  liveClients?: CliLiveClients;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  openUrl(url: string): Promise<void> | void;
  stdin?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  interactive: boolean;
  theme: Theme;
  localRuntime?: CliLocalRuntimeAdapter;
  desktopRuntime?: CliDesktopRuntimeAdapter;
}

export interface CliResult {
  exitCode: number;
  stdout: readonly string[];
  stderr: readonly string[];
}

export async function runCli(args: readonly string[], runtime: CliRuntime = {}): Promise<CliResult> {
  const stdout = runtime.stdoutBuffer ?? [];
  const stderr = runtime.stderrBuffer ?? [];
  const env = runtime.env ?? process.env;
  const stdinIsTTY = runtime.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const stdoutIsTTY = runtime.stdoutIsTTY ?? Boolean(process.stdout.isTTY);
  const theme = createTheme({
    cwd: runtime.cwd ?? process.cwd(),
    env,
    stdoutIsTTY,
  });

  const context: CliExecutionContext = {
    cwd: runtime.cwd ?? process.cwd(),
    env,
    now: runtime.now ?? (() => new Date()),
    stdout(line) {
      if (runtime.stdoutBuffer === undefined && runtime.stdout !== undefined) {
        stdout.push(line);
      }

      if (runtime.stdout === undefined) {
        stdout.push(line);
        return;
      }

      runtime.stdout(line);
    },
    stderr(line) {
      if (runtime.stderrBuffer === undefined && runtime.stderr !== undefined) {
        stderr.push(line);
      }

      if (runtime.stderr === undefined) {
        stderr.push(line);
        return;
      }

      runtime.stderr(line);
    },
    fetch: runtime.fetch ?? globalThis.fetch,
    openUrl: runtime.openUrl ?? openUrlInBrowser,
    interactive: runtime.interactive ?? shouldEnterInteractivePrompt({
      env,
      stdinIsTTY,
      stdoutIsTTY,
    }),
    theme,
    ...(runtime.localRuntime === undefined ? {} : { localRuntime: runtime.localRuntime }),
    ...(runtime.desktopRuntime === undefined ? {} : { desktopRuntime: runtime.desktopRuntime }),
  };

  context.stdin = runtime.stdin ?? process.stdin;
  context.output = runtime.output ?? process.stdout;

  if (runtime.slackTransport !== undefined) {
    context.slackTransport = runtime.slackTransport;
  }

  if (runtime.liveClients !== undefined) {
    context.liveClients = runtime.liveClients;
  }

  try {
    return {
      exitCode: await dispatchCommand(stripLeadingArgumentSeparator(args), context),
      stdout,
      stderr,
    };
  } catch (error) {
    context.stderr(error instanceof Error ? error.message : String(error));
    return {
      exitCode: 1,
      stdout,
      stderr,
    };
  }
}

function stripLeadingArgumentSeparator(args: readonly string[]): readonly string[] {
  return args[0] === "--" ? args.slice(1) : args;
}

async function dispatchCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [command, ...rest] = args;

  if (command === undefined) {
    context.stdout(renderHomeScreen({
      version: CLI_VERSION,
      theme: context.theme,
    }));

    if (context.interactive) {
      return runSlashPrompt(context, (promptArgs) => dispatchCommand(promptArgs, context));
    }

    return 0;
  }

  if (command.startsWith("/")) {
    return dispatchSlashCommand(args, context);
  }

  if (command === "--help" || command === "-h" || command === "help") {
    context.stdout(HELP);
    return 0;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    context.stdout(CLI_VERSION);
    return 0;
  }

  if (command === "init") {
    return runInitCommand(rest, context);
  }

  if (command === "install") {
    return runInstallCommand(rest, context);
  }

  if (command === "doctor") {
    return runDoctorCommand(rest, context);
  }

  if (command === "modes") {
    return runModesCommand(rest, context);
  }

  if (command === "dashboard") {
    return runDashboardCommand(rest, context);
  }

  if (command === "serve") {
    return runServeCommand(rest, context);
  }

  if (command === "start") {
    return runStartCommand(rest, context);
  }

  if (command === "status") {
    return runStatusCommand(rest, context);
  }

  if (command === "stop") {
    return runStopCommand(rest, context);
  }

  if (command === "restart") {
    return runRestartCommand(rest, context);
  }

  if (command === "hud") {
    return runHudCommand(rest, context);
  }

  if (command === "open") {
    return runOpenCommand(rest, context);
  }

  if (command === "sync") {
    return runSyncCommand(rest, context);
  }

  if (command === "summary") {
    return runSummaryCommand(rest, context);
  }

  if (command === "notify") {
    return runNotifyCommand(rest, context);
  }

  if (command === "desktop") {
    return runDesktopCommand(rest, context);
  }

  if (command === "report") {
    return runReportCommand(rest, context);
  }

  if (command === "theme") {
    return runThemeCommand(rest, context);
  }

  context.stderr(`Unknown command: ${command}`);
  context.stderr("Run `msiren --help` or `moneysiren --help` for usage.");
  return 1;
}

async function dispatchSlashCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const resolved = resolveSlashCommand(args);

  if (resolved.kind === "dispatch") {
    return dispatchCommand(resolved.args, context);
  }

  if (resolved.kind === "quit") {
    context.stdout("Bye.");
    return 0;
  }

  context.stderr(resolved.message);

  if (resolved.usage !== undefined) {
    context.stderr(resolved.usage);
  }

  return 1;
}

function shouldEnterInteractivePrompt(input: {
  env: Record<string, string | undefined>;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}): boolean {
  return input.stdinIsTTY && input.stdoutIsTTY && !isTruthyEnvValue(input.env.CI);
}

function isTruthyEnvValue(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 && normalized !== "0" && normalized !== "false" && normalized !== "no";
}
