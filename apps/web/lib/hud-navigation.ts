import { startLocalDesktopHud } from "./local-client";

interface OpenHudDashboardRouteOptions {
  allowBrowserFallback?: boolean;
  preopenFallback?: boolean;
}

export async function openHudDashboardRoute(href: string, options: OpenHudDashboardRouteOptions = {}): Promise<boolean> {
  const routePath = normalizeHudRoutePath(href);

  if (routePath === null || typeof window === "undefined") {
    return false;
  }

  const allowBrowserFallback = options.allowBrowserFallback ?? true;
  const hudRoute = isHudRoutePath(routePath);
  const targetUrl = new URL(routePath, window.location.origin);
  const preopenedFallback = allowBrowserFallback && options.preopenFallback === true ? openFallbackWindow() : null;

  if (hudRoute && await openViaNativeHudWindow()) {
    preopenedFallback?.close();
    return true;
  }

  if (hudRoute && !allowBrowserFallback && await startDesktopHudRuntime(routePath)) {
    return true;
  }

  if (!hudRoute && await openViaLocalRuntime(routePath)) {
    preopenedFallback?.close();
    return true;
  }

  if (!hudRoute) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_dashboard_url_external", { url: targetUrl.toString() });
      preopenedFallback?.close();
      return true;
    } catch {
      // Older desktop shells do not expose the URL-aware command.
    }

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_dashboard_route_external", { urlPath: routePath });

      if (preopenedFallback !== null) {
        preopenedFallback.location.href = targetUrl.toString();
        preopenedFallback.focus();
      }

      return true;
    } catch {
      // Browser-only HUD previews and older desktop shells do not expose this command.
    }
  }

  if (preopenedFallback !== null) {
    preopenedFallback.location.href = targetUrl.toString();
    preopenedFallback.focus();
    return true;
  }

  if (!allowBrowserFallback) {
    return false;
  }

  const opened = openFallbackWindow(targetUrl.toString());

  if (opened !== null) {
    opened.focus();
    return true;
  }

  return false;
}

async function openViaNativeHudWindow(): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("show_hud_window");
    return true;
  } catch {
    return false;
  }
}

async function openViaLocalRuntime(routePath: string): Promise<boolean> {
  try {
    const response = await fetch("/api/local/open-external", {
      body: JSON.stringify({ path: routePath }),
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function startDesktopHudRuntime(routePath: string): Promise<boolean> {
  try {
    return await startLocalDesktopHud(routePath);
  } catch {
    return false;
  }
}

function openFallbackWindow(url = "about:blank"): Window | null {
  const opened = window.open(url, "_blank");

  if (opened !== null) {
    opened.opener = null;
  }

  return opened;
}

export function normalizeHudRoutePath(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return null;
  }

  if (/[\u0000-\u001f\u007f]/.test(href)) {
    return null;
  }

  return href;
}

export function isHudRoutePath(routePath: string): boolean {
  return routePath === "/hud" || routePath.startsWith("/hud?");
}
