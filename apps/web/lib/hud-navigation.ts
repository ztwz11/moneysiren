interface OpenHudDashboardRouteOptions {
  preopenFallback?: boolean;
}

export async function openHudDashboardRoute(href: string, options: OpenHudDashboardRouteOptions = {}): Promise<boolean> {
  const routePath = normalizeHudRoutePath(href);

  if (routePath === null || typeof window === "undefined") {
    return false;
  }

  const targetUrl = new URL(routePath, window.location.origin);
  const preopenedFallback = options.preopenFallback === true ? openFallbackWindow() : null;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_dashboard_route_external", { urlPath: routePath });
    preopenedFallback?.close();
    return true;
  } catch {
    // Browser-only HUD previews and older desktop shells do not expose this command.
  }

  if (preopenedFallback !== null) {
    preopenedFallback.location.href = targetUrl.toString();
    preopenedFallback.focus();
    return true;
  }

  const opened = openFallbackWindow(targetUrl.toString());

  if (opened !== null) {
    opened.focus();
    return true;
  }

  return false;
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
