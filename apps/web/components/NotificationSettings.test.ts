import { describe, expect, it } from "vitest";
import { getMessages, LOCALES } from "../lib/i18n";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_NOTIFICATION_THRESHOLD_RULES,
  DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
  NOTIFICATION_WIDGET_KEYS,
} from "./NotificationSettingsModel";

describe("notification settings defaults", () => {
  it("keeps widget keys unique and labeled in every locale", () => {
    const widgetKeys = [...NOTIFICATION_WIDGET_KEYS].sort();

    expect(new Set(widgetKeys).size).toBe(widgetKeys.length);

    for (const locale of LOCALES) {
      const labels = getMessages(locale).notificationWidgets;

      expect(Object.keys(labels).sort()).toEqual(widgetKeys);

      for (const widgetKey of NOTIFICATION_WIDGET_KEYS) {
        expect(labels[widgetKey].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("uses known widgets for selected defaults and threshold rows", () => {
    const widgetKeys = new Set(NOTIFICATION_WIDGET_KEYS);

    for (const widgetKey of DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS) {
      expect(widgetKeys.has(widgetKey)).toBe(true);
    }

    for (const widgetKey of DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets) {
      expect(widgetKeys.has(widgetKey)).toBe(true);
    }

    for (const rule of DEFAULT_NOTIFICATION_THRESHOLD_RULES) {
      expect(widgetKeys.has(rule.widgetKey)).toBe(true);
      expect(rule.value).toBeGreaterThanOrEqual(0);
      expect(rule.cooldownMinutes).toBeGreaterThanOrEqual(0);
    }
  });
});
