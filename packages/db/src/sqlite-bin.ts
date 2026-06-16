import { existsSync } from "node:fs";

export const SQLITE_BIN_ENV_KEY = "MONEYSIREN_SQLITE_BIN";

const DEFAULT_POSIX_SQLITE_BIN = "/usr/bin/sqlite3";
const PATH_SQLITE_BIN = "sqlite3";
const WINDOWS_PATH_SQLITE_BIN = "sqlite3.exe";

export function resolveSqliteBin(env: NodeJS.ProcessEnv = process.env): string {
  const configuredBin = env[SQLITE_BIN_ENV_KEY]?.trim();

  if (configuredBin !== undefined && configuredBin.length > 0) {
    return configuredBin;
  }

  if (existsSync(DEFAULT_POSIX_SQLITE_BIN)) {
    return DEFAULT_POSIX_SQLITE_BIN;
  }

  return process.platform === "win32" ? WINDOWS_PATH_SQLITE_BIN : PATH_SQLITE_BIN;
}
