"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Messages } from "../lib/i18n";
import {
  DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  type LocalCliDashboardMetricKey,
  type NotificationPreferences,
} from "./NotificationSettingsModel";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

export function DashboardDisplaySettings({ messages }: { messages: Messages }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<LocalCliDashboardMetricKey[]>([
    ...DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  ]);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [statusMessage, setStatusMessage] = useState(messages.settings.notificationStoredLocally);

  useEffect(() => {
    let mounted = true;

    void loadNotificationPreferences().then((loadedPreferences) => {
      if (!mounted) {
        return;
      }

      setPreferences(loadedPreferences);
      setSelectedMetricKeys([...loadedPreferences.dashboard.localCliMetricKeys]);
      setStatusMessage(messages.settings.notificationStoredLocally);
      setSaveState("idle");
    }).catch(() => {
      if (!mounted) {
        return;
      }

      setStatusMessage(messages.settings.dashboardDisplayPrefsLoadError);
      setSaveState("error");
    });

    return () => {
      mounted = false;
    };
  }, [
    messages.settings.dashboardDisplayPrefsLoadError,
    messages.settings.notificationStoredLocally,
  ]);

  return (
    <section className="panel">
      <div className="panel-header compact-header">
        <div className="notification-title-line">
          <SlidersHorizontal aria-hidden="true" size={17} strokeWidth={1.9} />
          <div>
            <h2 className="panel-title">{messages.settings.localCliDashboardTitle}</h2>
            <p className="metric-meta">{messages.settings.localCliDashboardSubtitle}</p>
          </div>
        </div>
        <div className="notification-header-actions">
          <span className="badge badge-live">{selectedMetricKeys.length}</span>
          <button
            className="primary-button notification-save-button"
            disabled={saveState === "loading" || saveState === "saving"}
            onClick={() => {
              void saveDashboardDisplayPreferences();
            }}
            type="button"
          >
            {saveState === "saving" ? messages.settings.toolLoadingPreparingView : messages.settings.saveDashboardDisplay}
          </button>
        </div>
      </div>
      <p
        className={saveState === "error" ? "notification-save-status notification-save-status-error" : "notification-save-status"}
        role="status"
      >
        {saveState === "saved" ? messages.settings.dashboardDisplayPrefsSaved : statusMessage}
      </p>
      <div className="panel-body">
        <div className="notification-widget-grid dashboard-cli-metric-grid" aria-label={messages.settings.localCliDashboardMetricSelection}>
          {LOCAL_CLI_DASHBOARD_METRIC_KEYS.map((metricKey) => {
            const selectedIndex = selectedMetricKeys.indexOf(metricKey);
            const selected = selectedIndex >= 0;

            return (
              <label
                className={selected ? "notification-widget-card" : "notification-widget-card notification-widget-card-muted"}
                key={metricKey}
              >
                <input
                  checked={selected}
                  onChange={() => setSelectedMetricKeys((current) => toggleRequiredMetricKey(current, metricKey))}
                  type="checkbox"
                />
                <span>
                  <strong>{localCliDashboardMetricLabel(metricKey, messages)}</strong>
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
  );

  async function saveDashboardDisplayPreferences() {
    try {
      setSaveState("saving");
      setStatusMessage(messages.settings.notificationStoredLocally);
      const session = await createLocalSession();
      const nextPreferences: NotificationPreferences = {
        ...preferences,
        dashboard: {
          ...preferences.dashboard,
          localCliMetricKeys: selectedMetricKeys,
        },
      };
      const response = await fetch("/api/notification-preferences", {
        body: JSON.stringify(nextPreferences),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-StackSpend-CSRF": session.csrfToken,
        },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}.`);
      }

      const payload = await response.json() as { preferences?: NotificationPreferences };

      if (payload.preferences !== undefined) {
        setPreferences(payload.preferences);
        setSelectedMetricKeys([...payload.preferences.dashboard.localCliMetricKeys]);
      }

      setStatusMessage(messages.settings.notificationStoredLocally);
      setSaveState("saved");
    } catch {
      setStatusMessage(messages.settings.dashboardDisplayPrefsSaveError);
      setSaveState("error");
    }
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

function toggleRequiredMetricKey(
  current: readonly LocalCliDashboardMetricKey[],
  metricKey: LocalCliDashboardMetricKey,
): LocalCliDashboardMetricKey[] {
  if (!current.includes(metricKey)) {
    return [...current, metricKey];
  }

  return current.length <= 1 ? [...current] : current.filter((item) => item !== metricKey);
}

function localCliDashboardMetricLabel(metricKey: LocalCliDashboardMetricKey, messages: Messages): string {
  if (metricKey === "context_percent") {
    return messages.services.contextPercent;
  }

  if (metricKey === "last_request_tokens") {
    return messages.services.lastRequestTokens;
  }

  if (metricKey === "total_tokens") {
    return messages.services.totalTokens;
  }

  if (metricKey === "five_hour_limit_percent") {
    return messages.services.fiveHourLimit;
  }

  if (metricKey === "weekly_limit_percent") {
    return messages.services.weeklyLimit;
  }

  if (metricKey === "five_hour_remaining_tokens") {
    return messages.services.fiveHourRemainingTokens;
  }

  if (metricKey === "weekly_remaining_tokens") {
    return messages.services.weeklyRemainingTokens;
  }

  if (metricKey === "context_tokens") {
    return messages.services.contextTokens;
  }

  if (metricKey === "input_tokens") {
    return messages.services.inputTokens;
  }

  if (metricKey === "output_tokens") {
    return messages.services.outputTokens;
  }

  if (metricKey === "cache_tokens") {
    return messages.services.cacheTokens;
  }

  if (metricKey === "reasoning_tokens") {
    return messages.services.reasoningTokens;
  }

  if (metricKey === "sessions") {
    return messages.services.sessions;
  }

  if (metricKey === "turns") {
    return messages.services.turns;
  }

  if (metricKey === "tool_calls") {
    return messages.services.toolCalls;
  }

  return messages.services.logFiles;
}
