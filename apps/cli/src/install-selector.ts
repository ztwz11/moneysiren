import { createInterface } from "node:readline/promises";
import {
  DEFAULT_INSTALL_SURFACES,
  INSTALL_SURFACES,
  formatInstallSurfaces,
  installSurfaceLabel,
  isInstallSurface,
  normalizeInstallSurfaces,
  type InstallSurface,
} from "./install-profile.js";

export interface InstallSelectionPromptOptions {
  stdin: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

export async function promptForInstallSurfaces(
  options: InstallSelectionPromptOptions,
): Promise<readonly InstallSurface[]> {
  options.output.write([
    "MoneySiren setup",
    "Recommended default: CLI, Web dashboard, HUD",
    "Select components to enable after npm install:",
    "  1. CLI",
    "  2. Web dashboard",
    "  3. HUD",
    "",
  ].join("\n"));
  options.output.write("\n");

  const readline = createInterface({
    input: options.stdin,
    output: options.output,
  });

  try {
    const answer = await readline.question("Choose components [1,2,3] (Enter = all recommended): ");
    const selected = parseInstallSurfaceSelection(answer);

    if (selected === null) {
      options.output.write("Invalid selection. Using recommended default: CLI, Web dashboard, HUD\n");
      return DEFAULT_INSTALL_SURFACES;
    }

    return selected;
  } finally {
    readline.close();
  }
}

export function parseInstallSurfaceSelection(input: string): readonly InstallSurface[] | null {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length === 0 || trimmed === "all" || trimmed === "recommended") {
    return DEFAULT_INSTALL_SURFACES;
  }

  const selected = trimmed
    .split(/[\s,;]+/)
    .filter((token) => token.length > 0)
    .map(selectionTokenToSurface);

  if (selected.some((surface) => surface === null)) {
    return null;
  }

  const normalized = normalizeInstallSurfaces(selected.filter((surface): surface is InstallSurface => surface !== null));

  return normalized.length === 0 ? null : normalized;
}

export function formatInstallSelectionLine(selectedSurfaces: readonly InstallSurface[]): string {
  return `Selected components: ${formatInstallSurfaces(selectedSurfaces)}`;
}

export function installSelectionHelp(): string {
  return INSTALL_SURFACES
    .map((surface, index) => `  ${index + 1}. ${installSurfaceLabel(surface)}`)
    .join("\n");
}

function selectionTokenToSurface(token: string): InstallSurface | null {
  if (token === "1") {
    return "cli";
  }

  if (token === "2") {
    return "web";
  }

  if (token === "3") {
    return "hud";
  }

  return isInstallSurface(token) ? token : null;
}
