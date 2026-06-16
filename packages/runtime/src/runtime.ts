import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, posix, win32 } from "node:path";

export interface LocalRuntime {
  pid: number;
  port: number;
  baseUrl: string;
  startedAt: string;
  version: string;
}

export interface RuntimeLockOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  lockPath?: string;
  platform?: NodeJS.Platform;
}

export interface RuntimeHealthCheckOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const RUNTIME_LOCK_ENV_KEY = "MONEYSIREN_RUNTIME_LOCK_PATH";
const DEFAULT_HEALTH_TIMEOUT_MS = 2_000;

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.startsWith("127.")
  );
}

export function assertLoopbackHost(host: string): void {
  if (!isLoopbackHost(host)) {
    throw new Error("MoneySiren local runtime must bind to a loopback host.");
  }
}

export function resolveRuntimeLockPath(options: RuntimeLockOptions = {}): string {
  if (options.lockPath !== undefined && options.lockPath.trim().length > 0) {
    return resolveRuntimePath(options.lockPath, options.cwd);
  }

  const configuredPath = options.env?.[RUNTIME_LOCK_ENV_KEY]?.trim();

  if (configuredPath !== undefined && configuredPath.length > 0) {
    return resolveRuntimePath(configuredPath, options.cwd);
  }

  return defaultRuntimeLockPath(options.env ?? process.env, options.platform ?? process.platform);
}

export async function readRuntimeLock(options: RuntimeLockOptions = {}): Promise<LocalRuntime | null> {
  const lockPath = resolveRuntimeLockPath(options);

  try {
    const parsed = JSON.parse(await readFile(lockPath, "utf8")) as unknown;

    return parseRuntime(parsed);
  } catch {
    return null;
  }
}

export async function writeRuntimeLock(
  runtime: LocalRuntime,
  options: RuntimeLockOptions = {},
): Promise<string> {
  const parsedUrl = parseLoopbackUrl(runtime.baseUrl);

  if (parsedUrl.port !== String(runtime.port)) {
    throw new Error("Runtime lock baseUrl port must match the runtime port.");
  }

  const lockPath = resolveRuntimeLockPath(options);
  await mkdir(dirname(lockPath), { recursive: true });
  await writeFile(lockPath, `${JSON.stringify(runtime, null, 2)}\n`, "utf8");

  return lockPath;
}

export async function removeRuntimeLock(options: RuntimeLockOptions = {}): Promise<void> {
  await rm(resolveRuntimeLockPath(options), {
    force: true,
  });
}

export async function findRuntime(options: RuntimeLockOptions = {}): Promise<LocalRuntime | null> {
  const runtime = await readRuntimeLock(options);

  if (runtime === null) {
    return null;
  }

  if (!isProcessAlive(runtime.pid)) {
    await removeStaleRuntimeLock(options);
    return null;
  }

  return runtime;
}

export async function assertRuntimeHealthy(
  runtime: LocalRuntime,
  options: RuntimeHealthCheckOptions = {},
): Promise<boolean> {
  parseLoopbackUrl(runtime.baseUrl);

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${runtime.baseUrl}/api/local/health`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json() as { secretsReturned?: unknown };

    return payload.secretsReturned === false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function removeStaleRuntimeLock(options: RuntimeLockOptions): Promise<void> {
  try {
    await removeRuntimeLock(options);
  } catch {
    // A stale lock must not make status commands fail, especially after npm/global installs.
  }
}

function parseRuntime(value: unknown): LocalRuntime | null {
  if (!isRecord(value)) {
    return null;
  }

  const pid = value.pid;
  const port = value.port;
  const baseUrl = value.baseUrl;
  const startedAt = value.startedAt;
  const version = value.version;

  if (
    typeof pid !== "number" ||
    typeof port !== "number" ||
    typeof baseUrl !== "string" ||
    typeof startedAt !== "string" ||
    typeof version !== "string" ||
    !Number.isSafeInteger(pid) ||
    !Number.isSafeInteger(port)
  ) {
    return null;
  }

  try {
    parseLoopbackUrl(baseUrl);
  } catch {
    return null;
  }

  return {
    pid,
    port,
    baseUrl,
    startedAt,
    version,
  };
}

function parseLoopbackUrl(value: string): URL {
  const parsedUrl = new URL(value);

  if (parsedUrl.protocol !== "http:") {
    throw new Error("MoneySiren local runtime must use http on loopback.");
  }

  assertLoopbackHost(parsedUrl.hostname);

  return parsedUrl;
}

function resolveRuntimePath(path: string, cwd = process.cwd()): string {
  return isAbsolute(path) ? path : join(cwd, path);
}

function defaultRuntimeLockPath(env: Record<string, string | undefined>, platform: NodeJS.Platform): string {
  if (platform === "darwin") {
    return joinForPlatform(platform, resolveHomeDirectory(env), "Library", "Application Support", "MoneySiren", "runtime.json");
  }

  if (platform === "win32") {
    return joinForPlatform(platform, resolveWindowsAppDataDirectory(env), "MoneySiren", "runtime.json");
  }

  const configHome = trimToNull(env.XDG_CONFIG_HOME) ?? joinForPlatform(platform, resolveHomeDirectory(env), ".config");

  return joinForPlatform(platform, configHome, "moneysiren", "runtime.json");
}

function resolveWindowsAppDataDirectory(env: Record<string, string | undefined>): string {
  return trimToNull(env.APPDATA) ?? win32.join(resolveHomeDirectory(env), "AppData", "Roaming");
}

function resolveHomeDirectory(env: Record<string, string | undefined>): string {
  return trimToNull(env.HOME) ?? trimToNull(env.USERPROFILE) ?? homedir();
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function joinForPlatform(platform: NodeJS.Platform, ...segments: string[]): string {
  return platform === "win32" ? win32.join(...segments) : posix.join(...segments);
}

function isProcessAlive(pid: number): boolean {
  if (pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "EPERM") {
      return true;
    }

    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
