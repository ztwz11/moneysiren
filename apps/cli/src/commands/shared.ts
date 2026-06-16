import { isAbsolute, join } from "node:path";
import { loadMoneySirenConfig, type MoneySirenConfig } from "../../../../packages/config/src/index.js";

export interface ParsedFlagResult {
  value?: string;
  remainingArgs: string[];
}

export function loadCliConfig(env: Record<string, string | undefined>): MoneySirenConfig {
  return loadMoneySirenConfig(env);
}

export function resolveDbPath(cwd: string, configuredDbPath: string): string {
  return isAbsolute(configuredDbPath) ? configuredDbPath : join(cwd, configuredDbPath);
}

export function readFlag(args: readonly string[], flagName: string): ParsedFlagResult {
  const remainingArgs: string[] = [];
  let value: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === flagName) {
      value = args[index + 1];
      index += 1;
      continue;
    }

    if (arg?.startsWith(`${flagName}=`)) {
      value = arg.slice(flagName.length + 1);
      continue;
    }

    if (arg !== undefined) {
      remainingArgs.push(arg);
    }
  }

  return value === undefined ? { remainingArgs } : { value, remainingArgs };
}
