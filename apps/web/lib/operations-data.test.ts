import { describe, expect, it } from "vitest";
import type { DashboardSnapshot } from "./dashboard-data";
import { buildOperationsDashboard, resolveDashboardTimezone } from "./operations-data";

const BASE_DASHBOARD: DashboardSnapshot = {
  generatedAt: "2026-06-05T03:00:00.000Z",
  source: "sqlite",
  database: {
    available: true,
    reason: "ok",
  },
  summary: {
    providerCount: 1,
    totalEstimatedAmountMinor: 2000,
    totalBillingAmountMinor: 1100,
    currency: "USD",
    usageSnapshotCount: 2,
    costEstimateCount: 1,
    alertCount: 0,
    criticalAlertCount: 0,
    healthStatus: "ok",
  },
  providers: [
    {
      providerKey: "aws",
      displayName: "AWS Cost Explorer",
      estimatedAmountMinor: 2000,
      billingAmountMinor: 1100,
      currency: "USD",
      usageSnapshotCount: 2,
      billingSnapshotCount: 1,
      costEstimateCount: 1,
      healthStatus: "ok",
      alertCount: 0,
      riskLevel: "low",
      latestCollectedAt: "2026-06-04T15:00:00.000Z",
    },
  ],
  usage: {
    snapshotCount: 2,
    topMetrics: [],
    latestServiceMetrics: [
      {
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        service: "Amazon Elastic Compute Cloud - Compute",
        metric: "unblended_cost",
        unit: "USD",
        value: 7.12,
        collectedAt: "2026-06-04T15:00:00.000Z",
      },
      {
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        service: "Amazon Simple Storage Service",
        metric: "unblended_cost",
        unit: "USD",
        value: 3.34,
        collectedAt: "2026-06-04T15:00:00.000Z",
      },
    ],
    dailyMetrics: [
      {
        date: "2026-06-04",
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        metric: "unblended_cost",
        unit: "USD",
        value: 10.46,
        sampleCount: 2,
        latestCollectedAt: "2026-06-04T15:00:00.000Z",
      },
    ],
  },
  risks: [],
  health: [],
  alerts: [],
};

describe("operations dashboard data", () => {
  it("separates canonical and live freshness without exposing secret values", () => {
    const dashboard = buildOperationsDashboard(BASE_DASHBOARD, {
      env: {
        AWS_PROFILE: "fake-profile",
      },
      now: new Date("2026-06-05T03:00:00.000Z"),
      timezone: "Asia/Seoul",
    });

    expect(dashboard.summary.monthForecastAmountMinor).toBe(7975);
    expect(dashboard.summary.confirmedThroughYesterdayAmountMinor).toBe(1100);
    expect(dashboard.summary.todayLiveAmountMinor).toBeNull();
    expect(dashboard.providers.map((provider) => provider.providerKey)).toEqual(expect.arrayContaining([
      "aws",
      "openai",
      "supabase",
      "cloudflare",
      "codex-cli",
      "claude-cli",
    ]));
    expect(dashboard.visibleProviders.map((provider) => provider.providerKey)).toEqual(["aws"]);
    expect(dashboard.usageTrend).toEqual([
      {
        date: "2026-06-04",
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        metric: "unblended_cost",
        unit: "USD",
        value: 10.46,
        sampleCount: 2,
        latestCollectedAt: "2026-06-04T15:00:00.000Z",
      },
    ]);
    expect(dashboard.visibleConnections.map((connection) => `${connection.providerKey}:${connection.connectionId}`)).toEqual([
      "aws:env",
    ]);
    expect(dashboard.providers.find((provider) => provider.providerKey === "aws")).toMatchObject({
      connectionState: "env_configured",
      canonicalFreshness: "fresh",
      liveFreshness: "stale",
      liveGranularity: "current_period",
      todayLiveIncluded: false,
    });
    expect(JSON.stringify(dashboard)).not.toContain("fake-profile");
  });

  it("includes only fresh safe live-today provider values in the overview total", () => {
    const dashboard = buildOperationsDashboard(BASE_DASHBOARD, {
      env: {
        OPENAI_ADMIN_KEY: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      },
      now: new Date("2026-06-05T03:00:00.000Z"),
      timezone: "Asia/Seoul",
      liveToday: {
        generatedAt: "2026-06-05T03:00:00.000Z",
        ttlSeconds: 60,
        cacheState: "fresh",
        providers: [
          {
            providerKey: "openai",
            connectionId: "env",
            connectionLabel: "Environment",
            checkedAt: "2026-06-05T03:00:00.000Z",
            expiresAt: "2026-06-05T03:01:00.000Z",
            ttlSeconds: 60,
            freshness: "live",
            liveGranularity: "daily_bucket",
            confidence: "medium",
            provisional: true,
            todayLiveAmountMinor: 321,
            currency: "USD",
            included: true,
            status: "ok",
            usageSummary: {
              kind: "llm_subscription",
              period: "current_month",
              metrics: [
                { key: "input_tokens", value: 4200, unit: "tokens" },
                { key: "output_tokens", value: 900, unit: "tokens" },
                { key: "model_requests", value: 12, unit: "requests" },
              ],
              topServices: ["completions:gpt-5-mini"],
            },
          },
        ],
      },
    });

    expect(dashboard.summary.todayLiveAmountMinor).toBe(321);
    expect(dashboard.summary.todayLiveIncludedProviderCount).toBe(1);
    expect(dashboard.summary.confirmedThroughYesterdayAmountMinor).toBe(0);
    expect(dashboard.visibleProviders.map((provider) => provider.providerKey)).toEqual(["openai"]);
    expect(dashboard.visibleConnections.map((connection) => `${connection.providerKey}:${connection.connectionId}`)).toEqual([
      "openai:env",
    ]);
    expect(dashboard.visibleConnections.find((connection) => connection.providerKey === "openai")).toMatchObject({
      connectionLabel: "Environment",
      todayLiveAmountMinor: 321,
      currentUsageSummary: {
        kind: "llm_subscription",
      },
    });
    expect(dashboard.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      latestLiveCheck: "2026-06-05T03:00:00.000Z",
      todayLiveAmountMinor: 321,
      todayLiveIncluded: true,
      liveFreshness: "live",
      liveConfidence: "medium",
      currentUsageSummary: {
        kind: "llm_subscription",
        metrics: [
          { key: "input_tokens", value: 4200, unit: "tokens" },
          { key: "output_tokens", value: 900, unit: "tokens" },
          { key: "model_requests", value: 12, unit: "requests" },
        ],
      },
      setupLinks: expect.arrayContaining([
        expect.objectContaining({
          href: "https://platform.openai.com/docs/api-reference/usage/cost",
          valueHints: expect.arrayContaining(["organization usage"]),
        }),
      ]),
    });
    expect(JSON.stringify(dashboard)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");
  });

  it("keeps overview totals aggregate while exposing AWS service cost details", () => {
    const dashboard = buildOperationsDashboard(BASE_DASHBOARD, {
      env: {
        AWS_PROFILE: "fake-profile",
      },
      now: new Date("2026-06-05T03:00:00.000Z"),
      timezone: "Asia/Seoul",
    });
    const awsProvider = dashboard.providers.find((provider) => provider.providerKey === "aws");

    expect(dashboard.summary.confirmedThroughYesterdayAmountMinor).toBe(1100);
    expect(dashboard.summary.monthForecastAmountMinor).toBe(7975);
    expect(awsProvider?.serviceCostBreakdown).toEqual([
      expect.objectContaining({
        service: "Amazon Elastic Compute Cloud - Compute",
        metric: "unblended_cost",
        currency: "USD",
        amountMinor: 712,
        collectedAt: "2026-06-04T15:00:00.000Z",
      }),
      expect.objectContaining({
        service: "Amazon Simple Storage Service",
        metric: "unblended_cost",
        currency: "USD",
        amountMinor: 334,
        collectedAt: "2026-06-04T15:00:00.000Z",
      }),
    ]);
    expect(awsProvider?.serviceCostBreakdown[0]?.sharePercent).toBeCloseTo(68.0688, 4);
    expect(awsProvider?.serviceCostBreakdown[1]?.sharePercent).toBeCloseTo(31.9312, 4);
  });

  it("falls back when an invalid dashboard timezone is configured", () => {
    expect(resolveDashboardTimezone({ MONEYSIREN_TIMEZONE: "Not/AZone" })).toBeTruthy();
  });
});
