import type { CliExecutionContext } from "../cli.js";
import {
  DEFAULT_INSTALL_SURFACES,
  INSTALL_SURFACES,
  isInstallSurface,
  readInstallProfileFile,
  resolveInstallProfilePath,
  writeInstallProfileFile,
  type InstallSurface,
} from "../install-profile.js";
import {
  formatInstallSelectionLine,
  installSelectionHelp,
  parseInstallSurfaceSelection,
  promptForInstallSurfaces,
} from "../install-selector.js";

const INSTALL_USAGE = [
  "Usage: moneysiren install [--status|--all|--cli|--web|--hud|--no-cli|--no-web|--no-hud]",
  "",
  "Components:",
  installSelectionHelp(),
  "",
  "Default: all components selected (recommended).",
].join("\n");

export async function runInstallCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(INSTALL_USAGE);
    return 0;
  }

  if (args.length === 1 && args[0] === "--status") {
    return writeInstallStatus(context);
  }

  const parsed = parseInstallArgs(args);

  if (parsed === null) {
    context.stderr(INSTALL_USAGE);
    return 1;
  }

  const selectedSurfaces = parsed ?? await selectedSurfacesFromPromptOrDefault(context);
  const profile = await writeInstallProfileFile({
    selectedSurfaces,
    source: "cli",
    recommendedDefault: isDefaultSelection(selectedSurfaces),
  }, {
    env: context.env,
    now: context.now,
  });

  context.stdout("MoneySiren install profile updated.");
  context.stdout(formatInstallSelectionLine(profile.selectedSurfaces));
  context.stdout("Secrets returned: false");
  return 0;
}

async function writeInstallStatus(context: CliExecutionContext): Promise<number> {
  const profile = await readInstallProfileFile({
    env: context.env,
  });
  const selectedSurfaces = profile?.selectedSurfaces ?? DEFAULT_INSTALL_SURFACES;

  context.stdout("MoneySiren install profile");
  context.stdout(`Status: ${profile === null ? "not configured; using recommended default" : "configured"}`);
  context.stdout(formatInstallSelectionLine(selectedSurfaces));
  context.stdout(`Recommended default: ${isDefaultSelection(selectedSurfaces) ? "yes" : "no"}`);
  context.stdout(`Profile path: ${resolveInstallProfilePath({ env: context.env })}`);
  context.stdout("Secrets returned: false");
  return 0;
}

async function selectedSurfacesFromPromptOrDefault(context: CliExecutionContext): Promise<readonly InstallSurface[]> {
  if (!context.interactive || context.stdin === undefined || context.output === undefined) {
    return DEFAULT_INSTALL_SURFACES;
  }

  return promptForInstallSurfaces({
    stdin: context.stdin,
    output: context.output,
  });
}

function parseInstallArgs(args: readonly string[]): readonly InstallSurface[] | null | undefined {
  if (args.length === 0) {
    return undefined;
  }

  if (args.length === 1) {
    const selected = parseInstallSurfaceSelection(args[0] ?? "");

    if (selected !== null) {
      return selected;
    }
  }

  let explicitIncludes = false;
  const selected = new Set<InstallSurface>();

  for (const arg of args) {
    if (arg === "--all") {
      for (const surface of DEFAULT_INSTALL_SURFACES) {
        selected.add(surface);
      }
      explicitIncludes = true;
      continue;
    }

    if (arg.startsWith("--no-")) {
      const surface = arg.slice("--no-".length);

      if (!isInstallSurface(surface)) {
        return null;
      }

      if (!explicitIncludes) {
        for (const defaultSurface of DEFAULT_INSTALL_SURFACES) {
          selected.add(defaultSurface);
        }
        explicitIncludes = true;
      }

      selected.delete(surface);
      continue;
    }

    if (arg.startsWith("--")) {
      const surface = arg.slice("--".length);

      if (!isInstallSurface(surface)) {
        return null;
      }

      selected.add(surface);
      explicitIncludes = true;
      continue;
    }

    if (!isInstallSurface(arg)) {
      return null;
    }

    selected.add(arg);
    explicitIncludes = true;
  }

  const normalized = INSTALL_SURFACES.filter((surface) => selected.has(surface));

  return normalized.length === 0 ? null : normalized;
}

function isDefaultSelection(selectedSurfaces: readonly InstallSurface[]): boolean {
  return selectedSurfaces.length === INSTALL_SURFACES.length &&
    INSTALL_SURFACES.every((surface, index) => selectedSurfaces[index] === surface);
}
