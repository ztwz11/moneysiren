import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "../../../packages/view-model/src/index";
import {
  readWebLocalNotificationDigest,
  readWebLocalTrayMenuModel,
} from "./local-notification-model";
import type { DashboardSnapshot } from "./dashboard-data";
import type { LiveTodaySnapshot } from "./live-today";

const NOW = "2026-06-10T01:30:00.000Z";

describe("web local notification model", () => {
  it("builds selected tray HUD widgets from sanitized dashboard and live snapshots", async () => {
    const options = {
      dashboardSnapshot: dashboardSnapshot(),
      liveTodaySnapshot: liveTodaySnapshot(),
      notificationPreferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        desktopEnabled: true,
        selectedWidgets: [
          "codex_five_hour_percent",
          "codex_weekly_percent",
          "openai_today_tokens",
        ],
      } satisfies NotificationPreferences,
    };
    const digest = await readWebLocalNotificationDigest(options);
    const tray = await readWebLocalTrayMenuModel(options);

    expect(digest).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      items: [
        {
          widgetKey: "codex_five_hour_percent",
          value: "100%",
        },
        {
          widgetKey: "codex_weekly_percent",
          value: "87%",
        },
        {
          widgetKey: "openai_today_tokens",
          value: "12,345",
        },
      ],
    });
    expect(tray.items.filter((item) => item.id.startsWith("widget-")).map((item) => item.label)).toEqual([
      "Codex 5h remaining: 100%",
      "Codex weekly remaining: 87%",
      "OpenAI tokens: 12,345",
    ]);
    expect(JSON.stringify({ digest, tray })).not.toContain("FAKE_SECRET");
  });
});

function dashboardSnapshot(): DashboardSnapshot {
  return {
    generatedAt: NOW,
    source: "sqlite",
    database: {
      available: true,
      reason: "ok",
    },
    summary: {
      providerCount: 2,
      totalEstimatedAmountMinor: 1200,
      totalBillingAmountMinor: 0,
      currency: "USD",
      usageSnapshotCount: 0,
      costEstimateCount: 1,
      alertCount: 0,
      criticalAlertCount: 0,
      healthStatus: "ok",
    },
    providers: [
      {
        providerKey: "openai",
        displayName: "OpenAI",
        estimatedAmountMinor: 1200,
        billingAmountMinor: 0,
        currency: "USD",
        usageSnapshotCount: 0,
        billingSnapshotCount: 0,
        costEstimateCount: 1,
        healthStatus: "ok",
        alertCount: 0,
        riskLevel: "low",
        latestCollectedAt: NOW,
      },
      {
        providerKey: "codex-cli",
        displayName: "Codex CLI",
        estimatedAmountMinor: 0,
        billingAmountMinor: 0,
        currency: "USD",
        usageSnapshotCount: 0,
        billingSnapshotCount: 0,
        costEstimateCount: 0,
        healthStatus: "ok",
        alertCount: 0,
        riskLevel: "low",
        latestCollectedAt: NOW,
      },
    ],
    usage: {
      snapshotCount: 0,
      topMetrics: [],
      latestServiceMetrics: [],
      dailyMetrics: [],
    },
    risks: [],
    health: [],
    alerts: [],
  };
}

function liveTodaySnapshot(): LiveTodaySnapshot {
  return {
    generatedAt: NOW,
    ttlSeconds: 60,
    cacheState: "fresh",
    providers: [
      {
        providerKey: "openai",
        checkedAt: NOW,
        expiresAt: "2026-06-10T01:31:00.000Z",
        ttlSeconds: 60,
        freshness: "live",
        liveGranularity: "daily_bucket",
        confidence: "low",
        provisional: true,
        todayLiveAmountMinor: 321,
        currency: "USD",
        included: true,
        status: "ok",
        usageSummary: {
          kind: "llm_subscription",
          period: "current_month",
          topServices: ["gpt-5"],
          metrics: [
            {
              key: "total_tokens",
              value: 12345,
              unit: "tokens",
            },
          ],
        },
      },
      {
        providerKey: "codex-cli",
        checkedAt: NOW,
        expiresAt: "2026-06-10T01:31:00.000Z",
        ttlSeconds: 60,
        freshness: "live",
        liveGranularity: "usage_only",
        confidence: "low",
        provisional: true,
        todayLiveAmountMinor: null,
        currency: "USD",
        included: false,
        status: "ok",
        usageSummary: {
          kind: "llm_subscription",
          period: "current_month",
          topServices: ["gpt-5"],
          metrics: [
            {
              key: "five_hour_limit_percent",
              value: 0,
              unit: "percent",
            },
            {
              key: "weekly_limit_percent",
              value: 13,
              unit: "percent",
            },
          ],
        },
      },
    ],
  };
}
