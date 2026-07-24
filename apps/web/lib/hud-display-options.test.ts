import { describe, expect, it } from "vitest";
import { NOTIFICATION_WIDGET_KEYS } from "../components/NotificationSettingsModel";
import {
  buildHudCompactPreview,
  buildHudDisplayPreview,
  calculateHudSummaryScale,
  formatHudDateOnly,
  getHudWidgetDisplayExample,
  HUD_WIDGET_DISPLAY_EXAMPLES,
  shouldUseCompactHudIcons,
} from "./hud-display-options";

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
    ], { labelMode: "text", locale: "en", percentMode: "usage" })).toBe(
      "Codex 5h 22% · Codex weekly 31% · Codex reset credits 2",
    );
  });

  it("builds localized HUD mode previews from the actual selected display mode", () => {
    expect(buildHudDisplayPreview({
      displayMode: "rows",
      labelMode: "text",
      locale: "ko",
      percentMode: "usage",
      selectedWidgets: ["codex_five_hour_percent"],
    })).toBe("Codex · 5시간 | 사용 22%");

    expect(buildHudDisplayPreview({
      displayMode: "cells",
      labelMode: "icon",
      locale: "ko",
      percentMode: "remaining",
      selectedWidgets: ["codex_five_hour_percent"],
    })).toBe("[아이콘] 78%");
  });

  it("builds localized widget examples with the selected usage basis", () => {
    expect(getHudWidgetDisplayExample("codex_weekly_percent", {
      labelMode: "text",
      locale: "ko",
      percentMode: "remaining",
    })).toEqual({
      shortLabel: "Codex 1주",
      example: "Codex 1주 69%",
    });
  });

  it("shows reset-credit expiry as a language-free date only", () => {
    expect(getHudWidgetDisplayExample("codex_reset_credit_expiry", {
      labelMode: "text",
      locale: "ko",
    })).toEqual({
      shortLabel: "Codex 초기화권 만료일",
      example: "2026-08-11",
    });
    expect(formatHudDateOnly("2026-08-11T15:30:00.000Z")).toBe("2026-08-12");
    expect(formatHudDateOnly("not-a-date")).toBeNull();
  });

  it("fits a complete one-line summary without requesting truncation", () => {
    expect(calculateHudSummaryScale(320, 640)).toBe(0.5);
    expect(calculateHudSummaryScale(640, 320)).toBe(1);
    expect(calculateHudSummaryScale(0, 320)).toBe(1);
    expect(shouldUseCompactHudIcons(320, 640)).toBe(true);
    expect(shouldUseCompactHudIcons(500, 640)).toBe(false);
  });
});
