export async function openHudDashboardRoute(href: string): Promise<boolean> {
  const routePath = normalizeHudRoutePath(href);

  if (routePath === null || typeof window === "undefined") {
    return false;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_dashboard_route_external", { urlPath: routePath });
    return true;
  } catch {
    // Browser-only HUD previews and older desktop shells do not expose this command.
  }

  const targetUrl = new URL(routePath, window.location.origin);
  const opened = window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");

  if (opened !== null) {
    opened.focus();
    return true;
  }

  return false;
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
