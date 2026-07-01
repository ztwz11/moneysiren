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
  "codex_reset_credit_count",
  "codex_reset_credit_expiry",
  "supabase_usage_health",
  "cloudflare_month_to_date",
] as const;

export const LOCAL_CLI_DASHBOARD_METRIC_KEYS = [
  "context_percent",
  "last_request_tokens",
  "total_tokens",
  "five_hour_limit_percent",
  "weekly_limit_percent",
  "five_hour_remaining_tokens",
  "weekly_remaining_tokens",
  "usage_reset_credits",
  "usage_reset_credit_estimate",
  "context_tokens",
  "input_tokens",
  "output_tokens",
  "cache_tokens",
  "reasoning_tokens",
  "sessions",
  "turns",
  "tool_calls",
  "log_files",
] as const;

export const DASHBOARD_VIEW_KEYS = ["overview", "today", "forecast", "risks"] as const;
export const DASHBOARD_WIDGET_SIZES = ["compact", "normal", "wide", "full"] as const;
export const HUD_DISPLAY_MODES = ["rows", "cells", "singleLine"] as const;
export const HUD_LABEL_MODES = ["text", "icon"] as const;
export const HUD_BACKGROUND_NONE = "transparent";
export const DASHBOARD_WIDGET_KEYS_BY_VIEW = {
  overview: [
    "overview_meta",
    "overview_metrics",
    "overview_trend",
    "overview_grouping",
    "overview_services",
    "overview_insights",
  ],
  today: [
    "today_main",
    "today_rail",
  ],
  forecast: [
    "forecast_metrics",
    "forecast_table",
    "forecast_breakdown",
  ],
  risks: [
    "risks_summary",
    "risks_table",
  ],
} as const;

export type NotificationWidgetKey = (typeof NOTIFICATION_WIDGET_KEYS)[number];
export type LocalCliDashboardMetricKey = (typeof LOCAL_CLI_DASHBOARD_METRIC_KEYS)[number];
export type DashboardViewKey = (typeof DASHBOARD_VIEW_KEYS)[number];
export type DashboardWidgetSize = (typeof DASHBOARD_WIDGET_SIZES)[number];
export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS_BY_VIEW)[DashboardViewKey][number];
export type HudDisplayMode = (typeof HUD_DISPLAY_MODES)[number];
export type HudLabelMode = (typeof HUD_LABEL_MODES)[number];
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
  dashboard: DashboardDisplayPreferences;
  hud: HudPreferences;
}

export interface DashboardBudgetPreferences {
  monthlyBudgetMinor: number | null;
  currency: string;
  warningPercent: number;
  criticalPercent: number;
}

export interface DashboardDisplayPreferences {
  localCliMetricKeys: readonly LocalCliDashboardMetricKey[];
  budget: DashboardBudgetPreferences;
  widgetLayouts: DashboardWidgetLayoutPreferences;
}

export type DashboardWidgetLayoutPreferences = {
  readonly [ViewKey in DashboardViewKey]: readonly DashboardWidgetLayoutItem[];
};

export interface DashboardWidgetLayoutItem {
  widgetKey: DashboardWidgetKey;
  visible: boolean;
  size: DashboardWidgetSize;
}

export interface HudPreferences {
  alwaysOnTop: boolean;
  backgroundColor: string;
  displayMode: HudDisplayMode;
  fontColor: string;
  fontScale: number;
  labelMode: HudLabelMode;
  opacity: number;
  padding: number;
  rowHeight: number;
  showRemainingPercent: boolean;
  showUsagePercent: boolean;
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
  "codex_reset_credit_count",
  "codex_reset_credit_expiry",
];

const LEGACY_SELECTED_NOTIFICATION_WIDGET_KEY_SETS: readonly (readonly NotificationWidgetKey[])[] = [
  [
    "month_forecast",
    "today_live_cost",
    "risk_high_count",
    "stale_connection_count",
    "openai_today_tokens",
    "codex_five_hour_percent",
  ],
  [
    "month_forecast",
    "today_live_cost",
    "risk_high_count",
    "stale_connection_count",
    "openai_today_tokens",
    "codex_five_hour_percent",
    "codex_reset_credit_expiry",
  ],
];

export const DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS: readonly LocalCliDashboardMetricKey[] = [
  "context_percent",
  "last_request_tokens",
  "total_tokens",
  "usage_reset_credits",
];

export const DEFAULT_DASHBOARD_WIDGET_LAYOUTS: DashboardWidgetLayoutPreferences = {
  overview: defaultDashboardWidgetLayout("overview"),
  today: defaultDashboardWidgetLayout("today"),
  forecast: defaultDashboardWidgetLayout("forecast"),
  risks: defaultDashboardWidgetLayout("risks"),
};

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
  dashboard: {
    localCliMetricKeys: DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
    widgetLayouts: DEFAULT_DASHBOARD_WIDGET_LAYOUTS,
    budget: {
      monthlyBudgetMinor: null,
      currency: "USD",
      warningPercent: 80,
      criticalPercent: 100,
    },
  },
  hud: {
    alwaysOnTop: true,
    backgroundColor: "#ffffff",
    displayMode: "rows",
    fontColor: "#1f2937",
    fontScale: 0.95,
    labelMode: "text",
    opacity: 0.94,
    padding: 6,
    rowHeight: 40,
    showRemainingPercent: false,
    showUsagePercent: true,
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
    dashboard: parseDashboardDisplayPreferences(value.dashboard),
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
    dashboard: parseDashboardDisplayPreferences(preferences.dashboard),
    hud: parseHudPreferences(preferences.hud),
  };
}

function parseDashboardDisplayPreferences(value: unknown): DashboardDisplayPreferences {
  const record = isRecord(value) ? value : {};

  return {
    localCliMetricKeys: parseLocalCliDashboardMetricKeys(record.localCliMetricKeys),
    budget: parseDashboardBudgetPreferences(record.budget),
    widgetLayouts: parseDashboardWidgetLayouts(record.widgetLayouts),
  };
}

function parseDashboardWidgetLayouts(value: unknown): DashboardWidgetLayoutPreferences {
  const record = isRecord(value) ? value : {};

  return {
    overview: parseDashboardWidgetLayout("overview", record.overview),
    today: parseDashboardWidgetLayout("today", record.today),
    forecast: parseDashboardWidgetLayout("forecast", record.forecast),
    risks: parseDashboardWidgetLayout("risks", record.risks),
  };
}

function parseDashboardWidgetLayout(
  viewKey: DashboardViewKey,
  value: unknown,
): readonly DashboardWidgetLayoutItem[] {
  const validWidgetKeys = new Set<DashboardWidgetKey>(DASHBOARD_WIDGET_KEYS_BY_VIEW[viewKey]);
  const defaults = defaultDashboardWidgetLayout(viewKey);
  const defaultByKey = new Map(defaults.map((item) => [item.widgetKey, item]));
  const parsed = Array.isArray(value)
    ? value
        .map((item): DashboardWidgetLayoutItem | null => {
          if (!isRecord(item) || typeof item.widgetKey !== "string" || !validWidgetKeys.has(item.widgetKey as DashboardWidgetKey)) {
            return null;
          }

          const widgetKey = item.widgetKey as DashboardWidgetKey;
          const fallback = defaultByKey.get(widgetKey);

          return {
            widgetKey,
            visible: typeof item.visible === "boolean" ? item.visible : fallback?.visible ?? true,
            size: parseDashboardWidgetSize(item.size, fallback?.size ?? "normal"),
          };
        })
        .filter((item): item is DashboardWidgetLayoutItem => item !== null)
    : [];
  const seen = new Set<DashboardWidgetKey>();
  const normalized = parsed.filter((item) => {
    if (seen.has(item.widgetKey)) {
      return false;
    }

    seen.add(item.widgetKey);
    return true;
  });
  const missing = defaults.filter((item) => !seen.has(item.widgetKey));

  return [...normalized, ...missing];
}

function defaultDashboardWidgetLayout(viewKey: DashboardViewKey): DashboardWidgetLayoutItem[] {
  return DASHBOARD_WIDGET_KEYS_BY_VIEW[viewKey].map((widgetKey) => ({
    widgetKey,
    visible: true,
    size: defaultDashboardWidgetSize(widgetKey),
  }));
}

function defaultDashboardWidgetSize(widgetKey: DashboardWidgetKey): DashboardWidgetSize {
  if (widgetKey === "overview_metrics" || widgetKey === "overview_services" || widgetKey === "risks_table") {
    return "full";
  }

  if (widgetKey === "today_main" || widgetKey === "forecast_table") {
    return "wide";
  }

  if (widgetKey === "forecast_breakdown" || widgetKey === "today_rail") {
    return "compact";
  }

  return "normal";
}

function parseDashboardWidgetSize(value: unknown, fallback: DashboardWidgetSize): DashboardWidgetSize {
  return typeof value === "string" && DASHBOARD_WIDGET_SIZES.includes(value as DashboardWidgetSize)
    ? value as DashboardWidgetSize
    : fallback;
}

function parseDashboardBudgetPreferences(value: unknown): DashboardBudgetPreferences {
  const record = isRecord(value) ? value : {};
  const monthlyBudgetMinor = parseOptionalPositiveInteger(record.monthlyBudgetMinor);
  const warningPercent = clampNumber(
    record.warningPercent,
    1,
    999,
    DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget.warningPercent,
  );
  const criticalPercent = clampNumber(
    record.criticalPercent,
    warningPercent,
    999,
    DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget.criticalPercent,
  );

  return {
    monthlyBudgetMinor,
    currency: parseCurrency(record.currency, DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget.currency),
    warningPercent,
    criticalPercent,
  };
}

function parseHudPreferences(
  value: unknown,
  fallbackSelectedWidgets: readonly NotificationWidgetKey[] = DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets,
): HudPreferences {
  const record = isRecord(value) ? value : {};
  const percentDisplay = parseHudPercentDisplay(record);

  return {
    alwaysOnTop: typeof record.alwaysOnTop === "boolean"
      ? record.alwaysOnTop
      : DEFAULT_NOTIFICATION_PREFERENCES.hud.alwaysOnTop,
    backgroundColor: parseHudBackgroundColor(record.backgroundColor, DEFAULT_NOTIFICATION_PREFERENCES.hud.backgroundColor),
    displayMode: parseHudDisplayMode(record.displayMode),
    fontColor: parseHexColor(record.fontColor, DEFAULT_NOTIFICATION_PREFERENCES.hud.fontColor),
    fontScale: clampNumber(record.fontScale, 0.8, 1.3, DEFAULT_NOTIFICATION_PREFERENCES.hud.fontScale),
    labelMode: parseHudLabelMode(record.labelMode),
    opacity: clampNumber(record.opacity, 0, 1, DEFAULT_NOTIFICATION_PREFERENCES.hud.opacity),
    padding: clampNumber(record.padding, 0, 18, DEFAULT_NOTIFICATION_PREFERENCES.hud.padding),
    rowHeight: clampNumber(record.rowHeight, 28, 76, DEFAULT_NOTIFICATION_PREFERENCES.hud.rowHeight),
    showRemainingPercent: percentDisplay.showRemainingPercent,
    showUsagePercent: percentDisplay.showUsagePercent,
    selectedWidgets: parseSelectedWidgets(record.selectedWidgets, fallbackSelectedWidgets),
  };
}

function parseHudPercentDisplay(record: Record<string, unknown>): Pick<HudPreferences, "showRemainingPercent" | "showUsagePercent"> {
  const requestedUsage = typeof record.showUsagePercent === "boolean"
    ? record.showUsagePercent
    : DEFAULT_NOTIFICATION_PREFERENCES.hud.showUsagePercent;
  const requestedRemaining = typeof record.showRemainingPercent === "boolean"
    ? record.showRemainingPercent
    : DEFAULT_NOTIFICATION_PREFERENCES.hud.showRemainingPercent;

  if (requestedRemaining && !requestedUsage) {
    return {
      showRemainingPercent: true,
      showUsagePercent: false,
    };
  }

  return {
    showRemainingPercent: false,
    showUsagePercent: true,
  };
}

function parseHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();

  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
}

function parseHudBackgroundColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().toLowerCase() === HUD_BACKGROUND_NONE) {
    return HUD_BACKGROUND_NONE;
  }

  return parseHexColor(value, fallback);
}

function parseHudDisplayMode(value: unknown): HudDisplayMode {
  if (value === "summary") {
    return "singleLine";
  }

  return typeof value === "string" && HUD_DISPLAY_MODES.includes(value as HudDisplayMode)
    ? value as HudDisplayMode
    : DEFAULT_NOTIFICATION_PREFERENCES.hud.displayMode;
}

function parseHudLabelMode(value: unknown): HudLabelMode {
  return typeof value === "string" && HUD_LABEL_MODES.includes(value as HudLabelMode)
    ? value as HudLabelMode
    : DEFAULT_NOTIFICATION_PREFERENCES.hud.labelMode;
}

function parseLocalCliDashboardMetricKeys(
  value: unknown,
  fallbackMetricKeys: readonly LocalCliDashboardMetricKey[] = DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
): readonly LocalCliDashboardMetricKey[] {
  const metricKeys = new Set(LOCAL_CLI_DASHBOARD_METRIC_KEYS);
  const selected = Array.isArray(value)
    ? value.filter((item): item is LocalCliDashboardMetricKey =>
        typeof item === "string" && metricKeys.has(item as LocalCliDashboardMetricKey)
      )
    : [...fallbackMetricKeys];

  return selected.length === 0 ? [...fallbackMetricKeys] : [...new Set(selected)];
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

  if (selected.length === 0) {
    return [...fallbackSelectedWidgets];
  }

  const uniqueSelected = [...new Set(selected)];

  return isLegacySelectedWidgetDefault(uniqueSelected)
    ? [...DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS]
    : migrateSelectedWidgets(uniqueSelected);
}

function migrateSelectedWidgets(selectedWidgets: readonly NotificationWidgetKey[]): NotificationWidgetKey[] {
  if (
    !selectedWidgets.includes("codex_reset_credit_expiry") ||
    selectedWidgets.includes("codex_reset_credit_count")
  ) {
    return [...selectedWidgets];
  }

  const migrated: NotificationWidgetKey[] = [];

  for (const widgetKey of selectedWidgets) {
    if (widgetKey === "codex_reset_credit_expiry") {
      migrated.push("codex_reset_credit_count");
    }

    migrated.push(widgetKey);
  }

  return migrated;
}

function isLegacySelectedWidgetDefault(selectedWidgets: readonly NotificationWidgetKey[]): boolean {
  return LEGACY_SELECTED_NOTIFICATION_WIDGET_KEY_SETS.some((legacySet) =>
    legacySet.length === selectedWidgets.length &&
    legacySet.every((widgetKey, index) => selectedWidgets[index] === widgetKey)
  );
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

function parseOptionalPositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}

function parseCurrency(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
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
