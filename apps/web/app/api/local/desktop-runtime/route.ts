import { spawn, type ChildProcess } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { posix, win32 } from "node:path";
import {
  installedDesktopAppCandidates,
  resolveConfiguredDesktopAppPath,
} from "../../../../../../packages/runtime/src/index";
import { requireLocalSession } from "../../../../lib/local-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_BYTES = 4_096;
const DESKTOP_ENV_ALLOWLIST = [
  "APPDATA",
  "ComSpec",
  "COMSPEC",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_MESSAGES",
  "LOCALAPPDATA",
  "Path",
  "PATH",
  "ProgramData",
  "SystemRoot",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "USERPROFILE",
  "windir",
  "WINDIR",
] as const;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

interface DesktopHudLaunch {
  command: string;
  args: string[];
  cwd: string;
  kind: "desktop" | "dev-launcher";
}

let managedHudChild: ChildProcess | null = null;

export interface DesktopHudLaunchResolverOptions {
  cwd: string;
  env: Record<string, string | undefined>;
  execPath: string;
  platform: NodeJS.Platform;
  resolveRegularFile(path: string): string | null;
  resolveExecutableFile?(path: string): string | null;
}

export async function POST(request: Request): Promise<Response> {
  if (!hasExactLoopbackOrigin(request)) {
    return localError("Request must originate from this local dashboard.", 403);
  }

  try {
    requireLocalSession(request);
  } catch {
    return localError("Local session and CSRF token are required.", 403);
  }

  const body = await readRequestBody(request);
  const path = isRecord(body) && typeof body.path === "string"
    ? sanitizeHudRoutePath(body.path)
    : null;

  if (path === null) {
    return localError("A safe local HUD route path is required.", 400);
  }

  const requestOrigin = localRequestOrigin(request);

  if (requestOrigin === null) {
    return localError("Request must originate from this local dashboard.", 403);
  }

  const dashboardUrl = new URL(path, requestOrigin);

  try {
    await startDesktopHudRuntime({
      dashboardUrl: dashboardUrl.toString(),
      webBaseUrl: requestOrigin,
    });

    return Response.json({
      generatedAt: new Date().toISOString(),
      localOnly: true,
      secretsReturned: false,
      status: "starting",
    }, {
      status: 202,
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return localError("Failed to start the local desktop HUD runtime.", 500);
  }
}

export function resolveDesktopHudLaunch(options: DesktopHudLaunchResolverOptions): DesktopHudLaunch {
  const configuredValue = trimToNull(options.env.MONEYSIREN_DESKTOP_APP);
  const resolveExecutableFile = options.resolveExecutableFile ?? options.resolveRegularFile;

  if (configuredValue !== null) {
    if (!isSafeConfiguredDesktopPath(configuredValue, options.platform)) {
      throw new Error("Configured desktop runtime path is not allowed.");
    }

    const configuredPath = resolveConfiguredDesktopAppPath({
      cwd: options.cwd,
      env: options.env,
      platform: options.platform,
    });
    const executablePath = configuredPath === null
      ? null
      : resolveDesktopExecutable(configuredPath, options.platform, resolveExecutableFile);

    if (executablePath === null) {
      throw new Error("Configured desktop runtime was not found.");
    }

    return nativeDesktopLaunch(executablePath, options.platform);
  }

  for (const candidate of installedDesktopAppCandidates({
    env: options.env,
    platform: options.platform,
  })) {
    const executablePath = resolveDesktopExecutable(candidate, options.platform, resolveExecutableFile);

    if (executablePath !== null) {
      return nativeDesktopLaunch(executablePath, options.platform);
    }
  }

  const repoRoot = tryFindRepoRoot(options.cwd, options.platform, options.resolveRegularFile);

  if (desktopTrayMode(options.env) === "built") {
    if (repoRoot !== null) {
      const builtExecutable = findBuiltTrayExecutable(
        repoRoot,
        options.platform,
        resolveExecutableFile,
      );

      if (builtExecutable !== null) {
        return nativeDesktopLaunch(builtExecutable, options.platform);
      }
    }

    throw new Error("MoneySiren desktop runtime was not found.");
  }

  if (repoRoot === null) {
    throw new Error("MoneySiren repository root was not found.");
  }

  const paths = pathApi(options.platform);
  const launcherPath = paths.resolve(repoRoot, "tools/scripts/run-web-with-tray.mjs");

  if (options.resolveRegularFile(launcherPath) === null) {
    throw new Error("MoneySiren desktop runtime launcher was not found.");
  }

  return {
    command: options.execPath,
    args: [
      launcherPath,
      "--skip-web",
      "--desktop-mode",
      "hud",
      "--tray-mode",
      "dev",
    ],
    cwd: repoRoot,
    kind: "dev-launcher",
  };
}

async function readRequestBody(request: Request): Promise<unknown | null> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();

  if (contentType !== "application/json") {
    return null;
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BODY_BYTES) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function startDesktopHudRuntime(options: { dashboardUrl: string; webBaseUrl: string }): Promise<void> {
  const launch = resolveDesktopHudLaunch({
    cwd: process.cwd(),
    env: process.env,
    execPath: process.execPath,
    platform: process.platform,
    resolveExecutableFile: resolveExecutableRegularFile,
    resolveRegularFile,
  });
  const env = desktopProcessEnvironment(process.env, {
    MONEYSIREN_DESKTOP_MODE: "hud",
    MONEYSIREN_LOCALE: localeFromUrl(options.dashboardUrl) ?? "en",
    MONEYSIREN_WEB_URL: options.webBaseUrl,
  });

  if (launch.args.includes("--dashboard-url") === false && launch.args.includes("--tray-mode")) {
    launch.args.push("--dashboard-url", options.dashboardUrl);
  }

  await startDetachedProcess(launch.command, launch.args, launch.cwd, env, launch.kind === "desktop");
}

function desktopTrayMode(env: Record<string, string | undefined>): "dev" | "built" {
  return env.MONEYSIREN_DESKTOP_TRAY_MODE === "built" || env.NODE_ENV === "production"
    ? "built"
    : "dev";
}

function tryFindRepoRoot(
  startDirectory: string,
  platform: NodeJS.Platform,
  resolveFile: (path: string) => string | null,
): string | null {
  const paths = pathApi(platform);
  let current = paths.resolve(startDirectory);

  while (resolveFile(paths.resolve(current, "tools/scripts/run-web-with-tray.mjs")) === null) {
    const parent = paths.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }

  return current;
}

function findBuiltTrayExecutable(
  repoRoot: string,
  platform: NodeJS.Platform,
  resolveFile: (path: string) => string | null,
): string | null {
  const paths = pathApi(platform);
  const releaseDir = paths.resolve(repoRoot, "apps/tray/src-tauri/target/release");
  const candidates = platform === "darwin"
    ? [
        paths.resolve(releaseDir, "bundle/macos/MoneySiren Tray.app/Contents/MacOS/MoneySiren Tray"),
        paths.resolve(releaseDir, "moneysiren-tray"),
      ]
    : [paths.resolve(releaseDir, platform === "win32" ? "moneysiren-tray.exe" : "moneysiren-tray")];

  for (const candidate of candidates) {
    const executablePath = resolveDesktopExecutable(candidate, platform, resolveFile);

    if (executablePath !== null) {
      return executablePath;
    }
  }

  return null;
}

function resolveDesktopExecutable(
  candidate: string,
  platform: NodeJS.Platform,
  resolveFile: (path: string) => string | null,
): string | null {
  const executablePath = desktopExecutablePath(candidate, platform);

  if (executablePath === null) {
    return null;
  }

  const resolved = resolveFile(executablePath);

  return resolved !== null && desktopExecutablePath(resolved, platform) !== null ? resolved : null;
}

function desktopExecutablePath(candidate: string, platform: NodeJS.Platform): string | null {
  const paths = pathApi(platform);

  if (!isSafeAbsolutePath(candidate, platform)) {
    return null;
  }

  if (platform === "win32") {
    const fileName = win32.basename(candidate).toLowerCase();

    return isAllowedWindowsDesktopFileName(fileName)
      ? candidate
      : null;
  }

  if (platform === "darwin" && posix.basename(candidate) === "MoneySiren Tray.app") {
    return posix.join(candidate, "Contents", "MacOS", "MoneySiren Tray");
  }

  const fileName = paths.basename(candidate);

  return fileName === "moneysiren-tray" || fileName === "MoneySiren Tray" ? candidate : null;
}

function isAllowedWindowsDesktopFileName(fileName: string): boolean {
  return fileName === "moneysiren tray.exe" ||
    fileName === "moneysiren-tray.exe" ||
    /^moneysiren(?:[ ._-]tray)?_[a-z0-9.+-]+_[a-z0-9.+-]*portable\.exe$/i.test(fileName);
}

function isSafeConfiguredDesktopPath(value: string, platform: NodeJS.Platform): boolean {
  return isSafeAbsolutePath(value, platform) && desktopExecutablePath(value, platform) !== null;
}

function isSafeAbsolutePath(value: string, platform: NodeJS.Platform): boolean {
  if (platform === "win32") {
    return /^[A-Za-z]:[\\/]/.test(value) &&
      !value.startsWith("\\\\") &&
      !value.startsWith("\\\\?\\") &&
      !value.startsWith("\\\\.\\");
  }

  return posix.isAbsolute(value);
}

function nativeDesktopLaunch(executablePath: string, platform: NodeJS.Platform): DesktopHudLaunch {
  return {
    command: executablePath,
    args: [],
    cwd: pathApi(platform).dirname(executablePath),
    kind: "desktop",
  };
}

function resolveRegularFile(path: string): string | null {
  try {
    const stat = lstatSync(path);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      return null;
    }

    return realpathSync.native(path);
  } catch {
    return null;
  }
}

function resolveExecutableRegularFile(path: string): string | null {
  const resolved = resolveRegularFile(path);

  if (resolved === null) {
    return null;
  }

  try {
    if (process.platform !== "win32") {
      accessSync(resolved, constants.X_OK);
    }

    return resolved;
  } catch {
    return null;
  }
}

async function startDetachedProcess(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  replaceManagedHud: boolean,
): Promise<void> {
  if (replaceManagedHud && managedHudChild !== null && managedHudChild.exitCode === null && !managedHudChild.killed) {
    managedHudChild.kill();
    managedHudChild = null;
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      env,
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });

    if (replaceManagedHud) {
      managedHudChild = child;
      child.once("exit", () => {
        if (managedHudChild === child) {
          managedHudChild = null;
        }
      });
    }

    child.once("error", (error) => {
      if (managedHudChild === child) {
        managedHudChild = null;
      }
      rejectPromise(error);
    });
    child.once("spawn", () => {
      child.unref();
      resolvePromise();
    });
  });
}

function desktopProcessEnvironment(
  source: NodeJS.ProcessEnv,
  additions: Record<string, string>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: source.NODE_ENV,
  };

  for (const key of DESKTOP_ENV_ALLOWLIST) {
    const value = source[key];

    if (value !== undefined) {
      env[key] = value;
    }
  }

  return {
    ...env,
    ...additions,
  };
}

function hasExactLoopbackOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const requestOrigin = localRequestOrigin(request);

  if (origin === null || requestOrigin === null) {
    return false;
  }

  try {
    const originUrl = new URL(origin);

    return originUrl.origin === requestOrigin;
  } catch {
    return false;
  }
}

function localRequestOrigin(request: Request): string | null {
  const host = request.headers.get("host")?.trim();

  if (host === undefined || host.length === 0) {
    return null;
  }

  try {
    const hostUrl = new URL(`http://${host}`);

    return hostUrl.protocol === "http:" && isLoopbackHostname(hostUrl.hostname)
      ? hostUrl.origin
      : null;
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

function localeFromUrl(value: string): string | null {
  try {
    const parsedUrl = new URL(value);
    const queryLocale = parseLocaleHint(parsedUrl.searchParams.get("locale"));

    if (queryLocale !== null) {
      return queryLocale;
    }

    return parseLocaleHint(parsedUrl.pathname.split("/").filter(Boolean)[0]);
  } catch {
    return null;
  }
}

function parseLocaleHint(value: string | null | undefined): string | null {
  const primary = value?.trim().toLowerCase().replaceAll("_", "-").split("-")[0];

  return primary !== undefined && ["ko", "en", "ja", "zh", "es", "fr", "de"].includes(primary)
    ? primary
    : null;
}

function sanitizeHudRoutePath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || /[\u0000-\u001f\u007f]/.test(path)) {
    return null;
  }

  try {
    const parsed = new URL(path, "http://127.0.0.1");
    const entries = [...parsed.searchParams.entries()];

    if (parsed.origin !== "http://127.0.0.1" || parsed.pathname !== "/hud" || parsed.hash.length > 0) {
      return null;
    }

    if (entries.length === 0) {
      return "/hud";
    }

    if (entries.length !== 1 || entries[0]?.[0] !== "locale") {
      return null;
    }

    const locale = parseLocaleHint(entries[0][1]);

    return locale === null ? null : `/hud?locale=${locale}`;
  } catch {
    return null;
  }
}

function pathApi(platform: NodeJS.Platform): typeof posix | typeof win32 {
  return platform === "win32" ? win32 : posix;
}

function localError(error: string, status: number): Response {
  return Response.json({
    error,
    localOnly: true,
    secretsReturned: false,
  }, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
