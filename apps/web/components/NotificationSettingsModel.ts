import {
  NOTIFICATION_WIDGET_KEYS,
  type NotificationWidgetKey,
} from "../../../packages/view-model/src/notification-preferences-model";

export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_NOTIFICATION_THRESHOLD_RULES,
  DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS,
  DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  DEFAULT_DASHBOARD_WIDGET_LAYOUTS,
  DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
  COST_NOTIFICATION_WIDGET_KEYS,
  DASHBOARD_VIEW_KEYS,
  DASHBOARD_WIDGET_KEYS_BY_VIEW,
  DASHBOARD_WIDGET_SIZES,
  HUD_BACKGROUND_NONE,
  HUD_DISPLAY_MODES,
  HUD_LABEL_MODES,
  LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  NOTIFICATION_WIDGET_KEYS,
  NOTIFICATION_THRESHOLD_MODES,
  USAGE_NOTIFICATION_WIDGET_KEYS,
  type NotificationAggregateThresholdRule,
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
  type NotificationPreferences,
  type NotificationThresholdCategoryPreferences,
  type NotificationThresholdMode,
  type NotificationThresholdRule as NotificationThresholdDraft,
  type NotificationThresholdSettings,
  type NotificationWidgetKey,
  type ThresholdOperator,
} from "../../../packages/view-model/src/notification-preferences-model";

export function parseOptionalNonNegativeNumber(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseOptionalNonNegativeInteger(value: string): number | null {
  const parsed = parseOptionalNonNegativeNumber(value);

  return parsed === null ? null : Math.round(parsed);
}

export function orderHudWidgetCards(
  selectedWidgets: readonly NotificationWidgetKey[],
): NotificationWidgetKey[] {
  const selectedWidgetSet = new Set(selectedWidgets);

  return [
    ...selectedWidgets,
    ...NOTIFICATION_WIDGET_KEYS.filter((widgetKey) => !selectedWidgetSet.has(widgetKey)),
  ];
}

export function reorderHudSelectedWidgets(
  selectedWidgets: readonly NotificationWidgetKey[],
  sourceWidget: NotificationWidgetKey,
  targetWidget: NotificationWidgetKey,
): NotificationWidgetKey[] {
  const sourceIndex = selectedWidgets.indexOf(sourceWidget);
  const targetIndex = selectedWidgets.indexOf(targetWidget);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return [...selectedWidgets];
  }

  const reorderedWidgets = [...selectedWidgets];
  reorderedWidgets.splice(sourceIndex, 1);
  reorderedWidgets.splice(targetIndex, 0, sourceWidget);

  return reorderedWidgets;
}
