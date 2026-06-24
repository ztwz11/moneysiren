import type { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { shouldUseColor } from "./theme.js";
import { CLI_VERSION } from "./version.js";

export interface StartupIntroOptions {
  args: readonly string[];
  env: Record<string, string | undefined>;
  stdoutIsTTY: boolean;
  output: Pick<Writable, "write">;
  delayMs?: number;
}

const INTRO_SKIP_COMMANDS = new Set([
  "--help",
  "-h",
  "help",
  "--version",
  "-v",
  "version",
  "/help",
  "/version",
]);

const ASCII_LOGO = [
  " __  __                      ____  _              ",
  "|  \\/  | ___  _ __   ___ _  / ___|(_)_ __ ___ _ __ ",
  "| |\\/| |/ _ \\| '_ \\ / _ \\ | \\___ \\| | '__/ _ \\ '_ \\",
  "| |  | | (_) | | | |  __/ |  ___) | | | |  __/ | | |",
  "|_|  |_|\\___/|_| |_|\\___|_| |____/|_|_|  \\___|_| |_|",
];

const INTRO_FRAMES = [
  "warming local radar",
  "checking CLI, Web, HUD",
  "ready to watch spend",
];

export async function maybeRenderStartupIntro(options: StartupIntroOptions): Promise<void> {
  if (!shouldRenderStartupIntro(options.args, options.env, options.stdoutIsTTY)) {
    return;
  }

  const colorEnabled = shouldUseColor({
    env: options.env,
    stdoutIsTTY: options.stdoutIsTTY,
  });
  const write = (text: string) => {
    options.output.write(text);
  };
  const delayMs = options.delayMs ?? 55;
  const clearLine = `\r${" ".repeat(72)}\r`;

  for (const [index, frame] of INTRO_FRAMES.entries()) {
    write(`${clearLine}${paint(colorEnabled, "brand", "MoneySiren")} ${spinner(index)} ${paint(colorEnabled, "muted", frame)}`);
    await delay(delayMs);
  }

  write(clearLine);
  write(`${renderStartupLogo(colorEnabled)}\n`);
}

export function shouldRenderStartupIntro(
  rawArgs: readonly string[],
  env: Record<string, string | undefined>,
  stdoutIsTTY: boolean,
): boolean {
  if (!stdoutIsTTY) {
    return false;
  }

  if (isTruthy(env.CI) || isTruthy(env.MONEYSIREN_NO_INTRO)) {
    return false;
  }

  const introFlag = env.MONEYSIREN_CLI_INTRO?.trim().toLowerCase();
  if (introFlag === "0" || introFlag === "false" || introFlag === "no" || introFlag === "off") {
    return false;
  }

  const args = stripLeadingArgumentSeparator(rawArgs);
  const command = args[0];

  if (command !== undefined && INTRO_SKIP_COMMANDS.has(command)) {
    return false;
  }

  if (args.includes("--json")) {
    return false;
  }

  return true;
}

export function renderStartupLogo(colorEnabled: boolean): string {
  return [
    ...ASCII_LOGO.map((line) => paint(colorEnabled, "brand", line)),
    `       ${paint(colorEnabled, "muted", `local spend radar | CLI . Web . HUD | ${CLI_VERSION}`)}`,
  ].join("\n");
}

function stripLeadingArgumentSeparator(args: readonly string[]): readonly string[] {
  return args[0] === "--" ? args.slice(1) : args;
}

function spinner(index: number): string {
  return ["-", "\\", "|", "/"][index % 4] ?? "-";
}

function paint(colorEnabled: boolean, role: "brand" | "muted", text: string): string {
  if (!colorEnabled) {
    return text;
  }

  const code = role === "brand" ? "1;36" : "90";
  return `\x1b[${code}m${text}\x1b[0m`;
}

function isTruthy(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "0" && normalized !== "false" && normalized !== "no" && normalized !== "off";
}
