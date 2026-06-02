import { runDoctorCommand } from "./commands/doctor.js";
import { runInitCommand } from "./commands/init.js";
import { runReportCommand } from "./commands/report.js";
import { runSyncCommand } from "./commands/sync.js";

export const CLI_VERSION = "0.1.0-alpha.0";

const HELP = `StackSpend ${CLI_VERSION}

Local-first cloud/SaaS usage, status, and expected billing dashboard.

Usage:
  stackspend --help
  stackspend --version
  stackspend init
  stackspend doctor
  stackspend sync --provider <mock|aws|openai|supabase>
  stackspend report daily --lang ko
`;

export interface CliRuntime {
  cwd?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  stdoutBuffer?: string[];
  stderrBuffer?: string[];
}

export interface CliExecutionContext {
  cwd: string;
  env: Record<string, string | undefined>;
  now: () => Date;
  stdout(line: string): void;
  stderr(line: string): void;
}

export interface CliResult {
  exitCode: number;
  stdout: readonly string[];
  stderr: readonly string[];
}

export async function runCli(args: readonly string[], runtime: CliRuntime = {}): Promise<CliResult> {
  const stdout = runtime.stdoutBuffer ?? [];
  const stderr = runtime.stderrBuffer ?? [];

  const context: CliExecutionContext = {
    cwd: runtime.cwd ?? process.cwd(),
    env: runtime.env ?? process.env,
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
  };

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

  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
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

  if (command === "doctor") {
    return runDoctorCommand(rest, context);
  }

  if (command === "sync") {
    return runSyncCommand(rest, context);
  }

  if (command === "report") {
    return runReportCommand(rest, context);
  }

  context.stderr(`Unknown command: ${command}`);
  context.stderr("Run `stackspend --help` for usage.");
  return 1;
}
