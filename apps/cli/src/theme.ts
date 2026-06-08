import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export interface Theme {
  readonly colorEnabled: boolean;
  readonly source: string;
  brand(text: string): string;
  heading(text: string): string;
  command(text: string): string;
  muted(text: string): string;
  warning(text: string): string;
}

interface ThemeOptions {
  cwd?: string;
  env: Record<string, string | undefined>;
  stdoutIsTTY: boolean;
}

type ThemeRole = "brand" | "heading" | "command" | "muted" | "warning";
type ThemePalette = Record<ThemeRole, string>;

const DEFAULT_PALETTE: ThemePalette = {
  brand: "1;36",
  heading: "1;37",
  command: "32",
  muted: "90",
  warning: "33",
};

const IMAGE_DASHBOARD_PALETTE: ThemePalette = {
  brand: "1;38;5;30",
  heading: "1;38;5;231",
  command: "38;5;35",
  muted: "38;5;244",
  warning: "38;5;214",
};

export function createTheme(options: ThemeOptions): Theme {
  const colorEnabled = shouldUseColor(options);
  const resolved = resolveThemePalette(options);

  return {
    colorEnabled,
    source: resolved.source,
    brand: style(colorEnabled, resolved.palette.brand),
    heading: style(colorEnabled, resolved.palette.heading),
    command: style(colorEnabled, resolved.palette.command),
    muted: style(colorEnabled, resolved.palette.muted),
    warning: style(colorEnabled, resolved.palette.warning),
  };
}

export function shouldUseColor(options: ThemeOptions): boolean {
  if (hasEnvValue(options.env.NO_COLOR)) {
    return false;
  }

  const forcedColor = parseForceColor(options.env.FORCE_COLOR);

  if (forcedColor !== undefined) {
    return forcedColor;
  }

  if (options.env.TERM?.toLowerCase() === "dumb") {
    return false;
  }

  return options.stdoutIsTTY;
}

function style(colorEnabled: boolean, code: string): (text: string) => string {
  return (text) => {
    if (!colorEnabled) {
      return text;
    }

    return `\x1b[${code}m${text}\x1b[0m`;
  };
}

function resolveThemePalette(options: ThemeOptions): { palette: ThemePalette; source: string } {
  const themeFile = options.env.STACKSPEND_CLI_THEME_FILE?.trim();

  if (themeFile !== undefined && themeFile.length > 0) {
    const loaded = loadThemeFile(themeFile, options.cwd ?? process.cwd());

    if (loaded !== null) {
      return loaded;
    }
  }

  if (options.env.STACKSPEND_CLI_THEME?.trim().toLowerCase() === "image2-dashboard") {
    return {
      palette: IMAGE_DASHBOARD_PALETTE,
      source: "image2-dashboard",
    };
  }

  return {
    palette: DEFAULT_PALETTE,
    source: "default",
  };
}

function loadThemeFile(path: string, cwd: string): { palette: ThemePalette; source: string } | null {
  try {
    const absolutePath = isAbsolute(path) ? path : join(cwd, path);
    const payload = JSON.parse(readFileSync(absolutePath, "utf8")) as {
      source?: unknown;
      ansi?: Partial<Record<ThemeRole, unknown>>;
    };

    return {
      palette: {
        ...DEFAULT_PALETTE,
        ...sanitizePalette(payload.ansi ?? {}),
      },
      source: typeof payload.source === "string" && payload.source.trim().length > 0
        ? payload.source.trim().slice(0, 80)
        : `file:${path}`,
    };
  } catch {
    return null;
  }
}

function sanitizePalette(input: Partial<Record<ThemeRole, unknown>>): Partial<ThemePalette> {
  return Object.fromEntries(
    (Object.entries(input) as Array<[ThemeRole, unknown]>)
      .filter((entry): entry is [ThemeRole, string] => isThemeRole(entry[0]) && isSafeAnsiCode(entry[1])),
  ) as Partial<ThemePalette>;
}

function isThemeRole(value: string): value is ThemeRole {
  return value === "brand" ||
    value === "heading" ||
    value === "command" ||
    value === "muted" ||
    value === "warning";
}

function isSafeAnsiCode(value: unknown): value is string {
  return typeof value === "string" && /^[0-9;]{1,32}$/.test(value);
}

function hasEnvValue(value: string | undefined): boolean {
  return value !== undefined && value.length > 0;
}

function parseForceColor(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return true;
}
