import { afterEach, describe, expect, it, vi } from "vitest";
import { isHudRoutePath, normalizeHudRoutePath, openHudDashboardRoute } from "./hud-navigation";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {
    throw new Error("Native shell is unavailable.");
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HUD navigation", () => {
  it("accepts local dashboard route paths", () => {
    expect(normalizeHudRoutePath("/ko/settings/notifications")).toBe("/ko/settings/notifications");
    expect(normalizeHudRoutePath("/ko/services/codex-app?overlayFinal=2")).toBe("/ko/services/codex-app?overlayFinal=2");
  });

  it("rejects external and control-character routes", () => {
    expect(normalizeHudRoutePath("https://example.com")).toBeNull();
    expect(normalizeHudRoutePath("//example.com")).toBeNull();
    expect(normalizeHudRoutePath("/ko/settings/notifications\n")).toBeNull();
  });

  it("recognizes only the HUD surface as a native HUD route", () => {
    expect(isHudRoutePath("/hud")).toBe(true);
    expect(isHudRoutePath("/hud?locale=ko")).toBe(true);
    expect(isHudRoutePath("/ko/dashboard/overview")).toBe(false);
    expect(isHudRoutePath("/ko/settings/notifications")).toBe(false);
  });

  it("starts the desktop HUD runtime instead of opening a browser fallback for desktop HUD requests", async () => {
    const open = vi.fn();
    const fetch = vi.fn(async () => new Response("{}", { status: 202 }));
    vi.stubGlobal("window", {
      location: { origin: "http://127.0.0.1:3000" },
      open,
    });
    vi.stubGlobal("fetch", fetch);

    await expect(openHudDashboardRoute("/hud?locale=ko", { allowBrowserFallback: false })).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/local/desktop-runtime",
      expect.objectContaining({
        body: JSON.stringify({ path: "/hud?locale=ko" }),
        method: "POST",
      }),
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("does not open a browser fallback when the desktop HUD runtime cannot start", async () => {
    const open = vi.fn();
    const fetch = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("window", {
      location: { origin: "http://127.0.0.1:3000" },
      open,
    });
    vi.stubGlobal("fetch", fetch);

    await expect(openHudDashboardRoute("/hud?locale=ko", { allowBrowserFallback: false })).resolves.toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it("keeps browser HUD preview available when fallback is allowed", async () => {
    const fallbackWindow = {
      focus: vi.fn(),
      opener: null,
    };
    const open = vi.fn(() => fallbackWindow);
    const fetch = vi.fn();
    vi.stubGlobal("window", {
      location: { origin: "http://127.0.0.1:3000" },
      open,
    });
    vi.stubGlobal("fetch", fetch);

    await expect(openHudDashboardRoute("/hud?locale=ko")).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith("http://127.0.0.1:3000/hud?locale=ko", "_blank");
    expect(fallbackWindow.focus).toHaveBeenCalled();
  });
});
