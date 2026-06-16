import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildNotificationDigest,
  buildOperationsOverview,
  buildTodayLiveView,
  buildTrayMenuModel,
  parseNotificationPreferences,
  readOperationsOverview,
  type ViewModelStore,
} from "./index.js";

const NOW = new Date("2026-06-09T03:00:00.000Z");

const STORE_WITH_SENSITIVE_VALUES: ViewModelStore = {
  providers: [
    {
      key: "openai",
      displayName: "OpenAI acct_123456",
    },
  ],
  usageSnapshots: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      service: "api",
      metric: "model_requests",
      unit: "requests",
      value: 42,
    },
  ],
  billingSnapshots: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      amountMinor: 1200,
      currency: "USD",
      status: "estimated",
    },
  ],
  serviceHealthSnapshots: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      service: "api",
      status: "ok",
    },
  ],
  costEstimates: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      estimatedAmountMinor: 3456,
      currency: "USD",
      confidence: "medium",
    },
  ],
  alerts: [
    {
      providerKey: "openai",
      createdAt: NOW.toISOString(),
      severity: "warning",
      category: "billing",
      title: "Invoice invoice_test123 changed",
      message: "Contact dev@example.com with sk-test_123 or https://hooks.slack.com/services/T000/B000/SECRET",
    },
  ],
};

describe("shared view model", () => {
  it("returns local-safe operation responses without secrets or raw payloads", async () => {
    const overview = await readOperationsOverview({
      now: () => NOW,
      store: STORE_WITH_SENSITIVE_VALUES,
    });
    const serialized = JSON.stringify(overview);

    expect(overview.localOnly).toBe(true);
    expect(overview.secretsReturned).toBe(false);
    expect(overview.summary.totalEstimatedAmountMinor).toBe(3456);
    expect(serialized).not.toContain("acct_123456");
    expect(serialized).not.toContain("invoice_test123");
    expect(serialized).not.toContain("dev@example.com");
    expect(serialized).not.toContain("sk-test_123");
    expect(serialized).not.toContain("hooks.slack.com");
    expect(serialized.toLowerCase()).not.toContain("rawpayload");
  });

  it("builds digest and tray models from the same secret-safe envelopes", () => {
    const overview = buildOperationsOverview(STORE_WITH_SENSITIVE_VALUES, {
      generatedAt: NOW.toISOString(),
    });
    const todayLive = buildTodayLiveView(STORE_WITH_SENSITIVE_VALUES, {
      generatedAt: NOW.toISOString(),
      now: NOW,
      timezone: "UTC",
    });
    const digest = buildNotificationDigest(overview, todayLive);
    const tray = buildTrayMenuModel(digest);

    expect(digest.secretsReturned).toBe(false);
    expect(tray.secretsReturned).toBe(false);
    expect(digest.items.map((item) => item.widgetKey)).toEqual([
      "month_forecast",
      "today_live_cost",
      "risk_high_count",
      "stale_connection_count",
      "openai_today_tokens",
      "codex_five_hour_percent",
    ]);
    expect(tray.items.map((item) => item.id)).toEqual([
      "status",
      "widget-month_forecast",
      "widget-today_live_cost",
      "widget-risk_high_count",
      "widget-stale_connection_count",
      "widget-openai_today_tokens",
      "widget-codex_five_hour_percent",
      "separator-widgets",
      "show-hud",
      "open-dashboard",
      "open-notification-settings",
      "refresh-now",
      "separator-main",
      "quit",
    ]);
    expect(JSON.stringify({ digest, tray })).not.toContain("dev@example.com");
  });

  it("orders selected CLI and provider widgets for desktop HUD payloads", () => {
    const overview = buildOperationsOverview({
      ...STORE_WITH_SENSITIVE_VALUES,
      providers: [
        ...STORE_WITH_SENSITIVE_VALUES.providers,
        {
          key: "codex-cli",
          displayName: "Codex CLI",
        },
      ],
    }, {
      generatedAt: NOW.toISOString(),
    });
    const todayLive = buildTodayLiveView(STORE_WITH_SENSITIVE_VALUES, {
      generatedAt: NOW.toISOString(),
      now: NOW,
      timezone: "UTC",
      liveProviders: [
        {
          providerKey: "openai",
          displayName: "OpenAI",
          checkedAt: NOW.toISOString(),
          freshness: "live",
          confidence: "low",
          todayLiveAmountMinor: 420,
          currency: "USD",
          included: true,
          metrics: [
            {
              key: "total_tokens",
              value: 4200,
              unit: "tokens",
            },
          ],
        },
        {
          providerKey: "codex-cli",
          displayName: "Codex CLI",
          checkedAt: NOW.toISOString(),
          freshness: "live",
          confidence: "low",
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          metrics: [
            {
              key: "five_hour_limit_percent",
              value: 12.5,
              unit: "percent",
            },
            {
              key: "weekly_tokens",
              value: 130,
              unit: "tokens",
            },
            {
              key: "weekly_remaining_tokens",
              value: 870,
              unit: "tokens",
            },
          ],
        },
      ],
    });
    const digest = buildNotificationDigest(overview, todayLive, {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      selectedWidgets: [
        "codex_five_hour_percent",
        "codex_weekly_percent",
        "openai_today_tokens",
      ],
    });
    const tray = buildTrayMenuModel(digest);

    expect(digest.items.map((item) => [item.widgetKey, item.value])).toEqual([
      ["codex_five_hour_percent", "87.5%"],
      ["codex_weekly_percent", "87%"],
      ["openai_today_tokens", "4,200"],
    ]);
    expect(tray.items.filter((item) => item.id.startsWith("widget-")).map((item) => item.label)).toEqual([
      "Codex 5h remaining: 87.5%",
      "Codex weekly remaining: 87%",
      "OpenAI tokens: 4,200",
    ]);
  });

  it("normalizes compact HUD display preferences", () => {
    expect(parseNotificationPreferences({}).hud).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.hud);
    expect(parseNotificationPreferences({
      hud: {
        fontScale: 2,
        opacity: -0.1,
      },
    }).hud).toEqual({
      alwaysOnTop: DEFAULT_NOTIFICATION_PREFERENCES.hud.alwaysOnTop,
      fontScale: 1.3,
      opacity: 0,
      selectedWidgets: DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets,
    });
    expect(parseNotificationPreferences({
      hud: {
        alwaysOnTop: false,
        fontScale: 0.87,
        opacity: 0,
        selectedWidgets: ["openai_today_tokens"],
      },
    }).hud).toEqual({
      alwaysOnTop: false,
      fontScale: 0.87,
      opacity: 0,
      selectedWidgets: ["openai_today_tokens"],
    });
    expect(parseNotificationPreferences({
      selectedWidgets: ["risk_high_count"],
      hud: {
        fontScale: 0.95,
      },
    }).hud).toEqual({
      alwaysOnTop: DEFAULT_NOTIFICATION_PREFERENCES.hud.alwaysOnTop,
      fontScale: 0.95,
      opacity: DEFAULT_NOTIFICATION_PREFERENCES.hud.opacity,
      selectedWidgets: ["risk_high_count"],
    });
  });

  it("normalizes dashboard display preferences for local CLI metrics", () => {
    expect(parseNotificationPreferences({}).dashboard).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.dashboard);
    expect(parseNotificationPreferences({
      dashboard: {
        localCliMetricKeys: ["last_request_tokens", "unknown", "total_tokens", "last_request_tokens"],
      },
    }).dashboard).toEqual({
      localCliMetricKeys: ["last_request_tokens", "total_tokens"],
    });
    expect(parseNotificationPreferences({
      dashboard: {
        localCliMetricKeys: [],
      },
    }).dashboard).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.dashboard);
  });
});
