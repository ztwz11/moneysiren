import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isLocalRequest } from "../../../../lib/local-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function POST(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) {
    return Response.json({
      error: "Request must originate from localhost.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  const body = await readRequestBody(request);
  const path = isRecord(body) && typeof body.path === "string"
    ? sanitizeHudRoutePath(body.path)
    : null;

  if (path === null) {
    return Response.json({
      error: "A safe local HUD route path is required.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  const requestUrl = new URL(request.url);
  const dashboardUrl = new URL(path, requestUrl.origin);

  try {
    startDesktopHudRuntime({
      dashboardUrl: dashboardUrl.toString(),
      webBaseUrl: requestUrl.origin,
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
    return Response.json({
      error: "Failed to start the local desktop HUD runtime.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    return JSON.parse(await request.text()) as unknown;
  } catch {
    return {};
  }
}

function startDesktopHudRuntime(options: { dashboardUrl: string; webBaseUrl: string }): void {
  const repoRoot = findRepoRoot(process.cwd());
  const env = {
    ...process.env,
    MONEYSIREN_DESKTOP_MODE: "hud",
    MONEYSIREN_LOCALE: localeFromUrl(options.dashboardUrl) ?? "en",
    MONEYSIREN_WEB_URL: options.webBaseUrl,
  };

  if (desktopTrayMode() === "built") {
    const executablePath = findBuiltTrayExecutable(repoRoot);

    if (!existsSync(executablePath)) {
      throw new Error("MoneySiren built desktop runtime was not found.");
    }

    startDetachedProcess(executablePath, [], repoRoot, env);
    return;
  }

  const launcherPath = resolve(repoRoot, "tools/scripts/run-web-with-tray.mjs");

  if (!existsSync(launcherPath)) {
    throw new Error("MoneySiren desktop runtime launcher was not found.");
  }

  startDetachedProcess(process.execPath, [
    launcherPath,
    "--skip-web",
    "--desktop-mode",
    "hud",
    "--tray-mode",
    "dev",
    "--dashboard-url",
    options.dashboardUrl,
  ], repoRoot, env);
}

function desktopTrayMode(): "dev" | "built" {
  return process.env.MONEYSIREN_DESKTOP_TRAY_MODE === "built" || process.env.NODE_ENV === "production"
    ? "built"
    : "dev";
}

function findRepoRoot(startDirectory: string): string {
  let current = resolve(startDirectory);

  while (!existsSync(resolve(current, "tools/scripts/run-web-with-tray.mjs"))) {
    const parent = dirname(current);

    if (parent === current) {
      throw new Error("MoneySiren repository root was not found.");
    }

    current = parent;
  }

  return current;
}

function findBuiltTrayExecutable(repoRoot: string): string {
  const releaseDir = resolve(repoRoot, "apps/tray/src-tauri/target/release");

  if (process.platform === "win32") {
    return resolve(releaseDir, "moneysiren-tray.exe");
  }

  if (process.platform === "darwin") {
    const appExecutable = resolve(releaseDir, "bundle/macos/MoneySiren Tray.app/Contents/MacOS/MoneySiren Tray");

    return existsSync(appExecutable) ? appExecutable : resolve(releaseDir, "moneysiren-tray");
  }

  return resolve(releaseDir, "moneysiren-tray");
}

function startDetachedProcess(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    env,
    stdio: "ignore",
    windowsHide: true,
  });

  child.unref();
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
  if (!path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  if (/[\u0000-\u001f\u007f]/.test(path)) {
    return null;
  }

  return path === "/hud" || path.startsWith("/hud?") ? path : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
