import { describe, expect, it } from "vitest";
import { normalizeHudRoutePath } from "./hud-navigation";

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
});
