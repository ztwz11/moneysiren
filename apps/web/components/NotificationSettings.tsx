"use client";

import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import {
  BellRing,
  Clock3,
  GalleryHorizontalEnd,
  GripVertical,
  MonitorCheck,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import type { Locale, Messages } from "../lib/i18n";
import {
  COST_NOTIFICATION_WIDGET_KEYS,
  DEFAULT_NOTIFICATION_THRESHOLD_RULES,
  DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS,
  DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
  HUD_BACKGROUND_NONE,
  HUD_DISPLAY_MODES,
  HUD_LABEL_MODES,
  NOTIFICATION_THRESHOLD_MODES,
  NOTIFICATION_WIDGET_KEYS,
  USAGE_NOTIFICATION_WIDGET_KEYS,
  orderHudWidgetCards,
  parseOptionalNonNegativeInteger,
  parseOptionalNonNegativeNumber,
  reorderHudSelectedWidgets,
  type DigestInterval,
  type DashboardBudgetPreferences,
  type DashboardWidgetLayoutPreferences,
  type HudDisplayMode,
  type HudLabelMode,
  type LocalCliDashboardMetricKey,
  type NotificationAggregateThresholdRule,
  type NotificationPreferences,
  type NotificationThresholdDraft,
  type NotificationThresholdMode,
  type NotificationThresholdSettings,
  type NotificationWidgetKey,
  type ThresholdOperator,
} from "./NotificationSettingsModel";
import { withAppLoading } from "./AppLoadingOverlay";
import {
  buildHudDisplayPreview,
  getHudWidgetDisplayExample,
} from "../lib/hud-display-options";
import { dispatchDesktopPreferenceUpdate } from "../lib/desktop-preference-events";
import { openHudDashboardRoute } from "../lib/hud-navigation";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";
type ThresholdCategory = "cost" | "usage";
type IndexedThresholdRule = {
  index: number | null;
  rule: NotificationThresholdDraft;
};

const COST_NOTIFICATION_WIDGET_KEY_SET = new Set<NotificationWidgetKey>(COST_NOTIFICATION_WIDGET_KEYS);
const USAGE_NOTIFICATION_WIDGET_KEY_SET = new Set<NotificationWidgetKey>(USAGE_NOTIFICATION_WIDGET_KEYS);
const OTHER_NOTIFICATION_WIDGET_KEYS = NOTIFICATION_WIDGET_KEYS.filter((widgetKey) =>
  !COST_NOTIFICATION_WIDGET_KEY_SET.has(widgetKey) && !USAGE_NOTIFICATION_WIDGET_KEY_SET.has(widgetKey)
);

export function NotificationSettingsPanel({ locale, messages }: { locale: Locale; messages: Messages }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.enabled);
  const [digestEnabled, setDigestEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.digestEnabled);
  const [desktopEnabled, setDesktopEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.desktopEnabled);
  const [digestInterval, setDigestInterval] = useState<DigestInterval>(DEFAULT_NOTIFICATION_PREFERENCES.digestInterval);
  const [quietStart, setQuietStart] = useState(DEFAULT_NOTIFICATION_PREFERENCES.quietHours.start);
  const [quietEnd, setQuietEnd] = useState(DEFAULT_NOTIFICATION_PREFERENCES.quietHours.end);
  const [hudAlwaysOnTop, setHudAlwaysOnTop] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.alwaysOnTop);
  const [hudBackgroundColor, setHudBackgroundColor] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.backgroundColor);
  const [hudDisplayMode, setHudDisplayMode] = useState<HudDisplayMode>(DEFAULT_NOTIFICATION_PREFERENCES.hud.displayMode);
  const [hudFontColor, setHudFontColor] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.fontColor);
  const [hudFontScale, setHudFontScale] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.fontScale);
  const [hudLabelMode, setHudLabelMode] = useState<HudLabelMode>(DEFAULT_NOTIFICATION_PREFERENCES.hud.labelMode);
  const [hudOpacity, setHudOpacity] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.opacity);
  const [hudPadding, setHudPadding] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.padding);
  const [hudRowHeight, setHudRowHeight] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.rowHeight);
  const [hudShowRemainingPercent, setHudShowRemainingPercent] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.showRemainingPercent);
  const [hudShowUsagePercent, setHudShowUsagePercent] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.showUsagePercent);
  const [hudSelectedWidgets, setHudSelectedWidgets] = useState<NotificationWidgetKey[]>(
    [...DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets],
  );
  const [hudDraggedWidget, setHudDraggedWidget] = useState<NotificationWidgetKey | null>(null);
  const [hudDragTargetWidget, setHudDragTargetWidget] = useState<NotificationWidgetKey | null>(null);
  const [hudOrderAnnouncement, setHudOrderAnnouncement] = useState("");
  const [localCliDashboardMetricKeys, setLocalCliDashboardMetricKeys] = useState<LocalCliDashboardMetricKey[]>(
    [...DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS],
  );
  const [dashboardBudget, setDashboardBudget] = useState<DashboardBudgetPreferences>({
    ...DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget,
  });
  const [dashboardWidgetLayouts, setDashboardWidgetLayouts] = useState<DashboardWidgetLayoutPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES.dashboard.widgetLayouts,
  );
  const [selectedWidgets, setSelectedWidgets] = useState<NotificationWidgetKey[]>(
    [...DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS],
  );
  const [thresholdRules, setThresholdRules] = useState<NotificationThresholdDraft[]>(
    DEFAULT_NOTIFICATION_THRESHOLD_RULES.map((rule) => ({ ...rule })),
  );
  const [thresholdSettings, setThresholdSettings] = useState<NotificationThresholdSettings>(
    cloneThresholdSettings(DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS),
  );
  const [hudOpenPending, setHudOpenPending] = useState(false);
  const [hudOpenFailed, setHudOpenFailed] = useState(false);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [hudOpenMessage, setHudOpenMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [statusMessage, setStatusMessage] = useState(messages.settings.notificationStoredLocally);
  const hudBackgroundNone = hudBackgroundColor === HUD_BACKGROUND_NONE;
  const hudPercentModeIsRemaining = hudShowRemainingPercent && !hudShowUsagePercent;
  const hudPercentMode = hudPercentModeIsRemaining ? "remaining" : "usage";
  const hudPreviewText = buildHudDisplayPreview({
    displayMode: hudDisplayMode,
    labelMode: hudLabelMode,
    locale,
    percentMode: hudPercentMode,
    selectedWidgets: hudSelectedWidgets,
  });
  const hudPercentCopy = hudPercentDisplayCopy(locale);
  const orderedHudWidgetCards = orderHudWidgetCards(hudSelectedWidgets);

  useEffect(() => {
    let mounted = true;

    void loadNotificationPreferences().then((preferences) => {
      if (!mounted) {
        return;
      }

      applyPreferences(preferences);
      setStatusMessage(messages.settings.notificationStoredLocally);
      setSaveState("idle");
    }).catch(() => {
      if (!mounted) {
        return;
      }

      setStatusMessage(messages.settings.notificationPrefsLoadError);
      setSaveState("error");
    });

    return () => {
      mounted = false;
    };
  }, [messages.settings.notificationPrefsLoadError, messages.settings.notificationStoredLocally]);

  return (
    <div className="notification-settings stack">
      <section className="panel">
        <div className="panel-header compact-header">
          <div className="notification-title-line">
            <BellRing aria-hidden="true" size={17} strokeWidth={1.9} />
            <h2 className="panel-title">{messages.settings.notificationsMaster}</h2>
          </div>
          <div className="notification-header-actions">
            <span className={notificationsEnabled ? "badge badge-ok" : "badge badge-neutral"}>
              {notificationsEnabled ? messages.settings.notificationEnabled : messages.settings.notificationDisabled}
            </span>
            <button
              className="primary-button notification-save-button"
              disabled={saveState === "loading" || saveState === "saving"}
              onClick={() => {
                void saveNotificationPreferences();
              }}
              type="button"
            >
              {saveState === "saving" ? messages.settings.toolLoadingPreparingView : messages.settings.saveNotifications}
            </button>
          </div>
        </div>
        <p
          className={saveState === "error" ? "notification-save-status notification-save-status-error" : "notification-save-status"}
          role="status"
        >
          {saveState === "saved" ? messages.settings.notificationPrefsSaved : statusMessage}
        </p>
        <div className="panel-body notification-control-grid">
          <label className="notification-toggle-card">
            <input
              checked={notificationsEnabled}
              onChange={(event) => setNotificationsEnabled(event.currentTarget.checked)}
              type="checkbox"
            />
            <span className="toggle-switch" aria-hidden="true" />
            <span>
              <strong>{messages.settings.notificationsMaster}</strong>
              <span className="metric-meta">{messages.settings.notificationsMasterHelp}</span>
            </span>
          </label>
          <label className="notification-toggle-card">
            <input
              checked={digestEnabled}
              onChange={(event) => setDigestEnabled(event.currentTarget.checked)}
              type="checkbox"
            />
            <span className="toggle-switch" aria-hidden="true" />
            <span>
              <strong>{messages.settings.digestEnabled}</strong>
              <span className="metric-meta">{messages.settings.digestHelp}</span>
            </span>
          </label>
          <label className="notification-field">
            <span className="metric-label">{messages.settings.digestInterval}</span>
            <select
              className="notification-select"
              onChange={(event) => setDigestInterval(event.currentTarget.value as DigestInterval)}
              value={digestInterval}
            >
              <option value="six-hours">{messages.settings.digestEverySixHours}</option>
              <option value="daily">{messages.settings.digestDaily}</option>
              <option value="weekly">{messages.settings.digestWeekly}</option>
            </select>
          </label>
          <div className="notification-field">
            <span className="metric-label">{messages.settings.quietHours}</span>
            <div className="quiet-hours-grid" aria-label={messages.settings.quietHours}>
              <label>
                <span>{messages.settings.quietHoursStart}</span>
                <input
                  className="notification-input"
                  onChange={(event) => setQuietStart(event.currentTarget.value)}
                  type="time"
                  value={quietStart}
                />
              </label>
              <label>
                <span>{messages.settings.quietHoursEnd}</span>
                <input
                  className="notification-input"
                  onChange={(event) => setQuietEnd(event.currentTarget.value)}
                  type="time"
                  value={quietEnd}
                />
              </label>
            </div>
            <span className="metric-meta">{messages.settings.quietHoursHelp}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header compact-header">
          <div>
            <h2 className="panel-title">{messages.settings.widgetsTitle}</h2>
            <p className="metric-meta">{messages.settings.widgetsSubtitle}</p>
          </div>
          <span className="badge badge-live">{selectedWidgets.length}</span>
        </div>
        <div className="panel-body">
          <div className="notification-widget-grid" aria-label={messages.settings.widgetSelection}>
            {NOTIFICATION_WIDGET_KEYS.map((widgetKey) => {
              const selectedIndex = selectedWidgets.indexOf(widgetKey);
              const selected = selectedIndex >= 0;

              return (
                <label
                  className={selected ? "notification-widget-card" : "notification-widget-card notification-widget-card-muted"}
                  key={widgetKey}
                >
                  <input
                    checked={selected}
                    onChange={() => setSelectedWidgets((current) => toggleWidgetSelection(current, widgetKey))}
                    type="checkbox"
                  />
                  <span>
                    <strong>{messages.notificationWidgets[widgetKey]}</strong>
                    <span className="metric-meta">
                      {messages.settings.widgetOrder}: {selected ? selectedIndex + 1 : "-"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header compact-header">
          <div className="notification-title-line">
            <SlidersHorizontal aria-hidden="true" size={17} strokeWidth={1.9} />
            <h2 className="panel-title">{messages.settings.thresholdsTitle}</h2>
          </div>
          <span className="metric-meta">{messages.settings.notificationLocalOnly}</span>
        </div>
        <div className="panel-body">
          <p className="metric-meta notification-panel-note">{messages.settings.thresholdsSubtitle}</p>
          <div className="notification-threshold-groups">
            <ThresholdCategoryPanel
              aggregateRule={thresholdSettings.cost.aggregateRule}
              messages={messages}
              mode={thresholdSettings.cost.mode}
              onAggregateRuleChange={(update) => updateAggregateThresholdRule("cost", update)}
              onModeChange={(mode) => updateThresholdCategory("cost", { mode })}
              onRuleChange={updateThresholdRule}
              rules={thresholdRulesForCategory(thresholdRules, "cost")}
              title={messages.settings.thresholdCostTitle}
              widgetKeys={COST_NOTIFICATION_WIDGET_KEYS}
            />
            <ThresholdCategoryPanel
              aggregateRule={thresholdSettings.usage.aggregateRule}
              messages={messages}
              mode={thresholdSettings.usage.mode}
              onAggregateRuleChange={(update) => updateAggregateThresholdRule("usage", update)}
              onModeChange={(mode) => updateThresholdCategory("usage", { mode })}
              onRuleChange={updateThresholdRule}
              rules={thresholdRulesForCategory(thresholdRules, "usage")}
              title={messages.settings.thresholdUsageTitle}
              widgetKeys={USAGE_NOTIFICATION_WIDGET_KEYS}
            />
            <div className="notification-threshold-category">
              <div className="notification-threshold-category-header">
                <div>
                  <strong>{messages.settings.thresholdOtherTitle}</strong>
                  <span className="metric-meta">{messages.settings.thresholdIndividualOptions}</span>
                </div>
              </div>
              <ThresholdRulesPanel
                messages={messages}
                onRuleChange={updateThresholdRule}
                rules={thresholdRulesForOther(thresholdRules)}
                title={messages.settings.thresholdIndividualOptions}
                widgetKeys={OTHER_NOTIFICATION_WIDGET_KEYS}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header compact-header">
          <div className="notification-title-line">
            <MonitorCheck aria-hidden="true" size={17} strokeWidth={1.9} />
            <h2 className="panel-title">{messages.settings.desktopStatusTitle}</h2>
          </div>
          <span className={desktopEnabled ? "badge badge-ok" : "badge badge-neutral"}>
            {desktopEnabled ? messages.settings.notificationEnabled : messages.settings.notificationDisabled}
          </span>
        </div>
        <div className="panel-body notification-desktop-grid">
          <div className="notification-desktop-copy">
            <label className="notification-toggle-card">
              <input
                checked={desktopEnabled}
                onChange={(event) => {
                  const nextDesktopEnabled = event.currentTarget.checked;
                  setDesktopEnabled(nextDesktopEnabled);
                  dispatchDesktopPreferenceUpdate(nextDesktopEnabled);
                }}
                type="checkbox"
              />
              <span className="toggle-switch" aria-hidden="true" />
              <span>
                <strong>{messages.settings.desktopStatusTitle}</strong>
                <span className="metric-meta">{messages.settings.desktopAppInfo}</span>
              </span>
            </label>
            <KeyValueLine
              label={messages.settings.desktopStatus}
              value={desktopEnabled ? messages.settings.notificationEnabled : messages.settings.notificationDisabled}
            />
            <div className="notification-hud-controls">
              <div>
                <strong>{messages.settings.hudSettingsTitle}</strong>
                <span className="metric-meta">{messages.settings.hudSettingsSubtitle}</span>
              </div>
              <button
                className="secondary-button notification-hud-open-button"
                disabled={hudOpenPending}
                onClick={() => {
                  setHudOpenPending(true);
                  setHudOpenFailed(false);
                  setHudOpenMessage(messages.settings.toolLoadingPreparingView);
                  void openHudWindow(locale, desktopEnabled).then((opened) => {
                    if (!opened) {
                      setHudOpenFailed(true);
                      setHudOpenMessage(messages.settings.hudDesktopUnavailable);
                      setStatusMessage(messages.settings.hudDesktopUnavailable);
                      setSaveState("error");
                      return;
                    }

                    setHudOpenFailed(false);
                    setHudOpenMessage(desktopEnabled
                      ? messages.settings.hudDesktopOpenRequested
                      : messages.settings.hudBrowserPreviewOpened);
                  }).finally(() => {
                    setHudOpenPending(false);
                  });
                }}
                type="button"
              >
                <MonitorCheck aria-hidden="true" size={14} />
                <span>{messages.settings.hudOpenWindow}</span>
              </button>
              {hudOpenMessage === null ? null : (
                <p
                  className={
                    hudOpenFailed
                      ? "notification-hud-open-status notification-hud-open-status-error"
                      : "notification-hud-open-status"
                  }
                  role="status"
                >
                  {hudOpenMessage}
                </p>
              )}
              <label className="notification-field">
                <span className="metric-label">{hudDisplayControlCopy(locale).modeLabel}</span>
                <select
                  className="notification-select"
                  onChange={(event) => setHudDisplayMode(event.currentTarget.value as HudDisplayMode)}
                  value={hudDisplayMode}
                >
                  {HUD_DISPLAY_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {hudDisplayControlCopy(locale).modes[mode]}
                    </option>
                  ))}
                </select>
                <span className="metric-meta">{hudDisplayControlCopy(locale).modeHelp}</span>
              </label>
              <div className="notification-hud-mode-preview" aria-label={hudDisplayControlCopy(locale).previewLabel}>
                <GalleryHorizontalEnd aria-hidden="true" size={14} />
                <span>
                  <strong>{hudDisplayControlCopy(locale).previewLabel}</strong>
                  <code>{hudPreviewText}</code>
                </span>
              </div>
              <label className="notification-field">
                <span className="metric-label">{hudLabelControlCopy(locale).modeLabel}</span>
                <select
                  className="notification-select"
                  onChange={(event) => setHudLabelMode(event.currentTarget.value as HudLabelMode)}
                  value={hudLabelMode}
                >
                  {HUD_LABEL_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {hudLabelControlCopy(locale).modes[mode]}
                    </option>
                  ))}
                </select>
                <span className="metric-meta">{hudLabelControlCopy(locale).modeHelp}</span>
              </label>
              <div className="notification-field">
                <span className="metric-label">{messages.settings.hudAlwaysOnTop}</span>
                <label className="notification-toggle-card notification-hud-toggle-card">
                  <input
                    checked={hudAlwaysOnTop}
                    onChange={(event) => setHudAlwaysOnTop(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span className="toggle-switch" aria-hidden="true" />
                  <span>
                    <strong>{hudAlwaysOnTop ? messages.settings.notificationEnabled : messages.settings.notificationDisabled}</strong>
                    <span className="metric-meta">{messages.settings.hudAlwaysOnTop}</span>
                  </span>
                </label>
              </div>
              <div className="notification-field">
                <span className="metric-label">{hudPercentCopy.modeLabel}</span>
                <label className="notification-toggle-card notification-hud-toggle-card">
                  <input
                    checked={hudPercentModeIsRemaining}
                    onChange={(event) => {
                      const showRemaining = event.currentTarget.checked;
                      setHudShowRemainingPercent(showRemaining);
                      setHudShowUsagePercent(!showRemaining);
                    }}
                    type="checkbox"
                  />
                  <span className="toggle-switch" aria-hidden="true" />
                  <span>
                    <strong>{hudPercentModeIsRemaining ? hudPercentCopy.remainingMode : hudPercentCopy.usageMode}</strong>
                    <span className="metric-meta">{hudPercentCopy.modeHelp}</span>
                  </span>
                </label>
              </div>
              <label className="notification-field">
                <span className="metric-label">{messages.settings.hudFontSize}</span>
                <input
                  className="notification-range"
                  max="130"
                  min="80"
                  onChange={(event) => setHudFontScale(Number(event.currentTarget.value) / 100)}
                  step="5"
                  type="range"
                  value={Math.round(hudFontScale * 100)}
                />
                <span className="metric-meta">{Math.round(hudFontScale * 100)}%</span>
              </label>
              <label className="notification-field notification-color-field">
                <span className="metric-label">{messages.settings.hudFontColor}</span>
                <input
                  onChange={(event) => setHudFontColor(event.currentTarget.value)}
                  type="color"
                  value={hudFontColor}
                />
                <span className="metric-meta">{hudFontColor}</span>
              </label>
              <label className="notification-field notification-color-field">
                <span className="metric-label">{messages.settings.hudBackgroundColor}</span>
                <input
                  disabled={hudBackgroundNone}
                  onChange={(event) => setHudBackgroundColor(event.currentTarget.value)}
                  type="color"
                  value={hudBackgroundNone ? "#ffffff" : hudBackgroundColor}
                />
                <span className="metric-meta">{hudBackgroundNone ? hudBackgroundNoneLabel(locale) : hudBackgroundColor}</span>
              </label>
              <label className="notification-toggle-card notification-toggle-card-inline">
                <input
                  checked={hudBackgroundNone}
                  onChange={(event) => setHudBackgroundColor(event.currentTarget.checked ? HUD_BACKGROUND_NONE : "#ffffff")}
                  type="checkbox"
                />
                <span className="toggle-switch" aria-hidden="true" />
                <span>
                  <strong>{hudBackgroundNone ? messages.settings.notificationEnabled : messages.settings.notificationDisabled}</strong>
                  <span className="metric-meta">{hudBackgroundNoneLabel(locale)}</span>
                </span>
              </label>
              <label className="notification-field">
                <span className="metric-label">{messages.settings.hudOpacity}</span>
                <input
                  className="notification-range"
                  max="100"
                  min="0"
                  onChange={(event) => setHudOpacity(Number(event.currentTarget.value) / 100)}
                  step="5"
                  type="range"
                  value={Math.round(hudOpacity * 100)}
                />
                <span className="metric-meta">{Math.round(hudOpacity * 100)}%</span>
              </label>
              <label className="notification-field">
                <span className="metric-label">{messages.settings.hudRowHeight}</span>
                <input
                  className="notification-range"
                  max="76"
                  min="28"
                  onChange={(event) => setHudRowHeight(Number(event.currentTarget.value))}
                  step="2"
                  type="range"
                  value={hudRowHeight}
                />
                <span className="metric-meta">{hudRowHeight}px</span>
              </label>
              <label className="notification-field">
                <span className="metric-label">{messages.settings.hudPadding}</span>
                <input
                  className="notification-range"
                  max="18"
                  min="0"
                  onChange={(event) => setHudPadding(Number(event.currentTarget.value))}
                  step="1"
                  type="range"
                  value={hudPadding}
                />
                <span className="metric-meta">{hudPadding}px</span>
              </label>
              <div className="notification-hud-widget-header">
                <div>
                  <strong>{messages.settings.hudWidgetsTitle}</strong>
                  <span className="metric-meta">{messages.settings.hudWidgetsSubtitle}</span>
                  <span className="metric-meta" id="hud-widget-reorder-help">
                    {messages.settings.hudWidgetReorderHelp}
                  </span>
                </div>
                <span className="badge badge-live">{hudSelectedWidgets.length}</span>
              </div>
              <div className="notification-hud-widget-grid" aria-label={messages.settings.hudWidgetsTitle}>
                {orderedHudWidgetCards.map((widgetKey) => {
                  const selectedIndex = hudSelectedWidgets.indexOf(widgetKey);
                  const selected = selectedIndex >= 0;
                  const widgetPreview = getHudWidgetDisplayExample(widgetKey, {
                    labelMode: hudLabelMode,
                    locale,
                    percentMode: hudPercentMode,
                  });

                  return (
                    <div
                      className={[
                        "notification-hud-widget-card",
                        selected ? "" : "notification-widget-card-muted",
                        hudDraggedWidget === widgetKey ? "notification-hud-widget-card-dragging" : "",
                        hudDragTargetWidget === widgetKey ? "notification-hud-widget-card-drag-target" : "",
                      ].filter(Boolean).join(" ")}
                      data-hud-widget-key={widgetKey}
                      key={widgetKey}
                      onDragOver={(event) => handleHudDragOver(event, widgetKey)}
                      onDrop={(event) => handleHudDrop(event, widgetKey)}
                    >
                      <label className="notification-hud-widget-select">
                        <input
                          checked={selected}
                          onChange={() => setHudSelectedWidgets((current) => toggleRequiredWidgetSelection(current, widgetKey))}
                          type="checkbox"
                        />
                        <span>
                          <strong>{messages.notificationWidgets[widgetKey]}</strong>
                          <span className="metric-meta">
                            {messages.settings.widgetOrder}: {selected ? selectedIndex + 1 : "-"}
                          </span>
                          <span className="notification-hud-widget-example">
                            <span>{widgetPreview.shortLabel}</span>
                            <code>{widgetPreview.example}</code>
                          </span>
                        </span>
                      </label>
                      {selected ? (
                        <span
                          aria-describedby="hud-widget-reorder-help"
                          aria-label={`${messages.settings.hudWidgetDragHandle}: ${messages.notificationWidgets[widgetKey]}`}
                          className="notification-hud-drag-handle"
                          draggable
                          onDragEnd={handleHudDragEnd}
                          onDragStart={(event) => handleHudDragStart(event, widgetKey)}
                          onKeyDown={(event) => handleHudReorderKeyDown(event, widgetKey)}
                          role="button"
                          tabIndex={0}
                          title={messages.settings.hudWidgetDragHandle}
                        >
                          <GripVertical aria-hidden="true" size={16} strokeWidth={2} />
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <span aria-live="polite" className="notification-sr-only" role="status">
                {hudOrderAnnouncement}
              </span>
              <div className="notification-hud-actions">
                <button
                  className="primary-button notification-hud-save-button"
                  disabled={saveState === "loading" || saveState === "saving"}
                  onClick={() => {
                    void saveNotificationPreferences();
                  }}
                  type="button"
                >
                  {saveState === "saving" ? messages.settings.toolLoadingPreparingView : messages.settings.hudSaveSettings}
                </button>
                <span
                  className={saveState === "error" ? "notification-save-status notification-save-status-error" : "notification-save-status"}
                  role="status"
                >
                  {saveState === "saved" ? messages.settings.notificationPrefsSaved : statusMessage}
                </span>
              </div>
            </div>
            <p className="metric-meta">{messages.settings.desktopAppInfo}</p>
          </div>
          <div className="notification-test-panel">
            <button
              className="primary-button notification-action-button"
              onClick={() => setLastPreview(buildPreviewMessage(messages, selectedWidgets, digestInterval, quietStart, quietEnd))}
              type="button"
            >
              <Send aria-hidden="true" size={14} />
              <span>{messages.settings.testNotification}</span>
            </button>
            <p className="metric-meta">{messages.settings.notificationLocalOnly}</p>
            <div className="notification-preview" aria-live="polite">
              <Clock3 aria-hidden="true" size={14} />
              <span>
                {lastPreview === null
                  ? messages.settings.notificationPreview
                  : `${messages.settings.testNotificationSent}: ${lastPreview}`}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  function updateThresholdRule(
    index: number | null,
    fallbackRule: NotificationThresholdDraft,
    update: Partial<NotificationThresholdDraft>,
  ) {
    setThresholdRules((current) => {
      if (index !== null) {
        return current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...update } : rule));
      }

      return [
        ...current,
        {
          ...fallbackRule,
          ...update,
        },
      ];
    });
  }

  function updateThresholdCategory(
    category: ThresholdCategory,
    update: Partial<NotificationThresholdSettings[ThresholdCategory]>,
  ) {
    setThresholdSettings((current) => ({
      ...current,
      [category]: {
        ...current[category],
        ...update,
      },
    }));
  }

  function updateAggregateThresholdRule(
    category: ThresholdCategory,
    update: Partial<NotificationAggregateThresholdRule>,
  ) {
    setThresholdSettings((current) => ({
      ...current,
      [category]: {
        ...current[category],
        aggregateRule: {
          ...current[category].aggregateRule,
          ...update,
        },
      },
    }));
  }

  function applyPreferences(preferences: NotificationPreferences) {
    setNotificationsEnabled(preferences.enabled);
    setDigestEnabled(preferences.digestEnabled);
    setDigestInterval(preferences.digestInterval);
    setQuietStart(preferences.quietHours.start);
    setQuietEnd(preferences.quietHours.end);
    setSelectedWidgets([...preferences.selectedWidgets]);
    setThresholdRules(preferences.thresholdRules.map((rule) => ({ ...rule })));
    setThresholdSettings(cloneThresholdSettings(preferences.thresholdSettings));
    setDesktopEnabled(preferences.desktopEnabled);
    dispatchDesktopPreferenceUpdate(preferences.desktopEnabled);
    setHudAlwaysOnTop(preferences.hud.alwaysOnTop);
    setHudBackgroundColor(preferences.hud.backgroundColor);
    setHudDisplayMode(preferences.hud.displayMode);
    setHudFontColor(preferences.hud.fontColor);
    setHudFontScale(preferences.hud.fontScale);
    setHudLabelMode(preferences.hud.labelMode);
    setHudOpacity(preferences.hud.opacity);
    setHudPadding(preferences.hud.padding);
    setHudRowHeight(preferences.hud.rowHeight);
    setHudShowRemainingPercent(preferences.hud.showRemainingPercent);
    setHudShowUsagePercent(preferences.hud.showUsagePercent);
    setHudSelectedWidgets([...preferences.hud.selectedWidgets]);
    setLocalCliDashboardMetricKeys([...preferences.dashboard.localCliMetricKeys]);
    setDashboardBudget({ ...preferences.dashboard.budget });
    setDashboardWidgetLayouts(preferences.dashboard.widgetLayouts);
  }

  function currentPreferences(): NotificationPreferences {
    return {
      enabled: notificationsEnabled,
      digestEnabled,
      digestInterval,
      quietHours: {
        start: quietStart,
        end: quietEnd,
      },
      selectedWidgets,
      thresholdRules,
      thresholdSettings,
      desktopEnabled,
      dashboard: {
        budget: dashboardBudget,
        localCliMetricKeys: localCliDashboardMetricKeys,
        widgetLayouts: dashboardWidgetLayouts,
      },
      hud: {
        alwaysOnTop: hudAlwaysOnTop,
        backgroundColor: hudBackgroundColor,
        displayMode: hudDisplayMode,
        fontColor: hudFontColor,
        fontScale: hudFontScale,
        labelMode: hudLabelMode,
        opacity: hudOpacity,
        padding: hudPadding,
        rowHeight: hudRowHeight,
        showRemainingPercent: hudPercentModeIsRemaining,
        showUsagePercent: !hudPercentModeIsRemaining,
        selectedWidgets: hudSelectedWidgets,
      },
    };
  }

  function commitHudWidgetOrder(sourceWidget: NotificationWidgetKey, targetWidget: NotificationWidgetKey) {
    const reorderedWidgets = reorderHudSelectedWidgets(hudSelectedWidgets, sourceWidget, targetWidget);

    setHudSelectedWidgets(reorderedWidgets);
    setHudOrderAnnouncement(
      `${messages.notificationWidgets[sourceWidget]} — ${messages.settings.widgetOrder}: ${reorderedWidgets.indexOf(sourceWidget) + 1}`,
    );
  }

  function handleHudDragStart(event: DragEvent<HTMLElement>, widgetKey: NotificationWidgetKey) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", widgetKey);
    setHudDraggedWidget(widgetKey);
    setHudDragTargetWidget(null);
  }

  function handleHudDragOver(event: DragEvent<HTMLDivElement>, widgetKey: NotificationWidgetKey) {
    if (!hudSelectedWidgets.includes(widgetKey)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setHudDragTargetWidget(widgetKey);
  }

  function handleHudDrop(event: DragEvent<HTMLDivElement>, widgetKey: NotificationWidgetKey) {
    event.preventDefault();
    const transferredWidget = event.dataTransfer.getData("text/plain");
    const sourceWidget = hudSelectedWidgets.find((item) => item === transferredWidget) ?? hudDraggedWidget;

    if (sourceWidget !== null && hudSelectedWidgets.includes(widgetKey)) {
      commitHudWidgetOrder(sourceWidget, widgetKey);
    }

    handleHudDragEnd();
  }

  function handleHudDragEnd() {
    setHudDraggedWidget(null);
    setHudDragTargetWidget(null);
  }

  function handleHudReorderKeyDown(event: KeyboardEvent<HTMLElement>, widgetKey: NotificationWidgetKey) {
    const currentIndex = hudSelectedWidgets.indexOf(widgetKey);
    const direction = event.key === "ArrowUp" || event.key === "ArrowLeft"
      ? -1
      : event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : 0;
    const targetWidget = hudSelectedWidgets[currentIndex + direction];

    if (direction === 0 || targetWidget === undefined) {
      return;
    }

    event.preventDefault();
    commitHudWidgetOrder(widgetKey, targetWidget);
  }

  async function saveNotificationPreferences() {
    await withAppLoading(messages.settings.toolLoadingPreparingView, async () => {
      try {
        setSaveState("saving");
        setStatusMessage(messages.settings.notificationStoredLocally);
        const session = await createLocalSession();
        const response = await fetch("/api/notification-preferences", {
          body: JSON.stringify(currentPreferences()),
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-MoneySiren-CSRF": session.csrfToken,
          },
          method: "PUT",
        });

        if (!response.ok) {
          throw new Error(`Save failed with status ${response.status}.`);
        }

        const payload = await response.json() as { preferences?: NotificationPreferences };

        if (payload.preferences !== undefined) {
          applyPreferences(payload.preferences);
        }

        setStatusMessage(messages.settings.notificationStoredLocally);
        setSaveState("saved");
      } catch {
        setStatusMessage(messages.settings.notificationPrefsSaveError);
        setSaveState("error");
      }
    });
  }
}

async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch("/api/notification-preferences", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Load failed with status ${response.status}.`);
  }

  const payload = await response.json() as { preferences?: NotificationPreferences };

  if (payload.preferences === undefined) {
    throw new Error("Notification preferences payload is missing.");
  }

  return payload.preferences;
}

async function createLocalSession(): Promise<{ csrfToken: string }> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Session failed with status ${response.status}.`);
  }

  return await response.json() as { csrfToken: string };
}

function toggleWidgetSelection(
  current: readonly NotificationWidgetKey[],
  widgetKey: NotificationWidgetKey,
): NotificationWidgetKey[] {
  return current.includes(widgetKey)
    ? current.filter((item) => item !== widgetKey)
    : [...current, widgetKey];
}

function toggleRequiredWidgetSelection(
  current: readonly NotificationWidgetKey[],
  widgetKey: NotificationWidgetKey,
): NotificationWidgetKey[] {
  if (!current.includes(widgetKey)) {
    return [...current, widgetKey];
  }

  return current.length <= 1 ? [...current] : current.filter((item) => item !== widgetKey);
}

function updateNumberInput(value: string, onValidValue: (value: number) => void): void {
  const parsed = parseOptionalNonNegativeNumber(value);

  if (parsed !== null) {
    onValidValue(parsed);
  }
}

function updateIntegerInput(value: string, onValidValue: (value: number) => void): void {
  const parsed = parseOptionalNonNegativeInteger(value);

  if (parsed !== null) {
    onValidValue(parsed);
  }
}

function buildPreviewMessage(
  messages: Messages,
  selectedWidgets: readonly NotificationWidgetKey[],
  digestInterval: string,
  quietStart: string,
  quietEnd: string,
): string {
  const firstWidget = selectedWidgets[0] ?? "month_forecast";

  return `${messages.notificationWidgets[firstWidget]} / ${digestInterval} / ${quietStart}-${quietEnd}`;
}

function openHudWindow(locale: Locale, desktopEnabled: boolean): Promise<boolean> {
  return openHudDashboardRoute(`/hud?locale=${encodeURIComponent(locale)}`, {
    allowBrowserFallback: !desktopEnabled,
    preopenFallback: !desktopEnabled,
  });
}

function ThresholdCategoryPanel({
  aggregateRule,
  messages,
  mode,
  onAggregateRuleChange,
  onModeChange,
  onRuleChange,
  rules,
  title,
  widgetKeys,
}: {
  aggregateRule: NotificationAggregateThresholdRule;
  messages: Messages;
  mode: NotificationThresholdMode;
  onAggregateRuleChange: (update: Partial<NotificationAggregateThresholdRule>) => void;
  onModeChange: (mode: NotificationThresholdMode) => void;
  onRuleChange: (
    index: number | null,
    fallbackRule: NotificationThresholdDraft,
    update: Partial<NotificationThresholdDraft>,
  ) => void;
  rules: readonly IndexedThresholdRule[];
  title: string;
  widgetKeys: readonly NotificationWidgetKey[];
}) {
  const showAggregate = mode === "aggregate" || mode === "all";
  const showIndividual = mode === "individual" || mode === "all";

  return (
    <div className="notification-threshold-category">
      <div className="notification-threshold-category-header">
        <div>
          <strong>{title}</strong>
          <span className="metric-meta">{messages.settings.thresholdMode}: {thresholdModeLabel(mode, messages)}</span>
        </div>
        <label className="notification-field notification-threshold-mode-field">
          <span className="metric-label">{messages.settings.thresholdMode}</span>
          <select
            className="notification-select"
            onChange={(event) => onModeChange(event.currentTarget.value as NotificationThresholdMode)}
            value={mode}
          >
            {NOTIFICATION_THRESHOLD_MODES.map((modeOption) => (
              <option key={modeOption} value={modeOption}>
                {thresholdModeLabel(modeOption, messages)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showAggregate && (
        <div className="notification-threshold-subsection">
          <span className="metric-label">{messages.settings.thresholdAggregateOptions}</span>
          <div className="notification-threshold-row">
            <div className="notification-field">
              <span className="metric-label">{messages.settings.thresholdWidget}</span>
              <strong>{messages.settings.thresholdAggregateOptions}</strong>
            </div>
            <label className="notification-field">
              <span className="metric-label">{messages.settings.thresholdOperator}</span>
              <select
                className="notification-select"
                onChange={(event) => onAggregateRuleChange({ operator: event.currentTarget.value as ThresholdOperator })}
                value={aggregateRule.operator}
              >
                <option value="gte">&gt;=</option>
                <option value="lte">&lt;=</option>
                <option value="eq">=</option>
              </select>
            </label>
            <label className="notification-field">
              <span className="metric-label">{messages.settings.thresholdValue}</span>
              <input
                className="notification-input"
                min="0"
                onChange={(event) =>
                  updateNumberInput(event.currentTarget.value, (value) => onAggregateRuleChange({ value }))}
                type="number"
                value={aggregateRule.value}
              />
            </label>
            <label className="notification-field">
              <span className="metric-label">{messages.settings.thresholdCooldown}</span>
              <input
                className="notification-input"
                min="0"
                onChange={(event) =>
                  updateIntegerInput(event.currentTarget.value, (cooldownMinutes) =>
                    onAggregateRuleChange({ cooldownMinutes })
                  )}
                step="15"
                type="number"
                value={aggregateRule.cooldownMinutes}
              />
            </label>
          </div>
        </div>
      )}

      {showIndividual && (
        <ThresholdRulesPanel
          messages={messages}
          onRuleChange={onRuleChange}
          rules={rules}
          title={messages.settings.thresholdIndividualOptions}
          widgetKeys={widgetKeys}
        />
      )}
    </div>
  );
}

function ThresholdRulesPanel({
  messages,
  onRuleChange,
  rules,
  title,
  widgetKeys,
}: {
  messages: Messages;
  onRuleChange: (
    index: number | null,
    fallbackRule: NotificationThresholdDraft,
    update: Partial<NotificationThresholdDraft>,
  ) => void;
  rules: readonly IndexedThresholdRule[];
  title: string;
  widgetKeys: readonly NotificationWidgetKey[];
}) {
  return (
    <div className="notification-threshold-subsection">
      <span className="metric-label">{title}</span>
      <div className="notification-threshold-list">
        {rules.map(({ index, rule }) => (
          <div className="notification-threshold-row" key={`${rule.widgetKey}-${index ?? "draft"}`}>
            <label className="notification-field">
              <span className="metric-label">{messages.settings.thresholdWidget}</span>
              <select
                className="notification-select"
                onChange={(event) =>
                  onRuleChange(index, rule, { widgetKey: event.currentTarget.value as NotificationWidgetKey })}
                value={rule.widgetKey}
              >
                {widgetKeys.map((widgetKey) => (
                  <option key={widgetKey} value={widgetKey}>
                    {messages.notificationWidgets[widgetKey]}
                  </option>
                ))}
              </select>
            </label>
            <label className="notification-field">
              <span className="metric-label">{messages.settings.thresholdOperator}</span>
              <select
                className="notification-select"
                onChange={(event) => onRuleChange(index, rule, { operator: event.currentTarget.value as ThresholdOperator })}
                value={rule.operator}
              >
                <option value="gte">&gt;=</option>
                <option value="lte">&lt;=</option>
                <option value="eq">=</option>
              </select>
            </label>
            <label className="notification-field">
              <span className="metric-label">{messages.settings.thresholdValue}</span>
              <input
                className="notification-input"
                min="0"
                onChange={(event) =>
                  updateNumberInput(event.currentTarget.value, (value) =>
                    onRuleChange(index, rule, { value })
                  )}
                type="number"
                value={rule.value}
              />
            </label>
            <label className="notification-field">
              <span className="metric-label">{messages.settings.thresholdCooldown}</span>
              <input
                className="notification-input"
                min="0"
                onChange={(event) =>
                  updateIntegerInput(event.currentTarget.value, (cooldownMinutes) =>
                    onRuleChange(index, rule, { cooldownMinutes })
                  )}
                step="15"
                type="number"
                value={rule.cooldownMinutes}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function thresholdModeLabel(mode: NotificationThresholdMode, messages: Messages): string {
  if (mode === "aggregate") {
    return messages.settings.thresholdModeAggregate;
  }

  if (mode === "all") {
    return messages.settings.thresholdModeAll;
  }

  return messages.settings.thresholdModeIndividual;
}

function thresholdRulesForCategory(
  rules: readonly NotificationThresholdDraft[],
  category: ThresholdCategory,
): IndexedThresholdRule[] {
  const widgetKeys = category === "cost" ? COST_NOTIFICATION_WIDGET_KEYS : USAGE_NOTIFICATION_WIDGET_KEYS;
  const existingByWidget = indexedRulesByWidget(rules, (widgetKey) =>
    thresholdCategoryForWidget(widgetKey) === category
  );

  return widgetKeys.map((widgetKey) =>
    existingByWidget.get(widgetKey) ?? {
      index: null,
      rule: defaultThresholdRuleForWidget(widgetKey),
    }
  );
}

function thresholdRulesForOther(rules: readonly NotificationThresholdDraft[]): IndexedThresholdRule[] {
  const existingByWidget = indexedRulesByWidget(rules, (widgetKey) =>
    thresholdCategoryForWidget(widgetKey) === null
  );
  const defaultWidgetKeys = DEFAULT_NOTIFICATION_THRESHOLD_RULES
    .map((rule) => rule.widgetKey)
    .filter((widgetKey) => thresholdCategoryForWidget(widgetKey) === null);
  const widgetKeys = [...new Set([
    ...defaultWidgetKeys,
    ...rules.filter((rule) => thresholdCategoryForWidget(rule.widgetKey) === null).map((rule) => rule.widgetKey),
  ])];

  return widgetKeys.map((widgetKey) =>
    existingByWidget.get(widgetKey) ?? {
      index: null,
      rule: defaultThresholdRuleForWidget(widgetKey),
    }
  );
}

function indexedRulesByWidget(
  rules: readonly NotificationThresholdDraft[],
  predicate: (widgetKey: NotificationWidgetKey) => boolean,
): Map<NotificationWidgetKey, IndexedThresholdRule> {
  const indexedRules = new Map<NotificationWidgetKey, IndexedThresholdRule>();

  rules.forEach((rule, index) => {
    if (!predicate(rule.widgetKey) || indexedRules.has(rule.widgetKey)) {
      return;
    }

    indexedRules.set(rule.widgetKey, {
      index,
      rule,
    });
  });

  return indexedRules;
}

function defaultThresholdRuleForWidget(widgetKey: NotificationWidgetKey): NotificationThresholdDraft {
  const defaultRule = DEFAULT_NOTIFICATION_THRESHOLD_RULES.find((rule) => rule.widgetKey === widgetKey);

  if (defaultRule !== undefined) {
    return { ...defaultRule };
  }

  const category = thresholdCategoryForWidget(widgetKey);
  const aggregateRule = category === "usage"
    ? defaultUsageThresholdRule(widgetKey)
    : DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS.cost.aggregateRule;

  return {
    widgetKey,
    operator: aggregateRule.operator,
    value: aggregateRule.value,
    cooldownMinutes: aggregateRule.cooldownMinutes,
  };
}

function defaultUsageThresholdRule(widgetKey: NotificationWidgetKey): NotificationAggregateThresholdRule {
  if (widgetKey === "openai_today_tokens" || widgetKey === "codex_total_tokens") {
    return {
      operator: "gte",
      value: 100000,
      cooldownMinutes: DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS.usage.aggregateRule.cooldownMinutes,
    };
  }

  if (widgetKey === "codex_reset_credit_count") {
    return {
      operator: "lte",
      value: 1,
      cooldownMinutes: DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS.usage.aggregateRule.cooldownMinutes,
    };
  }

  if (widgetKey === "codex_reset_credit_expiry") {
    return {
      operator: "lte",
      value: 7,
      cooldownMinutes: DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS.usage.aggregateRule.cooldownMinutes,
    };
  }

  return DEFAULT_NOTIFICATION_THRESHOLD_SETTINGS.usage.aggregateRule;
}

function thresholdCategoryForWidget(widgetKey: NotificationWidgetKey): ThresholdCategory | null {
  if (COST_NOTIFICATION_WIDGET_KEY_SET.has(widgetKey)) {
    return "cost";
  }

  if (USAGE_NOTIFICATION_WIDGET_KEY_SET.has(widgetKey)) {
    return "usage";
  }

  return null;
}

function cloneThresholdSettings(settings: NotificationThresholdSettings): NotificationThresholdSettings {
  return {
    cost: {
      mode: settings.cost.mode,
      aggregateRule: {
        ...settings.cost.aggregateRule,
      },
    },
    usage: {
      mode: settings.usage.mode,
      aggregateRule: {
        ...settings.usage.aggregateRule,
      },
    },
  };
}

function hudDisplayControlCopy(locale: Locale): {
  modeLabel: string;
  modeHelp: string;
  previewLabel: string;
  modes: Record<HudDisplayMode, string>;
} {
  if (locale === "ko") {
    return {
      modeLabel: "HUD 표시 방식",
      modeHelp: "행, 칸, 한 줄 중 실제 HUD에 적용할 표시 방식을 선택합니다.",
      previewLabel: "표시 예시",
      modes: {
        rows: "행으로 보기 (ROW)",
        cells: "칸으로 보기 (CELL)",
        singleLine: "한 줄로 보기",
      },
    };
  }

  if (locale === "ja") {
    return {
      modeLabel: "HUD display mode",
      modeHelp: "Choose the row, cell, or one-line layout used by the HUD.",
      previewLabel: "Preview",
      modes: {
        rows: "Rows",
        cells: "Cells",
        singleLine: "One line",
      },
    };
  }

  return {
    modeLabel: "HUD display mode",
    modeHelp: "Choose the row, cell, or one-line layout used by the HUD.",
    previewLabel: "Preview",
    modes: {
      rows: "Rows",
      cells: "Cells",
      singleLine: "One line",
    },
  };
}

function hudLabelControlCopy(locale: Locale): {
  modeLabel: string;
  modeHelp: string;
  modes: Record<HudLabelMode, string>;
} {
  if (locale === "ko") {
    return {
      modeLabel: "항목 이름 표시",
      modeHelp: "전체 이름을 표시하거나, 좁게 볼 때 아이콘만 표시합니다.",
      modes: {
        text: "전체 이름",
        icon: "아이콘만",
      },
    };
  }

  if (locale === "ja") {
    return {
      modeLabel: "Item name display",
      modeHelp: "Show full item names, or show icons only for compact HUD use.",
      modes: {
        text: "Full name",
        icon: "Icon only",
      },
    };
  }

  return {
    modeLabel: "Item name display",
    modeHelp: "Show full item names, or show icons only for compact HUD use.",
    modes: {
      text: "Full name",
      icon: "Icon only",
    },
  };
}

function hudPercentDisplayCopy(locale: Locale): {
  modeLabel: string;
  modeHelp: string;
  remainingMode: string;
  usageMode: string;
} {
  if (locale === "ko") {
    return {
      modeLabel: "사용량 표시 기준",
      modeHelp: "한 번에 하나만 표시합니다. 토글을 끄면 사용량, 켜면 남은량을 표시합니다.",
      remainingMode: "남은량 기준",
      usageMode: "사용량 기준",
    };
  }

  if (locale === "ja") {
    return {
      modeLabel: "Usage display basis",
      modeHelp: "Only one value is shown. Off shows used; on shows remaining.",
      remainingMode: "Remaining",
      usageMode: "Used",
    };
  }

  return {
    modeLabel: "Usage display basis",
    modeHelp: "Only one value is shown. Off shows used; on shows remaining.",
    remainingMode: "Remaining",
    usageMode: "Used",
  };
}

function hudBackgroundNoneLabel(locale: Locale): string {
  if (locale === "ko") {
    return "배경 없음";
  }

  if (locale === "ja") {
    return "背景なし";
  }

  return "No background";
}

function hudDisplayCopy(locale: Locale): {
  modeLabel: string;
  modeHelp: string;
  previewLabel: string;
  modes: Record<HudDisplayMode, string>;
} {
  if (locale === "ko") {
    return {
      modeLabel: "HUD 표시 방식",
      modeHelp: "ROW, CELL, 한줄 중 HUD 표시 방식을 선택합니다.",
      previewLabel: "표시 예시",
      modes: {
        rows: "ROW",
        cells: "CELL",
        singleLine: "한줄",
      },
    };
  }

  if (locale === "ja") {
    return {
      modeLabel: "HUD display",
      modeHelp: "Choose ROW, CELL, or one-line HUD display.",
      previewLabel: "Preview",
      modes: {
        rows: "ROW",
        cells: "CELL",
        singleLine: "One line",
      },
    };
  }

  return {
    modeLabel: "HUD display",
    modeHelp: "Choose ROW, CELL, or one-line HUD display.",
    previewLabel: "Preview",
    modes: {
      rows: "ROW",
      cells: "CELL",
      singleLine: "One line",
    },
  };
}

function hudLabelCopy(locale: Locale): {
  modeLabel: string;
  modeHelp: string;
  modes: Record<HudLabelMode, string>;
} {
  if (locale === "ko") {
    return {
      modeLabel: "HUD name display",
      modeHelp: "Show full names, or show icons only when the HUD needs to stay compact.",
      modes: {
        text: "Full name",
        icon: "Icon only",
      },
    };
  }

  if (locale === "ja") {
    return {
      modeLabel: "HUD name display",
      modeHelp: "Show full names, or show icons only when the HUD needs to stay compact.",
      modes: {
        text: "Full name",
        icon: "Icon only",
      },
    };
  }

  return {
    modeLabel: "HUD name display",
    modeHelp: "Show full names, or show icons only when the HUD needs to stay compact.",
    modes: {
      text: "Full name",
      icon: "Icon only",
    },
  };
}

function KeyValueLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="notification-key-value">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
