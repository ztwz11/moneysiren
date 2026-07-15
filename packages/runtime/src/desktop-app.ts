import { posix, win32 } from "node:path";

export interface DesktopAppPathOptions {
  cwd: string;
  env: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
}

export interface InstalledDesktopAppPathOptions {
  env: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
}

export function resolveConfiguredDesktopAppPath(options: DesktopAppPathOptions): string | null {
  const configured = trimToNull(options.env.MONEYSIREN_DESKTOP_APP);

  if (configured === null) {
    return null;
  }

  return pathApi(options.platform ?? process.platform).resolve(options.cwd, configured);
}

export function installedDesktopAppCandidates(options: InstalledDesktopAppPathOptions): string[] {
  const platform = options.platform ?? process.platform;

  if (platform === "win32") {
    const roots = [
      trimToNull(options.env.LOCALAPPDATA),
      trimToNull(options.env.ProgramFiles),
      trimToNull(options.env["ProgramFiles(x86)"]),
    ].filter((value): value is string => value !== null);

    return roots.flatMap((root) => [
      win32.join(root, "Programs", "MoneySiren Tray", "MoneySiren Tray.exe"),
      win32.join(root, "Programs", "MoneySiren Tray", "moneysiren-tray.exe"),
      win32.join(root, "MoneySiren Tray", "MoneySiren Tray.exe"),
      win32.join(root, "MoneySiren Tray", "moneysiren-tray.exe"),
    ]);
  }

  if (platform === "darwin") {
    return ["/Applications/MoneySiren Tray.app"];
  }

  return [];
}

function pathApi(platform: NodeJS.Platform): typeof posix | typeof win32 {
  return platform === "win32" ? win32 : posix;
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}
