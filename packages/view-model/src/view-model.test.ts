import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildNotificationDigest,
  buildHudViewModel,
  buildOperationsOverview,
  buildTodayLiveView,
  buildTrayMenuModel,
  filterHudViewModelByWidgets,
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
      "codex_total_tokens",
      "codex_five_hour_percent",
      "codex_reset_credit_count",
      "codex_reset_credit_expiry",
    ]);
    expect(tray.items.map((item) => item.id)).toEqual([
      "status",
      "widget-month_forecast",
      "widget-today_live_cost",
      "widget-risk_high_count",
      "widget-stale_connection_count",
      "widget-openai_today_tokens",
      "widget-codex_total_tokens",
      "widget-codex_five_hour_percent",
      "widget-codex_reset_credit_count",
      "widget-codex_reset_credit_expiry",
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

  it("applies notification thresholds to selected digest items", () => {
    const overview = buildOperationsOverview({
      ...STORE_WITH_SENSITIVE_VALUES,
      alerts: [],
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
          confidence: "medium",
          todayLiveAmountMinor: 420,
          currency: "USD",
          included: true,
          metrics: [],
        },
        {
          providerKey: "codex-cli",
          displayName: "Codex CLI",
          checkedAt: NOW.toISOString(),
          freshness: "live",
          confidence: "medium",
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          metrics: [
            {
              key: "weekly_limit_percent",
              value: 70,
              unit: "percent",
            },
          ],
        },
      ],
    });
    const digest = buildNotificationDigest(overview, todayLive, {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      selectedWidgets: [
        "today_live_cost",
        "codex_weekly_percent",
        "risk_high_count",
      ],
      thresholdRules: [
        {
          widgetKey: "today_live_cost",
          operator: "gte",
          value: 10,
          cooldownMinutes: 180,
        },
        {
          widgetKey: "codex_weekly_percent",
          operator: "gte",
          value: 60,
          cooldownMinutes: 60,
        },
        {
          widgetKey: "risk_high_count",
          operator: "gte",
          value: 1,
          cooldownMinutes: 60,
        },
      ],
    });

    expect(digest.status).toBe("attention");
    expect(digest.items).toEqual([
      expect.objectContaining({
        widgetKey: "today_live_cost",
        value: "USD 4.20",
      }),
      expect.objectContaining({
        widgetKey: "codex_weekly_percent",
        severity: "warning",
        thresholdTriggered: true,
        thresholdCooldownMinutes: 60,
        usedPercent: 70,
        value: "30%",
      }),
      expect.objectContaining({
        widgetKey: "risk_high_count",
        numericValue: 0,
      }),
    ]);
    expect(digest.items[0]).not.toHaveProperty("thresholdTriggered");
    expect(digest.items[2]).not.toHaveProperty("thresholdTriggered");
  });

  it("avoids double counting rollup and detail widgets in aggregate thresholds", () => {
    const overview = buildOperationsOverview({
      ...STORE_WITH_SENSITIVE_VALUES,
      alerts: [],
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
          confidence: "medium",
          todayLiveAmountMinor: 420,
          currency: "USD",
          included: true,
          metrics: [
            {
              key: "total_tokens",
              value: 5000,
              unit: "tokens",
            },
          ],
        },
      ],
    });
    const digest = buildNotificationDigest(overview, todayLive, {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      selectedWidgets: [
        "today_live_cost",
        "openai_today_cost",
        "openai_today_tokens",
        "supabase_usage_health",
      ],
      thresholdSettings: {
        cost: {
          mode: "aggregate",
          aggregateRule: {
            operator: "gte",
            value: 8,
            cooldownMinutes: 180,
          },
        },
        usage: {
          mode: "aggregate",
          aggregateRule: {
            operator: "gte",
            value: 6000,
            cooldownMinutes: 180,
          },
        },
      },
      thresholdRules: [],
    });

    expect(digest.status).toBe("ok");
    expect(digest.items).toEqual([
      expect.objectContaining({
        widgetKey: "today_live_cost",
      }),
      expect.objectContaining({
        widgetKey: "openai_today_cost",
      }),
      expect.objectContaining({
        widgetKey: "openai_today_tokens",
      }),
      expect.objectContaining({
        widgetKey: "supabase_usage_health",
      }),
    ]);
    expect(digest.items[0]).not.toHaveProperty("thresholdTriggered");
    expect(digest.items[1]).not.toHaveProperty("thresholdTriggered");
    expect(digest.items[2]).not.toHaveProperty("thresholdTriggered");
    expect(digest.items[3]).not.toHaveProperty("thresholdTriggered");
  });

  it("does not sum unrelated percent quotas for usage aggregate thresholds", () => {
    const overview = buildOperationsOverview({
      ...STORE_WITH_SENSITIVE_VALUES,
      alerts: [],
    }, {
      generatedAt: NOW.toISOString(),
    });
    const todayLive = buildTodayLiveView(STORE_WITH_SENSITIVE_VALUES, {
      generatedAt: NOW.toISOString(),
      now: NOW,
      timezone: "UTC",
      liveProviders: [
        {
          providerKey: "claude-cli",
          displayName: "Claude CLI",
          checkedAt: NOW.toISOString(),
          freshness: "live",
          confidence: "medium",
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          metrics: [
            {
              key: "five_hour_limit_percent",
              value: 45,
              unit: "percent",
            },
          ],
        },
        {
          providerKey: "codex-cli",
          displayName: "Codex CLI",
          checkedAt: NOW.toISOString(),
          freshness: "live",
          confidence: "medium",
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          metrics: [
            {
              key: "weekly_limit_percent",
              value: 50,
              unit: "percent",
            },
          ],
        },
      ],
    });
    const digest = buildNotificationDigest(overview, todayLive, {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      selectedWidgets: [
        "claude_five_hour_percent",
        "codex_weekly_percent",
      ],
      thresholdSettings: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.thresholdSettings,
        usage: {
          mode: "aggregate",
          aggregateRule: {
            operator: "gte",
            value: 90,
            cooldownMinutes: 180,
          },
        },
      },
      thresholdRules: [],
    });

    expect(digest.status).toBe("ok");
    expect(digest.items.map((item) => [item.widgetKey, item.usedPercent])).toEqual([
      ["claude_five_hour_percent", 45],
      ["codex_weekly_percent", 50],
    ]);
    expect(digest.items[0]).not.toHaveProperty("thresholdTriggered");
    expect(digest.items[1]).not.toHaveProperty("thresholdTriggered");
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
          providerKey: "codex-app",
          displayName: "Codex App",
          checkedAt: NOW.toISOString(),
          freshness: "live",
          confidence: "low",
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          metrics: [
            {
              key: "total_tokens",
              value: 1918539,
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
            {
              key: "total_tokens",
              value: 83229,
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
        "codex_total_tokens",
        "openai_today_tokens",
      ],
    });
    const tray = buildTrayMenuModel(digest);

    expect(digest.items.map((item) => [item.widgetKey, item.value])).toEqual([
      ["codex_five_hour_percent", "87.5%"],
      ["codex_weekly_percent", "87%"],
      ["codex_total_tokens", "1,918,539"],
      ["openai_today_tokens", "4,200"],
    ]);
    expect(tray.items.filter((item) => item.id.startsWith("widget-")).map((item) => item.label)).toEqual([
      "Codex 5h remaining: 87.5%",
      "Codex weekly remaining: 87%",
      "Codex total tokens: 1,918,539",
      "OpenAI API TK: 4,200",
    ]);
  });

  it("includes cost, token, and CLI widgets in selected HUD payload order", () => {
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
          providerKey: "codex-app",
          displayName: "Codex App",
          checkedAt: NOW.toISOString(),
          freshness: "live",
          confidence: "low",
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          metrics: [
            {
              key: "total_tokens",
              value: 1918539,
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
              value: 22,
              unit: "percent",
            },
          ],
        },
      ],
    });
    const selectedWidgets = [
      "today_live_cost",
      "codex_five_hour_percent",
      "codex_total_tokens",
      "openai_today_tokens",
    ] as const;
    const digest = buildNotificationDigest(overview, todayLive, {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      selectedWidgets: selectedWidgets,
    });
    const hud = filterHudViewModelByWidgets(buildHudViewModel(todayLive, { digest }), selectedWidgets);

    expect(hud.items.map((item) => [item.kind, item.id])).toEqual([
      ["widget", "widget:today_live_cost"],
      ["quota", "codex-app:five_hour"],
      ["widget", "widget:codex_total_tokens"],
      ["widget", "widget:openai_today_tokens"],
    ]);
    expect(hud.items[0]).toEqual(expect.objectContaining({
      kind: "widget",
      value: "USD 4.20",
      numericValue: 420,
      unit: "USD",
    }));
    expect(hud.items[2]).toEqual(expect.objectContaining({
      kind: "widget",
      value: "1,918,539",
      numericValue: 1918539,
      unit: "tokens",
    }));
    expect(hud.items[3]).toEqual(expect.objectContaining({
      kind: "widget",
      value: "4,200",
      numericValue: 4200,
      unit: "tokens",
    }));
  });

  it("surfaces conservative Codex reset credit expiry estimates in notifications", () => {
    const overview = buildOperationsOverview(STORE_WITH_SENSITIVE_VALUES, {
      generatedAt: NOW.toISOString(),
    });
    const todayLive = buildTodayLiveView(STORE_WITH_SENSITIVE_VALUES, {
      generatedAt: NOW.toISOString(),
      now: NOW,
      timezone: "UTC",
      liveProviders: [
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
              key: "usage_reset_credit_estimate",
              value: 1,
              unit: "count",
              resetAt: "2026-06-12T02:00:00.000Z",
            },
          ],
        },
      ],
    });
    const digest = buildNotificationDigest(overview, todayLive, {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      selectedWidgets: ["codex_reset_credit_expiry"],
    });

    expect(digest.items).toEqual([
      expect.objectContaining({
        widgetKey: "codex_reset_credit_expiry",
        severity: "warning",
        value: "May expire within 3 days",
        numericValue: 3,
        unit: "days",
        freshness: "live",
        confidence: "low",
      }),
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
      backgroundColor: DEFAULT_NOTIFICATION_PREFERENCES.hud.backgroundColor,
      displayMode: DEFAULT_NOTIFICATION_PREFERENCES.hud.displayMode,
      fontColor: DEFAULT_NOTIFICATION_PREFERENCES.hud.fontColor,
      fontScale: 1.3,
      labelMode: DEFAULT_NOTIFICATION_PREFERENCES.hud.labelMode,
      opacity: 0,
      padding: DEFAULT_NOTIFICATION_PREFERENCES.hud.padding,
      rowHeight: DEFAULT_NOTIFICATION_PREFERENCES.hud.rowHeight,
      showRemainingPercent: DEFAULT_NOTIFICATION_PREFERENCES.hud.showRemainingPercent,
      showUsagePercent: DEFAULT_NOTIFICATION_PREFERENCES.hud.showUsagePercent,
      selectedWidgets: DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets,
    });
    expect(parseNotificationPreferences({
      hud: {
        alwaysOnTop: false,
        backgroundColor: "#101820",
        displayMode: "summary",
        fontColor: "#f5f7fb",
        fontScale: 0.87,
        labelMode: "icon",
        opacity: 0,
        padding: 14,
        rowHeight: 60,
        showRemainingPercent: false,
        showUsagePercent: false,
        selectedWidgets: ["openai_today_tokens"],
      },
    }).hud).toEqual({
      alwaysOnTop: false,
      backgroundColor: "#101820",
      displayMode: "singleLine",
      fontColor: "#f5f7fb",
      fontScale: 0.87,
      labelMode: "icon",
      opacity: 0,
      padding: 14,
      rowHeight: 60,
      showRemainingPercent: false,
      showUsagePercent: true,
      selectedWidgets: ["openai_today_tokens"],
    });
    expect(parseNotificationPreferences({
      hud: {
        displayMode: "cells",
      },
    }).hud).toMatchObject({
      displayMode: "cells",
    });
    expect(parseNotificationPreferences({
      hud: {
        labelMode: "icon",
      },
    }).hud).toMatchObject({
      labelMode: "icon",
    });
    expect(parseNotificationPreferences({
      hud: {
        showRemainingPercent: true,
        showUsagePercent: false,
      },
    }).hud).toMatchObject({
      showRemainingPercent: true,
      showUsagePercent: false,
    });
    expect(parseNotificationPreferences({
      hud: {
        showRemainingPercent: true,
        showUsagePercent: true,
      },
    }).hud).toMatchObject({
      showRemainingPercent: false,
      showUsagePercent: true,
    });
    expect(parseNotificationPreferences({
      hud: {
        backgroundColor: " transparent ",
      },
    }).hud.backgroundColor).toBe("transparent");
    expect(parseNotificationPreferences({
      hud: {
        backgroundColor: "url(javascript:alert(1))",
        displayMode: "floating",
        fontColor: "#fff",
        padding: 200,
        rowHeight: 2,
      },
    }).hud).toEqual({
      alwaysOnTop: DEFAULT_NOTIFICATION_PREFERENCES.hud.alwaysOnTop,
      backgroundColor: DEFAULT_NOTIFICATION_PREFERENCES.hud.backgroundColor,
      displayMode: DEFAULT_NOTIFICATION_PREFERENCES.hud.displayMode,
      fontColor: DEFAULT_NOTIFICATION_PREFERENCES.hud.fontColor,
      fontScale: DEFAULT_NOTIFICATION_PREFERENCES.hud.fontScale,
      labelMode: DEFAULT_NOTIFICATION_PREFERENCES.hud.labelMode,
      opacity: DEFAULT_NOTIFICATION_PREFERENCES.hud.opacity,
      padding: 18,
      rowHeight: 28,
      showRemainingPercent: DEFAULT_NOTIFICATION_PREFERENCES.hud.showRemainingPercent,
      showUsagePercent: DEFAULT_NOTIFICATION_PREFERENCES.hud.showUsagePercent,
      selectedWidgets: DEFAULT_NOTIFICATION_PREFERENCES.hud.selectedWidgets,
    });
    expect(parseNotificationPreferences({
      selectedWidgets: ["risk_high_count"],
      hud: {
        fontScale: 0.95,
      },
    }).hud).toEqual({
      alwaysOnTop: DEFAULT_NOTIFICATION_PREFERENCES.hud.alwaysOnTop,
      backgroundColor: DEFAULT_NOTIFICATION_PREFERENCES.hud.backgroundColor,
      displayMode: DEFAULT_NOTIFICATION_PREFERENCES.hud.displayMode,
      fontColor: DEFAULT_NOTIFICATION_PREFERENCES.hud.fontColor,
      fontScale: 0.95,
      labelMode: DEFAULT_NOTIFICATION_PREFERENCES.hud.labelMode,
      opacity: DEFAULT_NOTIFICATION_PREFERENCES.hud.opacity,
      padding: DEFAULT_NOTIFICATION_PREFERENCES.hud.padding,
      rowHeight: DEFAULT_NOTIFICATION_PREFERENCES.hud.rowHeight,
      showRemainingPercent: DEFAULT_NOTIFICATION_PREFERENCES.hud.showRemainingPercent,
      showUsagePercent: DEFAULT_NOTIFICATION_PREFERENCES.hud.showUsagePercent,
      selectedWidgets: ["risk_high_count"],
    });
    expect(parseNotificationPreferences({
      selectedWidgets: [
        "month_forecast",
        "today_live_cost",
        "risk_high_count",
        "stale_connection_count",
        "openai_today_tokens",
        "codex_five_hour_percent",
        "codex_reset_credit_count",
        "codex_reset_credit_expiry",
      ],
    }).selectedWidgets).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.selectedWidgets);
  });

  it("normalizes notification threshold cooldowns to integer minutes", () => {
    const preferences = parseNotificationPreferences({
      thresholdSettings: {
        cost: {
          mode: "aggregate",
          aggregateRule: {
            operator: "gte",
            value: 10,
            cooldownMinutes: 22.4,
          },
        },
      },
      thresholdRules: [
        {
          widgetKey: "today_live_cost",
          operator: "gte",
          value: 10,
          cooldownMinutes: 12.7,
        },
      ],
    });

    expect(preferences.thresholdSettings.cost.aggregateRule.cooldownMinutes).toBe(22);
    expect(preferences.thresholdRules).toEqual([
      {
        widgetKey: "today_live_cost",
        operator: "gte",
        value: 10,
        cooldownMinutes: 13,
      },
    ]);
  });

  it("normalizes dashboard display preferences for local CLI metrics", () => {
    expect(parseNotificationPreferences({}).dashboard).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.dashboard);
    expect(parseNotificationPreferences({
      dashboard: {
        localCliMetricKeys: ["last_request_tokens", "unknown", "total_tokens", "last_request_tokens"],
      },
    }).dashboard).toEqual({
      localCliMetricKeys: ["last_request_tokens", "total_tokens"],
      budget: DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget,
      widgetLayouts: DEFAULT_NOTIFICATION_PREFERENCES.dashboard.widgetLayouts,
    });
    expect(parseNotificationPreferences({
      dashboard: {
        localCliMetricKeys: [],
      },
    }).dashboard).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.dashboard);
    expect(parseNotificationPreferences({
      dashboard: {
        widgetLayouts: {
          overview: [
            { widgetKey: "overview_trend", visible: false, size: "wide" },
            { widgetKey: "unknown", visible: true, size: "full" },
            { widgetKey: "overview_meta", visible: true, size: "invalid" },
            { widgetKey: "overview_trend", visible: true, size: "compact" },
          ],
        },
      },
    }).dashboard.widgetLayouts.overview).toEqual([
      { widgetKey: "overview_trend", visible: false, size: "wide" },
      { widgetKey: "overview_meta", visible: true, size: "normal" },
      { widgetKey: "overview_metrics", visible: true, size: "full" },
      { widgetKey: "overview_grouping", visible: true, size: "normal" },
      { widgetKey: "overview_services", visible: true, size: "full" },
      { widgetKey: "overview_insights", visible: true, size: "normal" },
    ]);
  });
});
