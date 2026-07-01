import { describe, expect, it } from "vitest";
import { NOTIFICATION_WIDGET_KEYS } from "../components/NotificationSettingsModel";
import { buildHudCompactPreview, HUD_WIDGET_DISPLAY_EXAMPLES } from "./hud-display-options";

describe("HUD display options", () => {
  it("defines compact examples for every HUD widget", () => {
    expect(Object.keys(HUD_WIDGET_DISPLAY_EXAMPLES).sort()).toEqual([...NOTIFICATION_WIDGET_KEYS].sort());

    for (const widgetKey of NOTIFICATION_WIDGET_KEYS) {
      const option = HUD_WIDGET_DISPLAY_EXAMPLES[widgetKey];

      expect(option.shortLabel.trim().length).toBeGreaterThan(0);
      expect(option.example.trim().length).toBeGreaterThan(0);
    }
  });

  it("builds the full-name one-line preview", () => {
    expect(buildHudCompactPreview([
      "codex_five_hour_percent",
      "codex_weekly_percent",
      "codex_reset_credit_count",
    ])).toBe("Codex CLI 5h 78% · Codex CLI weekly 69% · Codex reset credits 2");
  });
});
