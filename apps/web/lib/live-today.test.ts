import { describe, expect, it, beforeEach } from "vitest";
import { createMemoryCredentialStore } from "../../../packages/credentials/src/index";
import { readConnectionsStatus } from "./connection-status";
import {
  clearLiveTodayCache,
  readLiveTodaySnapshot,
  refreshLiveToday,
  shouldReadCodexResetCreditFallback,
  summarizeLocalAiCliUsage,
  type LiveTodayProviderCollector,
} from "./live-today";

const NOW = new Date("2026-06-08T04:00:00.000Z");

beforeEach(() => {
  clearLiveTodayCache();
});

describe("live today cache", () => {
  it("keeps live provider values in a short-lived provisional cache", async () => {
    const store = createMemoryCredentialStore({
      now: () => NOW,
    });
    await store.setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    });
    const allConnections = await readConnectionsStatus({
      credentialStore: store,
      localAiCliStatus: emptyLocalAiCliStatus(),
      now: () => NOW,
    });
    const connections = {
      ...allConnections,
      providers: allConnections.providers.filter((provider) => provider.providerKey === "openai"),
    };
    const openAiCollector: LiveTodayProviderCollector = async () => ({
      providerKey: "openai",
      status: "ok",
      checkedAt: NOW.toISOString(),
      todayLiveAmountMinor: 1234,
      currency: "USD",
      included: true,
      confidence: "medium",
      usageSummary: {
        kind: "llm_subscription",
        period: "current_month",
        metrics: [
          { key: "input_tokens", value: 1200, unit: "tokens" },
          { key: "output_tokens", value: 300, unit: "tokens" },
          { key: "model_requests", value: 7, unit: "requests" },
        ],
        topServices: ["completions:gpt-5-mini"],
      },
    });

    const refreshed = await refreshLiveToday({
      connections,
      credentialStore: store,
      now: () => NOW,
      ttlSeconds: 60,
      collectors: {
        openai: openAiCollector,
      },
    });

    expect(refreshed.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      freshness: "live",
      provisional: true,
      todayLiveAmountMinor: 1234,
      included: true,
      usageSummary: {
        kind: "llm_subscription",
        metrics: [
          { key: "input_tokens", value: 1200, unit: "tokens" },
          { key: "output_tokens", value: 300, unit: "tokens" },
          { key: "model_requests", value: 7, unit: "requests" },
        ],
      },
    });
    expect(JSON.stringify(refreshed)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");

    const stale = await readLiveTodaySnapshot({
      connections,
      credentialStore: store,
      now: () => new Date("2026-06-08T04:02:00.000Z"),
      ttlSeconds: 60,
    });

    expect(stale.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      freshness: "stale",
      included: false,
      todayLiveAmountMinor: 1234,
      usageSummary: {
        kind: "llm_subscription",
      },
    });
  });

  it("does not run collectors for unconfigured providers", async () => {
    const connections = await readConnectionsStatus({
      credentialStore: createMemoryCredentialStore({
        now: () => NOW,
      }),
      localAiCliStatus: emptyLocalAiCliStatus(),
      now: () => NOW,
    });
    let called = false;

    const snapshot = await refreshLiveToday({
      connections,
      now: () => NOW,
      collectors: {
        openai: async () => {
          called = true;
          throw new Error("should not run");
        },
      },
    });

    expect(called).toBe(false);
    expect(snapshot.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      freshness: "not_configured",
      included: false,
      status: "partial",
    });
  });

  it("auto collects local AI CLI usage on cache miss without refreshing external providers", async () => {
    const store = createMemoryCredentialStore({
      now: () => NOW,
    });
    await store.setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    });
    const connections = await readConnectionsStatus({
      credentialStore: store,
      localAiCliStatus: {
        generatedAt: NOW.toISOString(),
        localOnly: true,
        secretsReturned: false,
        providers: [
          {
            providerKey: "codex-cli",
            displayName: "Codex CLI",
            command: "codex",
            cli: {
              state: "installed",
              version: "1.2.3",
              detail: "codex-cli 1.2.3",
            },
            usage: {
              source: "codex_sessions",
              period: "current_month",
              providerKind: "codex",
              sessionCount: 2,
              turnCount: 5,
              toolCallCount: 1,
              inputTokens: null,
              outputTokens: null,
              cacheTokens: null,
              totalTokens: null,
              reasoningOutputTokens: null,
              logFileCount: 2,
              parsedUsageRecordCount: 9,
              searchedPathHint: "~\\.codex\\sessions",
              latestActivityAt: NOW.toISOString(),
              topModels: ["gpt-5"],
              statusLine: emptyStatusLineUsage(),
              message: "fake",
            },
          },
          {
            providerKey: "claude-cli",
            displayName: "Claude CLI",
            command: "claude",
            cli: {
              state: "missing",
              version: null,
              detail: null,
            },
            usage: {
              source: "claude_projects",
              period: "current_month",
              providerKind: "claude",
              sessionCount: 0,
              turnCount: 0,
              toolCallCount: 0,
              inputTokens: null,
              outputTokens: null,
              cacheTokens: null,
              totalTokens: null,
              reasoningOutputTokens: null,
              logFileCount: 0,
              parsedUsageRecordCount: 0,
              searchedPathHint: "~\\.claude\\projects",
              latestActivityAt: null,
              topModels: [],
              statusLine: emptyStatusLineUsage(),
              message: "fake",
            },
          },
        ],
      },
      now: () => NOW,
    });
    let codexCollectorCalls = 0;
    let openAiCollectorCalls = 0;

    const snapshot = await readLiveTodaySnapshot({
      connections,
      credentialStore: store,
      now: () => NOW,
      collectors: {
        "codex-cli": async () => {
          codexCollectorCalls += 1;

          return {
            providerKey: "codex-cli",
            status: "ok",
            checkedAt: NOW.toISOString(),
            todayLiveAmountMinor: null,
            currency: "USD",
            included: false,
            confidence: "low",
            usageSummary: {
              kind: "llm_subscription",
              period: "current_month",
              metrics: [
                { key: "sessions", value: 2, unit: "sessions" },
                { key: "turns", value: 5, unit: "turns" },
              ],
              topServices: ["gpt-5"],
            },
          };
        },
        openai: async () => {
          openAiCollectorCalls += 1;
          throw new Error("OpenAI should still require an explicit refresh.");
        },
      },
    });

    expect(codexCollectorCalls).toBe(1);
    expect(openAiCollectorCalls).toBe(0);
    expect(snapshot.providers.find((provider) => provider.providerKey === "codex-cli")).toMatchObject({
      freshness: "live",
      status: "ok",
      usageSummary: {
        kind: "llm_subscription",
        metrics: [
          { key: "sessions", value: 2, unit: "sessions" },
          { key: "turns", value: 5, unit: "turns" },
        ],
      },
    });
    expect(snapshot.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      status: "not_checked",
    });
  });

  it("passes the HUD scope to local collectors so optional network enrichment can stay non-blocking", async () => {
    const connections = await readConnectionsStatus({
      credentialStore: createMemoryCredentialStore({
        now: () => NOW,
      }),
      localAiCliStatus: emptyLocalAiCliStatus(),
      now: () => NOW,
    });
    const codexConnection = connections.providers.find((provider) => provider.providerKey === "codex-app");
    let observedScope: string | null = null;

    await readLiveTodaySnapshot({
      connections: {
        ...connections,
        providers: codexConnection === undefined
          ? []
          : [{
              ...codexConnection,
              connectionState: "env_configured",
            }],
      },
      now: () => NOW,
      scope: "hud",
      collectors: {
        "codex-app": async (context) => {
          observedScope = context.scope;

          return {
            providerKey: "codex-app",
            status: "partial",
            checkedAt: NOW.toISOString(),
            todayLiveAmountMinor: null,
            currency: "USD",
            included: false,
            confidence: "none",
          };
        },
      },
    });

    expect(observedScope).toBe("hud");
  });

  it("uses the undocumented reset-credit endpoint only as a non-HUD fallback", () => {
    expect(shouldReadCodexResetCreditFallback("codex-app", "hud", [])).toBe(false);
    expect(shouldReadCodexResetCreditFallback("codex-app", "all", [
      {
        label: "Full reset",
        expiresAt: "2026-07-17T00:00:00.000Z",
      },
    ])).toBe(false);
    expect(shouldReadCodexResetCreditFallback("codex-app", "all", [
      {
        label: null,
        expiresAt: null,
      },
    ])).toBe(true);
  });

  it("refreshes stale local AI CLI usage on read without refreshing external providers", async () => {
    const store = createMemoryCredentialStore({
      now: () => NOW,
    });
    await store.setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    });
    const connections = await readConnectionsStatus({
      credentialStore: store,
      localAiCliStatus: {
        generatedAt: NOW.toISOString(),
        localOnly: true,
        secretsReturned: false,
        providers: [
          {
            providerKey: "codex-cli",
            displayName: "Codex CLI",
            command: "codex",
            cli: {
              state: "installed",
              version: "1.2.3",
              detail: "codex-cli 1.2.3",
            },
            usage: {
              source: "codex_sessions",
              period: "current_month",
              providerKind: "codex",
              sessionCount: 2,
              turnCount: 5,
              toolCallCount: 1,
              inputTokens: null,
              outputTokens: null,
              cacheTokens: null,
              totalTokens: null,
              reasoningOutputTokens: null,
              logFileCount: 2,
              parsedUsageRecordCount: 9,
              searchedPathHint: "~\\.codex\\sessions",
              latestActivityAt: NOW.toISOString(),
              topModels: ["gpt-5"],
              statusLine: emptyStatusLineUsage(),
              message: "fake",
            },
          },
        ],
      },
      now: () => NOW,
    });
    let codexCollectorCalls = 0;
    let openAiCollectorCalls = 0;

    const collectors: Partial<Record<"codex-cli" | "openai", LiveTodayProviderCollector>> = {
      "codex-cli": async (context) => {
        codexCollectorCalls += 1;

        return {
          providerKey: "codex-cli",
          status: "ok",
          checkedAt: context.now.toISOString(),
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          confidence: "low",
          usageSummary: {
            kind: "llm_subscription",
            period: "current_month",
            metrics: [
              { key: "five_hour_limit_percent", value: codexCollectorCalls === 1 ? 19 : 20, unit: "percent" },
            ],
            topServices: ["gpt-5"],
          },
        };
      },
      openai: async () => {
        openAiCollectorCalls += 1;
        throw new Error("OpenAI should still require an explicit refresh.");
      },
    };

    const first = await readLiveTodaySnapshot({
      connections,
      credentialStore: store,
      now: () => NOW,
      ttlSeconds: 60,
      collectors,
    });
    const second = await readLiveTodaySnapshot({
      connections,
      credentialStore: store,
      now: () => new Date(NOW.getTime() + 6_000),
      ttlSeconds: 60,
      collectors,
    });

    expect(codexCollectorCalls).toBe(2);
    expect(openAiCollectorCalls).toBe(0);
    expect(first.providers.find((provider) => provider.providerKey === "codex-cli")).toMatchObject({
      freshness: "live",
      ttlSeconds: 5,
      usageSummary: {
        metrics: [
          { key: "five_hour_limit_percent", value: 19, unit: "percent" },
        ],
      },
    });
    expect(second.providers.find((provider) => provider.providerKey === "codex-cli")).toMatchObject({
      freshness: "live",
      ttlSeconds: 5,
      usageSummary: {
        metrics: [
          { key: "five_hour_limit_percent", value: 20, unit: "percent" },
        ],
      },
    });
  });

  it("maps estimated Codex reset credits to conservative expiry metrics", () => {
    const summary = summarizeLocalAiCliUsage({
      providerKey: "codex-cli",
      displayName: "Codex CLI",
      command: "codex",
      cli: {
        state: "installed",
        version: "1.2.3",
        detail: "codex-cli 1.2.3",
      },
      usage: {
        source: "codex_sessions",
        period: "current_month",
        providerKind: "codex",
        sessionCount: 0,
        turnCount: 0,
        toolCallCount: 0,
        inputTokens: null,
        outputTokens: null,
        cacheTokens: null,
        totalTokens: null,
        reasoningOutputTokens: null,
        logFileCount: 0,
        parsedUsageRecordCount: 0,
        searchedPathHint: "~\\.codex\\sessions",
        latestActivityAt: null,
        topModels: [],
        statusLine: {
          ...emptyStatusLineUsage(),
          usageResetCredits: [
            {
              label: "estimated",
              expiresAt: "2026-07-08T04:00:00.000Z",
              estimatedEarliestExpiryUtc: "2026-07-08T04:00:00.000Z",
              estimatedLatestExpiryUtc: "2026-07-08T04:10:00.000Z",
              observedFromUtc: "2026-06-08T04:00:00.000Z",
              observedToUtc: "2026-06-08T04:10:00.000Z",
              status: "estimated",
              isExact: false,
            },
          ],
        },
        message: "fake",
      },
    });

    expect(summary?.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "usage_reset_credits",
        value: 1,
        unit: "count",
        accuracy: "bounded",
      }),
      expect.objectContaining({
        key: "usage_reset_credit_estimate",
        value: 1,
        unit: "count",
        resetAt: "2026-07-08T04:00:00.000Z",
        resetAtLatest: "2026-07-08T04:10:00.000Z",
        accuracy: "bounded",
        source: "count_observation",
      }),
    ]));
  });

  it("uses exact Codex reset credit expiry metrics for Codex CLI when available", () => {
    const summary = summarizeLocalAiCliUsage({
      providerKey: "codex-cli",
      displayName: "Codex CLI",
      command: "codex",
      cli: {
        state: "installed",
        version: "1.2.3",
        detail: "codex-cli 1.2.3",
      },
      usage: {
        source: "codex_sessions",
        period: "current_month",
        providerKind: "codex",
        sessionCount: 0,
        turnCount: 0,
        toolCallCount: 0,
        inputTokens: null,
        outputTokens: null,
        cacheTokens: null,
        totalTokens: null,
        reasoningOutputTokens: null,
        logFileCount: 0,
        parsedUsageRecordCount: 0,
        searchedPathHint: "~\\.codex\\sessions",
        latestActivityAt: null,
        topModels: [],
        statusLine: {
          ...emptyStatusLineUsage(),
          usageResetCredits: [
            { label: null, expiresAt: null },
            { label: null, expiresAt: null },
          ],
        },
        message: "fake",
      },
    }, [
      {
        key: "usage_reset_credits",
        value: 2,
        unit: "count",
        accuracy: "exact",
        source: "codex_reset_credit_api",
      },
      {
        key: "usage_reset_credit_total_earned",
        value: 0,
        unit: "count",
        accuracy: "exact",
        source: "codex_reset_credit_api",
      },
      {
        key: "usage_reset_credit",
        value: 1,
        unit: "count",
        resetAt: "2026-07-12T02:24:13.435Z",
        itemKey: "codex-reset-credit-1",
        accuracy: "exact",
        source: "codex_reset_credit_api",
      },
      {
        key: "usage_reset_credit",
        value: 1,
        unit: "count",
        resetAt: "2026-07-18T00:39:33.013Z",
        itemKey: "codex-reset-credit-2",
        accuracy: "exact",
        source: "codex_reset_credit_api",
      },
    ]);
    const resetCreditMetrics = summary?.metrics.filter((metric) => metric.key === "usage_reset_credit") ?? [];

    expect(resetCreditMetrics).toHaveLength(2);
    expect(resetCreditMetrics).toEqual([
      expect.objectContaining({
        resetAt: "2026-07-12T02:24:13.435Z",
        accuracy: "exact",
        source: "codex_reset_credit_api",
      }),
      expect.objectContaining({
        resetAt: "2026-07-18T00:39:33.013Z",
        accuracy: "exact",
        source: "codex_reset_credit_api",
      }),
    ]);
    expect(summary?.metrics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "usage_reset_credit_estimate" }),
    ]));
  });

  it("keeps separate live cache entries for multiple provider connections", async () => {
    const store = createMemoryCredentialStore({
      now: () => NOW,
    });
    await store.setCredential("openai", "read-only", {
      connectionId: "conn_personal",
      label: "Personal",
      secret: "FAKE_OPENAI_PERSONAL_ADMIN_KEY",
      authMethod: "api_key",
    });
    await store.setCredential("openai", "read-only", {
      connectionId: "conn_work",
      label: "Work",
      secret: "FAKE_OPENAI_WORK_ADMIN_KEY",
      authMethod: "api_key",
    });
    const connections = await readConnectionsStatus({
      credentialStore: store,
      localAiCliStatus: emptyLocalAiCliStatus(),
      now: () => NOW,
    });
    const seenConnectionIds: string[] = [];

    const snapshot = await refreshLiveToday({
      connections,
      credentialStore: store,
      now: () => NOW,
      collectors: {
        openai: async (context) => {
          const connectionId = context.credentialConnection?.connectionId ?? "missing";
          seenConnectionIds.push(connectionId);

          return {
            providerKey: "openai",
            connectionId,
            ...(context.credentialConnection?.label === undefined
              ? {}
              : { connectionLabel: context.credentialConnection.label }),
            status: "ok",
            checkedAt: NOW.toISOString(),
            todayLiveAmountMinor: connectionId === "conn_work" ? 200 : 100,
            currency: "USD",
            included: true,
            confidence: "medium",
          };
        },
      },
    });
    const openAiSnapshots = snapshot.providers.filter((provider) => provider.providerKey === "openai");

    expect(seenConnectionIds.sort()).toEqual(["conn_personal", "conn_work"]);
    expect(openAiSnapshots).toEqual([
      expect.objectContaining({
        connectionId: "conn_personal",
        connectionLabel: "Personal",
        todayLiveAmountMinor: 100,
      }),
      expect.objectContaining({
        connectionId: "conn_work",
        connectionLabel: "Work",
        todayLiveAmountMinor: 200,
      }),
    ]);
  }, 90_000);

  it("redacts sensitive provider error text before returning cached live status", async () => {
    const store = createMemoryCredentialStore({
      now: () => NOW,
    });
    await store.setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    });
    const connections = await readConnectionsStatus({
      credentialStore: store,
      localAiCliStatus: emptyLocalAiCliStatus(),
      now: () => NOW,
    });
    const tokenLikeValue = ["sk", "sensitive-token"].join("-");

    const snapshot = await refreshLiveToday({
      connections,
      credentialStore: store,
      now: () => NOW,
      collectors: {
        openai: async () => {
          throw new Error(`failed for acct_sensitive user@example.com with ${tokenLikeValue}`);
        },
      },
    });
    const openai = snapshot.providers.find((provider) => provider.providerKey === "openai");
    const payload = JSON.stringify(snapshot);

    expect(openai).toMatchObject({
      status: "error",
      message: expect.stringContaining("[REDACTED:account_id]"),
    });
    expect(payload).not.toContain("acct_sensitive");
    expect(payload).not.toContain("user@example.com");
    expect(payload).not.toContain(tokenLikeValue);
  }, 90_000);
});

function emptyStatusLineUsage() {
  return {
    contextWindowTokens: null,
    contextWindowLimit: null,
    contextWindowPercent: null,
    fiveHourUsedTokens: null,
    fiveHourLimitTokens: null,
    fiveHourLimitPercent: null,
    fiveHourRemainingTokens: null,
    fiveHourResetAt: null,
    weeklyUsedTokens: null,
    weeklyLimitTokens: null,
    weeklyLimitPercent: null,
    weeklyRemainingTokens: null,
    weeklyResetAt: null,
    lastInputTokens: null,
    lastOutputTokens: null,
    lastCacheTokens: null,
    lastReasoningTokens: null,
    lastTotalTokens: null,
    totalInputTokens: null,
    totalOutputTokens: null,
    totalCacheTokens: null,
    totalReasoningTokens: null,
    totalTokens: null,
    usageResetCredits: [],
  };
}

function emptyLocalAiCliStatus() {
  return {
    generatedAt: NOW.toISOString(),
    localOnly: true as const,
    secretsReturned: false as const,
    providers: [],
  };
}
