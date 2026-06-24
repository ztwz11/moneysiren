"use client";

import { useEffect, useState } from "react";
import {
  BellRing,
  Clock3,
  ExternalLink,
  MonitorCheck,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import type { Locale, Messages } from "../lib/i18n";
import {
  DEFAULT_NOTIFICATION_THRESHOLD_RULES,
  DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_SELECTED_NOTIFICATION_WIDGET_KEYS,
  NOTIFICATION_WIDGET_KEYS,
  type DigestInterval,
  type DashboardBudgetPreferences,
  type DashboardWidgetLayoutPreferences,
  type LocalCliDashboardMetricKey,
  type NotificationPreferences,
  type NotificationThresholdDraft,
  type NotificationWidgetKey,
  type ThresholdOperator,
} from "./NotificationSettingsModel";
import { withAppLoading } from "./AppLoadingOverlay";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

export function NotificationSettingsPanel({ locale, messages }: { locale: Locale; messages: Messages }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.enabled);
  const [digestEnabled, setDigestEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.digestEnabled);
  const [desktopEnabled, setDesktopEnabled] = useState(DEFAULT_NOTIFICATION_PREFERENCES.desktopEnabled);
  const [digestInterval, setDigestInterval] = useState<DigestInterval>(DEFAULT_NOTIFICATION_PREFERENCES.digestInterval);
  const [quietStart, setQuietStart] = useState(DEFAULT_NOTIFICATION_PREFERENCES.quietHours.start);
  const [quietEnd, setQuietEnd] = useState(DEFAULT_NOTIFICATION_PREFERENCES.quietHours.end);
  const [hudAlwaysOnTop, setHudAlwaysOnTop] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.alwaysOnTop);
  const [hudBackgroundColor, setHudBackgroundColor] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.backgroundColor);
  const [hudFontColor, setHudFontColor] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.fontColor);
  const [hudFontScale, setHudFontScale] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.fontScale);
  const [hudOpacity, setHudOpacity] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.opacity);
  const [hudPadding, setHudPadding] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.padding);
  const [hudRowHeight, setHudRowHeight] = useState(DEFAULT_NOTIFICATION_PREFERENCES.hud.rowHeight);
  const [hudSelectedWidgets, setHudSelectedWidgets] = useState<NotificationWidgetKey[]>(
    [...DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets],
  );
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
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [statusMessage, setStatusMessage] = useState(messages.settings.notificationStoredLocally);

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
          <div className="notification-threshold-list">
            {thresholdRules.map((rule, index) => (
              <div className="notification-threshold-row" key={`${rule.widgetKey}-${index}`}>
                <label className="notification-field">
                  <span className="metric-label">{messages.settings.thresholdWidget}</span>
                  <select
                    className="notification-select"
                    onChange={(event) => updateThresholdRule(index, { widgetKey: event.currentTarget.value as NotificationWidgetKey })}
                    value={rule.widgetKey}
                  >
                    {NOTIFICATION_WIDGET_KEYS.map((widgetKey) => (
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
                    onChange={(event) => updateThresholdRule(index, { operator: event.currentTarget.value as ThresholdOperator })}
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
                    onChange={(event) => updateThresholdRule(index, { value: positiveNumber(event.currentTarget.value) })}
                    type="number"
                    value={rule.value}
                  />
                </label>
                <label className="notification-field">
                  <span className="metric-label">{messages.settings.thresholdCooldown}</span>
                  <input
                    className="notification-input"
                    min="0"
                    onChange={(event) => updateThresholdRule(index, { cooldownMinutes: positiveNumber(event.currentTarget.value) })}
                    step="15"
                    type="number"
                    value={rule.cooldownMinutes}
                  />
                </label>
              </div>
            ))}
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
                onChange={(event) => setDesktopEnabled(event.currentTarget.checked)}
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
                onClick={() => openHudWindow(locale)}
                type="button"
              >
                <ExternalLink aria-hidden="true" size={14} />
                <span>{messages.settings.hudOpenWindow}</span>
              </button>
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
                  onChange={(event) => setHudBackgroundColor(event.currentTarget.value)}
                  type="color"
                  value={hudBackgroundColor}
                />
                <span className="metric-meta">{hudBackgroundColor}</span>
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
                </div>
                <span className="badge badge-live">{hudSelectedWidgets.length}</span>
              </div>
              <div className="notification-hud-widget-grid" aria-label={messages.settings.hudWidgetsTitle}>
                {NOTIFICATION_WIDGET_KEYS.map((widgetKey) => {
                  const selectedIndex = hudSelectedWidgets.indexOf(widgetKey);
                  const selected = selectedIndex >= 0;

                  return (
                    <label
                      className={selected ? "notification-hud-widget-card" : "notification-hud-widget-card notification-widget-card-muted"}
                      key={widgetKey}
                    >
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
                      </span>
                    </label>
                  );
                })}
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

  function updateThresholdRule(index: number, update: Partial<NotificationThresholdDraft>) {
    setThresholdRules((current) =>
      current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...update } : rule)),
    );
  }

  function applyPreferences(preferences: NotificationPreferences) {
    setNotificationsEnabled(preferences.enabled);
    setDigestEnabled(preferences.digestEnabled);
    setDigestInterval(preferences.digestInterval);
    setQuietStart(preferences.quietHours.start);
    setQuietEnd(preferences.quietHours.end);
    setSelectedWidgets([...preferences.selectedWidgets]);
    setThresholdRules(preferences.thresholdRules.map((rule) => ({ ...rule })));
    setDesktopEnabled(preferences.desktopEnabled);
    setHudAlwaysOnTop(preferences.hud.alwaysOnTop);
    setHudBackgroundColor(preferences.hud.backgroundColor);
    setHudFontColor(preferences.hud.fontColor);
    setHudFontScale(preferences.hud.fontScale);
    setHudOpacity(preferences.hud.opacity);
    setHudPadding(preferences.hud.padding);
    setHudRowHeight(preferences.hud.rowHeight);
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
      desktopEnabled,
      dashboard: {
        budget: dashboardBudget,
        localCliMetricKeys: localCliDashboardMetricKeys,
        widgetLayouts: dashboardWidgetLayouts,
      },
      hud: {
        alwaysOnTop: hudAlwaysOnTop,
        backgroundColor: hudBackgroundColor,
        fontColor: hudFontColor,
        fontScale: hudFontScale,
        opacity: hudOpacity,
        padding: hudPadding,
        rowHeight: hudRowHeight,
        selectedWidgets: hudSelectedWidgets,
      },
    };
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

function positiveNumber(value: string): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
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

function openHudWindow(locale: Locale) {
  const url = `/hud?locale=${encodeURIComponent(locale)}`;
  const opened = window.open(url, "moneysiren-hud", "popup=yes,width=360,height=520,resizable=yes,scrollbars=no");

  opened?.focus();
}

function KeyValueLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="notification-key-value">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
