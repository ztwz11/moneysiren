import type { CliExecutionContext } from "../cli.js";

const MODES_USAGE = "Usage: stackspend modes";

export async function runModesCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(MODES_USAGE);
    return 0;
  }

  if (args.length > 0) {
    context.stderr(MODES_USAGE);
    return 1;
  }

  context.stdout("StackSpend modes");
  context.stdout(`Platform: ${platformLabel()}`);
  context.stdout("npm install: npm install -g @stackspend/cli@alpha");
  context.stdout(`Runtime lock: ${runtimeLockHint()}`);
  context.stdout("");
  context.stdout("1. CLI automation");
  context.stdout("   Status: available from the npm CLI package");
  context.stdout("   Try: stackspend doctor");
  context.stdout("   Try: stackspend sync --provider mock");
  context.stdout("");
  context.stdout("2. Local web dashboard/runtime");
  context.stdout("   Status: local API runtime is available from the npm CLI package");
  context.stdout("   Try: stackspend serve [--port <port>]");
  context.stdout("   Try: stackspend dashboard check");
  context.stdout("   Note: the full Next.js dashboard is run from the repo or a future bundled desktop app.");
  context.stdout("");
  context.stdout("3. Desktop tray/notifier");
  context.stdout("   Status: macOS target is the thin Tauri tray shell; the native tray binary is not bundled in @stackspend/cli");
  context.stdout("   Try: stackspend desktop status");
  context.stdout("   Try: stackspend notify once --dry-run");
  return 0;
}

function platformLabel(): string {
  if (process.platform === "darwin") {
    return `macOS (${process.platform} ${process.arch})`;
  }

  if (process.platform === "win32") {
    return `Windows (${process.platform} ${process.arch})`;
  }

  if (process.platform === "linux") {
    return `Linux (${process.platform} ${process.arch})`;
  }

  return `${process.platform} ${process.arch}`;
}

function runtimeLockHint(): string {
  if (process.platform === "darwin") {
    return "~/Library/Application Support/StackSpend/runtime.json";
  }

  if (process.platform === "win32") {
    return "%APPDATA%\\StackSpend\\runtime.json";
  }

  return "${XDG_CONFIG_HOME:-~/.config}/stackspend/runtime.json";
}
