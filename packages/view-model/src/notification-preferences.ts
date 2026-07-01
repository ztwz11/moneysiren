import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import {
  cloneNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseNotificationPreferences,
  type NotificationPreferenceFileOptions,
  type NotificationPreferences,
} from "./notification-preferences-model.js";
export {
  cloneNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_NOTIFICATION_THRESHOLD_RULES,
  DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  DEFAULT_DASHBOARD_WIDGET_LAYOUTS,
  DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
  HUD_BACKGROUND_NONE,
  DASHBOARD_VIEW_KEYS,
  DASHBOARD_WIDGET_KEYS_BY_VIEW,
  DASHBOARD_WIDGET_SIZES,
  HUD_DISPLAY_MODES,
  HUD_LABEL_MODES,
  LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  NOTIFICATION_WIDGET_KEYS,
  parseNotificationPreferences,
  type DashboardBudgetPreferences,
  type DashboardDisplayPreferences,
  type DashboardViewKey,
  type DashboardWidgetKey,
  type DashboardWidgetLayoutItem,
  type DashboardWidgetLayoutPreferences,
  type DashboardWidgetSize,
  type DigestInterval,
  type HudDisplayMode,
  type HudLabelMode,
  type LocalCliDashboardMetricKey,
  type NotificationPreferenceFileOptions,
  type NotificationPreferences,
  type NotificationThresholdRule,
  type NotificationWidgetKey,
  type ThresholdOperator,
} from "./notification-preferences-model.js";

const PREFERENCES_PATH_ENV = "MONEYSIREN_NOTIFICATION_PREFS_PATH";
const DEFAULT_PREFERENCES_PATH = ".moneysiren/notification-preferences.json";

export async function readNotificationPreferencesFile(
  options: NotificationPreferenceFileOptions = {},
): Promise<NotificationPreferences> {
  try {
    const parsed = JSON.parse(await readFile(resolveNotificationPreferencesPath(options), "utf8")) as unknown;

    return parseNotificationPreferences(parsed);
  } catch {
    return cloneNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
  }
}

export async function writeNotificationPreferencesFile(
  preferences: NotificationPreferences,
  options: NotificationPreferenceFileOptions = {},
): Promise<NotificationPreferences> {
  const normalized = parseNotificationPreferences(preferences);
  const path = resolveNotificationPreferencesPath(options);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}

export function resolveNotificationPreferencesPath(options: NotificationPreferenceFileOptions = {}): string {
  if (options.path !== undefined && options.path.trim().length > 0) {
    return resolveLocalPath(options.path, options.cwd);
  }

  const configuredPath = options.env?.[PREFERENCES_PATH_ENV]?.trim();

  if (configuredPath !== undefined && configuredPath.length > 0) {
    return resolveLocalPath(configuredPath, options.cwd);
  }

  return resolveLocalPath(DEFAULT_PREFERENCES_PATH, options.cwd);
}

function resolveLocalPath(path: string, cwd = process.cwd()): string {
  return isAbsolute(path) ? path : join(cwd, path);
}
