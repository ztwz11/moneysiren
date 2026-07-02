import { describe, expect, it } from "vitest";
import { getMessages, LOCALES } from "../lib/i18n";
import {
  COST_NOTIFICATION_WIDGET_KEYS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_NOTIFICATION_THRESHOLD_RULES,
  DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS,
  DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
  LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  NOTIFICATION_THRESHOLD_MODES,
  NOTIFICATION_WIDGET_KEYS,
  USAGE_NOTIFICATION_WIDGET_KEYS,
  parseOptionalNonNegativeInteger,
  parseOptionalNonNegativeNumber,
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
    const metricKeys = new Set(LOCAL_CLI_DASHBOARD_METRIC_KEYS);
    const thresholdModes = new Set(NOTIFICATION_THRESHOLD_MODES);

    for (const widgetKey of DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS) {
      expect(widgetKeys.has(widgetKey)).toBe(true);
    }

    for (const metricKey of DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS) {
      expect(metricKeys.has(metricKey)).toBe(true);
    }

    for (const widgetKey of COST_NOTIFICATION_WIDGET_KEYS) {
      expect(widgetKeys.has(widgetKey)).toBe(true);
    }

    for (const widgetKey of USAGE_NOTIFICATION_WIDGET_KEYS) {
      expect(widgetKeys.has(widgetKey)).toBe(true);
    }
    expect(USAGE_NOTIFICATION_WIDGET_KEYS).not.toContain("supabase_usage_health");

    expect(DEFAULT_NOTIFICATION_PREFERENCES.dashboard.localCliMetricKeys).toEqual(
      DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
    );
    expect(DEFAULT_NOTIFICATION_PREFERENCES.thresholdSettings).toEqual(DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS);
    expect(thresholdModes.has(DEFAULT_NOTIFICATION_PREFERENCES.thresholdSettings.cost.mode)).toBe(true);
    expect(thresholdModes.has(DEFAULT_NOTIFICATION_PREFERENCES.thresholdSettings.usage.mode)).toBe(true);

    for (const widgetKey of DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets) {
      expect(widgetKeys.has(widgetKey)).toBe(true);
    }

    for (const rule of DEFAULT_NOTIFICATION_THRESHOLD_RULES) {
      expect(widgetKeys.has(rule.widgetKey)).toBe(true);
      expect(rule.value).toBeGreaterThanOrEqual(0);
      expect(rule.cooldownMinutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not coerce invalid threshold input to zero", () => {
    expect(parseOptionalNonNegativeNumber("")).toBeNull();
    expect(parseOptionalNonNegativeNumber("   ")).toBeNull();
    expect(parseOptionalNonNegativeNumber("not-a-number")).toBeNull();
    expect(parseOptionalNonNegativeNumber("-1")).toBeNull();
    expect(parseOptionalNonNegativeNumber("0")).toBe(0);
    expect(parseOptionalNonNegativeNumber("12.5")).toBe(12.5);

    expect(parseOptionalNonNegativeInteger("")).toBeNull();
    expect(parseOptionalNonNegativeInteger("-15")).toBeNull();
    expect(parseOptionalNonNegativeInteger("0")).toBe(0);
    expect(parseOptionalNonNegativeInteger("12.7")).toBe(13);
  });
});
