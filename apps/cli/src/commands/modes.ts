import type { CliExecutionContext } from "../cli.js";
import {
  DEFAULT_INSTALL_SURFACES,
  formatInstallSurfaces,
  readInstallProfileFile,
  type InstallSurface,
} from "../install-profile.js";

const MODES_USAGE = "Usage: moneysiren modes";

export async function runModesCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(MODES_USAGE);
    return 0;
  }

  if (args.length > 0) {
    context.stderr(MODES_USAGE);
    return 1;
  }

  const profile = await readInstallProfileFile({
    env: context.env,
  });
  const selectedSurfaces = profile?.selectedSurfaces ?? DEFAULT_INSTALL_SURFACES;

  context.stdout("MoneySiren modes");
  context.stdout(`Platform: ${platformLabel()}`);
  context.stdout(`Install profile: ${formatInstallSurfaces(selectedSurfaces)}${profile === null ? " (recommended default)" : ""}`);
  context.stdout("npm install: npm install -g @moneysiren/cli@alpha");
  context.stdout("Short command: msiren");
  context.stdout(`Runtime lock: ${runtimeLockHint()}`);
  context.stdout("");
  context.stdout("1. CLI automation");
  context.stdout(`   Status: ${surfaceStatus("cli", selectedSurfaces)} from the npm CLI package`);
  context.stdout("   Try: msiren doctor");
  context.stdout("   Try: msiren sync --provider mock");
  context.stdout("");
  context.stdout("2. Local web dashboard/runtime");
  context.stdout(`   Status: ${surfaceStatus("web", selectedSurfaces)} GitHub Release web runtime archive is installed by the CLI`);
  context.stdout("   Install: msiren install --web");
  context.stdout("   Try: msiren start");
  context.stdout("   Stop: msiren stop --web");
  context.stdout("   Try: msiren dashboard check");
  context.stdout("   Note: msiren start runs the installed GitHub Release web runtime.");
  context.stdout("");
  context.stdout("3. Desktop tray/notifier");
  context.stdout(`   Status: ${surfaceStatus("hud", selectedSurfaces)} Windows/macOS target is the thin Tauri tray shell from GitHub Releases`);
  context.stdout("   Install: msiren install --hud");
  context.stdout("   Try: msiren hud");
  context.stdout("   Try: msiren status");
  context.stdout("   Stop: msiren stop --hud");
  context.stdout("   Try: msiren notify once --dry-run");
  context.stdout("");
  context.stdout("Install recommended set: msiren install --all");
  context.stdout("Stop managed runtimes: msiren stop");
  context.stdout("Change selection only: msiren install --profile-only");
  return 0;
}

function surfaceStatus(surface: InstallSurface, selectedSurfaces: readonly InstallSurface[]): string {
  return selectedSurfaces.includes(surface) ? "selected;" : "not selected;";
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
    return "~/Library/Application Support/MoneySiren/runtime.json";
  }

  if (process.platform === "win32") {
    return "%APPDATA%\\MoneySiren\\runtime.json";
  }

  return "${XDG_CONFIG_HOME:-~/.config}/moneysiren/runtime.json";
}
