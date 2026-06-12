export const NOTIFICATION_WIDGET_KEYS = [
  "month_forecast",
  "today_live_cost",
  "risk_high_count",
  "stale_connection_count",
  "aws_month_forecast",
  "openai_today_cost",
  "openai_today_tokens",
  "claude_five_hour_percent",
  "claude_weekly_percent",
  "codex_five_hour_percent",
  "codex_weekly_percent",
  "supabase_usage_health",
  "cloudflare_month_to_date",
] as const;

export type NotificationWidgetKey = (typeof NOTIFICATION_WIDGET_KEYS)[number];
export type ThresholdOperator = "gte" | "lte" | "eq";
export type DigestInterval = "six-hours" | "daily" | "weekly";

export interface NotificationThresholdRule {
  widgetKey: NotificationWidgetKey;
  operator: ThresholdOperator;
  value: number;
  cooldownMinutes: number;
}

export interface NotificationPreferences {
  enabled: boolean;
  digestEnabled: boolean;
  digestInterval: DigestInterval;
  quietHours: {
    start: string;
    end: string;
  };
  selectedWidgets: readonly NotificationWidgetKey[];
  thresholdRules: readonly NotificationThresholdRule[];
  desktopEnabled: boolean;
  hud: HudPreferences;
}

export interface HudPreferences {
  alwaysOnTop: boolean;
  fontScale: number;
  opacity: number;
  selectedWidgets: readonly NotificationWidgetKey[];
}

export interface NotificationPreferenceFileOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  path?: string;
}

export const DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS: readonly NotificationWidgetKey[] = [
  "month_forecast",
  "today_live_cost",
  "risk_high_count",
  "stale_connection_count",
  "openai_today_tokens",
  "codex_five_hour_percent",
];

export const DEFAULT_NOTIFICATION_THRESHOLD_RULES: readonly NotificationThresholdRule[] = [
  {
    widgetKey: "risk_high_count",
    operator: "gte",
    value: 1,
    cooldownMinutes: 60,
  },
  {
    widgetKey: "today_live_cost",
    operator: "gte",
    value: 10,
    cooldownMinutes: 180,
  },
  {
    widgetKey: "codex_weekly_percent",
    operator: "gte",
    value: 90,
    cooldownMinutes: 360,
  },
];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  digestEnabled: true,
  digestInterval: "daily",
  quietHours: {
    start: "22:00",
    end: "08:00",
  },
  selectedWidgets: DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
  thresholdRules: DEFAULT_NOTIFICATION_THRESHOLD_RULES,
  desktopEnabled: false,
  hud: {
    alwaysOnTop: true,
    fontScale: 0.95,
    opacity: 0.94,
    selectedWidgets: DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
  },
};

export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  if (!isRecord(value)) {
    return cloneNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
  }

  const selectedWidgets = parseSelectedWidgets(value.selectedWidgets);

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    digestEnabled: typeof value.digestEnabled === "boolean"
      ? value.digestEnabled
      : DEFAULT_NOTIFICATION_PREFERENCES.digestEnabled,
    digestInterval: parseDigestInterval(value.digestInterval),
    quietHours: parseQuietHours(value.quietHours),
    selectedWidgets,
    thresholdRules: parseThresholdRules(value.thresholdRules),
    desktopEnabled: typeof value.desktopEnabled === "boolean"
      ? value.desktopEnabled
      : DEFAULT_NOTIFICATION_PREFERENCES.desktopEnabled,
    hud: parseHudPreferences(value.hud, selectedWidgets),
  };
}

export function cloneNotificationPreferences(preferences: NotificationPreferences): NotificationPreferences {
  return {
    enabled: preferences.enabled,
    digestEnabled: preferences.digestEnabled,
    digestInterval: preferences.digestInterval,
    quietHours: {
      ...preferences.quietHours,
    },
    selectedWidgets: [...preferences.selectedWidgets],
    thresholdRules: preferences.thresholdRules.map((rule) => ({ ...rule })),
    desktopEnabled: preferences.desktopEnabled,
    hud: parseHudPreferences(preferences.hud),
  };
}

function parseHudPreferences(
  value: unknown,
  fallbackSelectedWidgets: readonly NotificationWidgetKey[] = DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets,
): HudPreferences {
  const record = isRecord(value) ? value : {};

  return {
    alwaysOnTop: typeof record.alwaysOnTop === "boolean"
      ? record.alwaysOnTop
      : DEFAULT_NOTIFICATION_PREFERENCES.hud.alwaysOnTop,
    fontScale: clampNumber(record.fontScale, 0.8, 1.3, DEFAULT_NOTIFICATION_PREFERENCES.hud.fontScale),
    opacity: clampNumber(record.opacity, 0, 1, DEFAULT_NOTIFICATION_PREFERENCES.hud.opacity),
    selectedWidgets: parseSelectedWidgets(record.selectedWidgets, fallbackSelectedWidgets),
  };
}

function parseDigestInterval(value: unknown): DigestInterval {
  return value === "six-hours" || value === "daily" || value === "weekly"
    ? value
    : DEFAULT_NOTIFICATION_PREFERENCES.digestInterval;
}

function parseQuietHours(value: unknown): NotificationPreferences["quietHours"] {
  const record = isRecord(value) ? value : {};

  return {
    start: parseTime(record.start, DEFAULT_NOTIFICATION_PREFERENCES.quietHours.start),
    end: parseTime(record.end, DEFAULT_NOTIFICATION_PREFERENCES.quietHours.end),
  };
}

function parseSelectedWidgets(
  value: unknown,
  fallbackSelectedWidgets: readonly NotificationWidgetKey[] = DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
): readonly NotificationWidgetKey[] {
  const widgetKeys = new Set(NOTIFICATION_WIDGET_KEYS);
  const selected = Array.isArray(value)
    ? value.filter((item): item is NotificationWidgetKey => typeof item === "string" && widgetKeys.has(item as NotificationWidgetKey))
    : [...fallbackSelectedWidgets];

  return selected.length === 0 ? [...fallbackSelectedWidgets] : [...new Set(selected)];
}

function parseThresholdRules(value: unknown): readonly NotificationThresholdRule[] {
  if (!Array.isArray(value)) {
    return DEFAULT_NOTIFICATION_THRESHOLD_RULES.map((rule) => ({ ...rule }));
  }

  const rules = value
    .map((item) => isRecord(item) ? item : null)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item): NotificationThresholdRule | null => {
      const widgetKey = parseWidgetKey(item.widgetKey);
      const operator = parseOperator(item.operator);
      const numericValue = parseNonNegativeNumber(item.value);
      const cooldownMinutes = parseNonNegativeNumber(item.cooldownMinutes);

      if (widgetKey === null || operator === null || numericValue === null || cooldownMinutes === null) {
        return null;
      }

      return {
        widgetKey,
        operator,
        value: numericValue,
        cooldownMinutes,
      };
    })
    .filter((item): item is NotificationThresholdRule => item !== null);

  return rules.length === 0 ? DEFAULT_NOTIFICATION_THRESHOLD_RULES.map((rule) => ({ ...rule })) : rules;
}

function parseWidgetKey(value: unknown): NotificationWidgetKey | null {
  return typeof value === "string" && NOTIFICATION_WIDGET_KEYS.includes(value as NotificationWidgetKey)
    ? value as NotificationWidgetKey
    : null;
}

function parseOperator(value: unknown): ThresholdOperator | null {
  return value === "gte" || value === "lte" || value === "eq" ? value : null;
}

function parseNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

function parseTime(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
