import { describe, expect, it } from "vitest";
import {
  buildHudViewModel,
  summarizeAggregateSync,
  usageProgressFromRemainingPercent,
  usageProgressFromTokens,
  usageProgressFromUsedPercent,
  usageProgressSeverity,
  type ItemSyncView,
  type CreditPoolView,
  type TodayLiveView,
} from "./index.js";

const NOW = "2026-06-10T01:00:00.000Z";

describe("HUD view model", () => {
  it("keeps Codex App exact reset credits as a separate exact credit pool", () => {
    const hud = buildHudViewModel(todayLive([
      provider("codex-app", [
        { key: "usage_reset_credits", value: 2, unit: "count" },
        {
          key: "usage_reset_credit",
          value: 1,
          unit: "count",
          resetAt: "2026-06-20T00:00:00.000Z",
          itemKey: "reset-1",
          accuracy: "exact",
          source: "codex_app_session",
        },
        {
          key: "usage_reset_credit",
          value: 1,
          unit: "count",
          resetAt: "2026-06-21T00:00:00.000Z",
          itemKey: "reset-2",
          accuracy: "exact",
          source: "codex_app_session",
        },
      ]),
    ]));
    const pool = hud.items.find((item): item is CreditPoolView => item.kind === "credit_pool" && item.variant === "count");

    expect(pool).toMatchObject({
      kind: "credit_pool",
      providerKey: "codex-app",
      variant: "count",
      availableCount: 2,
      unresolvedCount: 0,
      nearestExpiryAt: "2026-06-20T00:00:00.000Z",
      accuracy: "exact",
      riskSeverity: "info",
    });
    expect(pool?.credits).toHaveLength(2);
  });

  it("preserves bounded Codex CLI reset credit estimates without adding them to exact credits", () => {
    const hud = buildHudViewModel(todayLive([
      provider("codex-cli", [
        { key: "usage_reset_credits", value: 1, unit: "count" },
        {
          key: "usage_reset_credit_estimate",
          value: 1,
          unit: "count",
          resetAt: "2026-06-13T01:00:00.000Z",
          resetAtLatest: "2026-06-13T01:10:00.000Z",
          itemKey: "observation-1",
          accuracy: "bounded",
          source: "count_observation",
        },
      ]),
    ]));
    const pool = hud.items.find((item): item is CreditPoolView => item.kind === "credit_pool" && item.variant === "expiry");

    expect(pool).toMatchObject({
      providerKey: "codex-cli",
      variant: "expiry",
      availableCount: 1,
      nearestExpiryAt: "2026-06-13T01:00:00.000Z",
      accuracy: "bounded",
      riskSeverity: "warning",
    });
    expect(pool?.credits).toEqual([
      expect.objectContaining({
        itemKey: "observation-1",
        expiresAt: null,
        estimatedEarliestAt: "2026-06-13T01:00:00.000Z",
        estimatedLatestAt: "2026-06-13T01:10:00.000Z",
        accuracy: "bounded",
      }),
    ]);
  });

  it("prefers exact reset credits over estimates for the same provider without summing sources", () => {
    const hud = buildHudViewModel(todayLive([
      provider("codex-app", [
        { key: "usage_reset_credits", value: 2, unit: "count" },
        { key: "usage_reset_credit", value: 1, unit: "count", resetAt: "2026-06-20T00:00:00.000Z" },
        { key: "usage_reset_credit", value: 1, unit: "count", resetAt: "2026-06-21T00:00:00.000Z" },
        { key: "usage_reset_credit_estimate", value: 1, unit: "count", resetAt: "2026-06-12T00:00:00.000Z" },
      ]),
    ]));
    const pool = hud.items.find((item): item is CreditPoolView => item.kind === "credit_pool" && item.variant === "expiry");

    expect(pool?.availableCount).toBe(2);
    expect(pool?.credits).toHaveLength(2);
    expect(pool?.nearestExpiryAt).toBe("2026-06-20T00:00:00.000Z");
    expect(pool?.accuracy).toBe("exact");
  });

  it("keeps unresolved credit count when explicit count exceeds known expiry items", () => {
    const hud = buildHudViewModel(todayLive([
      provider("codex-app", [
        { key: "usage_reset_credits", value: 3, unit: "count" },
        { key: "usage_reset_credit", value: 1, unit: "count", resetAt: "2026-06-20T00:00:00.000Z" },
        { key: "usage_reset_credit", value: 1, unit: "count", resetAt: "2026-06-21T00:00:00.000Z" },
      ]),
    ]));
    const pool = hud.items.find((item): item is CreditPoolView => item.kind === "credit_pool" && item.variant === "count");

    expect(pool).toMatchObject({
      availableCount: 3,
      unresolvedCount: 1,
    });
  });

  it("shows Codex as one HUD provider when Codex App and CLI are both present", () => {
    const hud = buildHudViewModel(todayLive([
      provider("codex-app", [
        { key: "five_hour_limit_percent", value: 12, unit: "percent" },
        { key: "usage_reset_credit", value: 1, unit: "count", resetAt: "2026-06-20T00:00:00.000Z" },
      ]),
      provider("codex-cli", [
        { key: "five_hour_limit_percent", value: 40, unit: "percent" },
        { key: "usage_reset_credit_estimate", value: 1, unit: "count", resetAt: "2026-06-13T01:00:00.000Z" },
      ]),
    ]));

    expect(hud.items.filter((item) => item.kind === "credit_pool").map((item) => item.id).sort()).toEqual([
      "codex-app:credit-pool:count",
      "codex-app:credit-pool:expiry",
    ]);
    expect(hud.items.filter((item) => item.kind === "quota" && item.window === "five_hour")).toEqual([
      expect.objectContaining({
        id: "codex-app:five_hour",
        providerKey: "codex-app",
        progress: expect.objectContaining({
          usedPercent: 12,
          remainingPercent: 88,
        }),
      }),
    ]);
  });

  it("uses used-percent direction for quota progress", () => {
    const hud = buildHudViewModel(todayLive([
      provider("codex-cli", [
        { key: "five_hour_limit_percent", value: 82, unit: "percent" },
        { key: "weekly_tokens", value: 200, unit: "tokens" },
        { key: "weekly_remaining_tokens", value: 800, unit: "tokens" },
      ]),
    ]));
    const fiveHour = hud.items.find((item) => item.kind === "quota" && item.window === "five_hour");
    const weekly = hud.items.find((item) => item.kind === "quota" && item.window === "weekly");

    expect(fiveHour).toMatchObject({
      riskSeverity: "warning",
      progress: {
        usedPercent: 82,
        remainingPercent: 18,
      },
    });
    expect(weekly).toMatchObject({
      progress: {
        usedPercent: 20,
        remainingPercent: 80,
      },
    });
  });
});

describe("sync and progress helpers", () => {
  it("summarizes aggregate sync state without treating one fresh item as all fresh", () => {
    expect(summarizeAggregateSync([
      sync("fresh"),
      sync("stale"),
    ]).status).toBe("partial");
    expect(summarizeAggregateSync([
      sync("error"),
      sync("error"),
    ]).status).toBe("error");
    expect(summarizeAggregateSync([
      sync("not_configured"),
      sync("unavailable"),
    ]).status).toBe("empty");
  });

  it("normalizes progress from used, remaining, and token values", () => {
    expect(usageProgressFromUsedPercent(82)).toMatchObject({ usedPercent: 82, remainingPercent: 18 });
    expect(usageProgressFromRemainingPercent(18)).toMatchObject({ usedPercent: 82, remainingPercent: 18 });
    expect(usageProgressFromTokens(25, 75)).toMatchObject({ usedPercent: 25, remainingPercent: 75 });
    expect(usageProgressFromTokens(0, 0)).toMatchObject({ usedPercent: null, remainingPercent: null });
    expect(usageProgressSeverity(usageProgressFromUsedPercent(95))).toBe("critical");
  });
});

function todayLive(providers: TodayLiveView["providers"]): TodayLiveView {
  return {
    generatedAt: NOW,
    localOnly: true,
    secretsReturned: false,
    timezone: "Asia/Seoul",
    dateKey: "2026-06-10",
    cacheState: "fresh",
    summary: {
      providerCount: providers.length,
      includedProviderCount: 0,
      todayLiveAmountMinor: null,
      currency: "USD",
    },
    providers,
  };
}

function provider(providerKey: "codex-app" | "codex-cli", metrics: TodayLiveView["providers"][number]["metrics"]): TodayLiveView["providers"][number] {
  return {
    providerKey,
    displayName: providerKey,
    checkedAt: NOW,
    expiresAt: "2026-06-10T01:00:05.000Z",
    ttlSeconds: 5,
    lastAttemptAt: NOW,
    lastSuccessAt: NOW,
    freshUntil: "2026-06-10T01:00:15.000Z",
    staleUntil: "2026-06-10T01:02:00.000Z",
    lastRefreshFailed: false,
    revision: 1,
    freshness: "live",
    confidence: "low",
    todayLiveAmountMinor: null,
    currency: "USD",
    included: false,
    metrics,
  };
}

function sync(state: ItemSyncView["state"]): ItemSyncView {
  return {
    state,
    observedAt: NOW,
    lastAttemptAt: NOW,
    lastSuccessAt: state === "error" ? null : NOW,
    freshUntil: null,
    staleUntil: null,
    ageSeconds: 0,
    source: "test",
    error: null,
    lastRefreshFailed: state === "error",
  };
}
