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
  const launcherPath = resolve(repoRoot, "tools/scripts/run-web-with-tray.mjs");

  if (!existsSync(launcherPath)) {
    throw new Error("MoneySiren desktop runtime launcher was not found.");
  }

  const child = spawn(process.execPath, [
    launcherPath,
    "--skip-web",
    "--desktop-mode",
    "hud",
    "--tray-mode",
    desktopTrayMode(),
    "--dashboard-url",
    options.dashboardUrl,
  ], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      MONEYSIREN_DESKTOP_MODE: "hud",
      MONEYSIREN_WEB_URL: options.webBaseUrl,
    },
    stdio: "ignore",
    windowsHide: true,
  });

  child.unref();
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
