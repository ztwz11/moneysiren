import { describe, expect, it } from "vitest";
import partialCreditsFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-partial-credits.json";
import rateLimitsFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-rate-limits.json";
import accountUsageFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-usage.json";
import {
  normalizeCodexAccountUsageResult,
  normalizeCodexRateLimitsResult,
} from "./app-server-normalize";

const FETCHED_AT = "2030-01-03T00:00:00.000Z";

describe("Codex App Server official normalization", () => {
  it("normalizes the codex rate-limit bucket and omits opaque credit ids", () => {
    const measurement = normalizeCodexRateLimitsResult(
      rateLimitsFixture.result,
      FETCHED_AT,
    );

    expect(measurement.availability).toBe("available");

    if (measurement.availability !== "available") {
      throw new Error("expected available rate limits");
    }

    expect(measurement.accuracy).toBe("official");
    expect(measurement.data.primary).toEqual({
      usedPercent: 25,
      windowDurationMinutes: 300,
      resetsAt: "2030-01-01T00:00:00.000Z",
    });
    expect(measurement.data.resetCredits?.availableCount).toBe(2);
    expect(measurement.data.resetCredits?.detailsComplete).toBe(true);
    expect(measurement.data.resetCredits?.details).toHaveLength(2);

    const normalized = JSON.stringify(measurement);
    expect(normalized).not.toContain("RateLimitResetCredit_FAKE");
    expect(normalized).not.toContain('"id"');
  });

  it("prefers rateLimitsByLimitId.codex over the compatibility bucket", () => {
    const measurement = normalizeCodexRateLimitsResult({
      rateLimits: {
        primary: {
          usedPercent: 99,
          windowDurationMins: 1,
          resetsAt: 1893456000,
        },
      },
      rateLimitsByLimitId: {
        codex: {
          primary: {
            usedPercent: 12,
            windowDurationMins: 300,
            resetsAt: 1893456000,
          },
        },
      },
      rateLimitResetCredits: null,
    }, FETCHED_AT);

    expect(measurement.availability).toBe("available");

    if (measurement.availability === "available") {
      expect(measurement.data.primary?.usedPercent).toBe(12);
      expect(measurement.data.primary?.windowDurationMinutes).toBe(300);
    }
  });

  it("keeps availableCount authoritative when detail rows are capped", () => {
    const measurement = normalizeCodexRateLimitsResult(
      partialCreditsFixture.result,
      FETCHED_AT,
    );

    expect(measurement.availability).toBe("available");

    if (measurement.availability === "available") {
      expect(measurement.data.resetCredits).toEqual({
        availableCount: 3,
        details: [{
          resetType: "codexRateLimits",
          status: "available",
          grantedAt: "2029-12-02T00:00:00.000Z",
          expiresAt: "2030-02-01T00:00:00.000Z",
          title: "FAKE capped detail",
          description: "Synthetic fixture with fewer details than availableCount.",
        }],
        detailsComplete: false,
      });
    }
  });

  it("distinguishes null, empty, and complete reset-credit details", () => {
    const onlyCount = normalizeCodexRateLimitsResult({
      rateLimits: {},
      rateLimitResetCredits: {
        availableCount: 2,
        credits: null,
      },
    }, FETCHED_AT);
    const fetchedEmpty = normalizeCodexRateLimitsResult({
      rateLimits: {},
      rateLimitResetCredits: {
        availableCount: 0,
        credits: [],
      },
    }, FETCHED_AT);

    expect(onlyCount.availability).toBe("available");
    expect(fetchedEmpty.availability).toBe("available");

    if (onlyCount.availability === "available") {
      expect(onlyCount.data.resetCredits).toEqual({
        availableCount: 2,
        details: [],
        detailsComplete: false,
      });
    }

    if (fetchedEmpty.availability === "available") {
      expect(fetchedEmpty.data.resetCredits).toEqual({
        availableCount: 0,
        details: [],
        detailsComplete: true,
      });
    }
  });

  it("redacts provider display strings that fail the safe allowlist", () => {
    const measurement = normalizeCodexRateLimitsResult({
      rateLimits: {},
      rateLimitResetCredits: {
        availableCount: 1,
        credits: [{
          id: "RateLimitResetCredit_FAKE_SECRET",
          resetType: "futureType",
          status: "futureStatus",
          grantedAt: null,
          expiresAt: null,
          title: "Bearer FAKE_PRIVATE_VALUE",
          description: "C:\\Users\\FAKE\\auth.json",
        }],
      },
      authorization: "Bearer FAKE_PRIVATE_VALUE",
    }, FETCHED_AT);

    expect(measurement.availability).toBe("available");

    if (measurement.availability === "available") {
      expect(measurement.data.resetCredits?.details[0]).toEqual({
        resetType: "unknown",
        status: "unknown",
        grantedAt: null,
        expiresAt: null,
        title: null,
        description: null,
      });
    }

    const normalized = JSON.stringify(measurement);
    expect(normalized).not.toContain("FAKE_PRIVATE_VALUE");
    expect(normalized).not.toContain("auth.json");
    expect(normalized).not.toContain("authorization");
  });

  it("normalizes account totals and daily buckets without inventing model splits", () => {
    const measurement = normalizeCodexAccountUsageResult(
      accountUsageFixture.result,
      FETCHED_AT,
    );

    expect(measurement.availability).toBe("available");

    if (measurement.availability !== "available") {
      throw new Error("expected available account usage");
    }

    expect(measurement.data.summary).toEqual({
      lifetimeTokens: 1234567,
      peakDailyTokens: 45678,
      longestRunningTurnSeconds: 540,
      currentStreakDays: 8,
      longestStreakDays: 14,
    });
    expect(measurement.data.dailyUsageBuckets).toEqual([
      { startDate: "2030-01-01", tokens: 12345 },
      { startDate: "2030-01-02", tokens: 23456 },
    ]);
    expect(measurement.data).not.toHaveProperty("models");
    expect(measurement.data).not.toHaveProperty("inputTokens");
  });

  it("returns fixed unavailable output for malformed account data", () => {
    const measurement = normalizeCodexAccountUsageResult({
      summary: {
        lifetimeTokens: "Bearer FAKE_PRIVATE_VALUE",
      },
      dailyUsageBuckets: [{
        startDate: "not-a-date",
        tokens: -1,
      }],
    }, FETCHED_AT);

    expect(measurement).toMatchObject({
      availability: "unavailable",
      accuracy: "unavailable",
      reason: "malformed-response",
      data: null,
    });
    expect(JSON.stringify(measurement)).not.toContain("FAKE_PRIVATE_VALUE");
    expect(JSON.stringify(measurement)).not.toContain("not-a-date");
  });

  it("marks a structurally empty result as no-data", () => {
    const rateLimits = normalizeCodexRateLimitsResult({}, FETCHED_AT);
    const accountUsage = normalizeCodexAccountUsageResult({}, FETCHED_AT);

    expect(rateLimits).toMatchObject({
      availability: "unavailable",
      reason: "no-data",
    });
    expect(accountUsage).toMatchObject({
      availability: "unavailable",
      reason: "no-data",
    });
  });
});
