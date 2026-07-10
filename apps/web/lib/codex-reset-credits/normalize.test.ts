import { describe, expect, it } from "vitest";
import type { CodexRateLimitsMeasurement } from "../local-ai/codex/types";
import { normalizeResetCreditStatus } from "./normalize";

const NOW = new Date("2030-01-25T00:00:00.000Z");
const FETCHED_AT = "2030-01-20T00:00:00.000Z";
type AvailableRateLimits = Extract<CodexRateLimitsMeasurement, { availability: "available" }>;

describe("official Codex reset-credit compatibility adapter", () => {
  it("keeps availableCount authoritative and maps only supplied details", () => {
    const status = normalizeResetCreditStatus(measurement({
      availableCount: 3,
      detailsComplete: false,
      details: [{
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: "2030-01-01T00:00:00.000Z",
        expiresAt: "2030-02-01T00:00:00.000Z",
        title: "Synthetic detail",
        description: null,
      }],
    }), NOW);

    expect(status).toMatchObject({
      schemaVersion: 2,
      source: "codex-app-server",
      accuracy: "official",
      fetchedAtUtc: FETCHED_AT,
      availableCount: 3,
      totalEarnedCount: null,
      detailsComplete: false,
    });
    expect(status.credits).toHaveLength(1);
    expect(status.credits[0]).toMatchObject({
      index: 1,
      resetType: "codexRateLimits",
      providerStatus: "available",
      grantedAtUtc: "2030-01-01T00:00:00.000Z",
      expiresAtUtc: "2030-02-01T00:00:00.000Z",
      status: "expiring-soon",
    });
  });

  it("does not invent rows when only the official count is known", () => {
    const status = normalizeResetCreditStatus(measurement({
      availableCount: 2,
      details: [],
      detailsComplete: false,
    }), NOW);

    expect(status.availableCount).toBe(2);
    expect(status.credits).toEqual([]);
    expect(status.detailsComplete).toBe(false);
  });

  it("represents absent reset-credit data without synthetic totals", () => {
    const status = normalizeResetCreditStatus(measurement(null), NOW);

    expect(status.availableCount).toBeNull();
    expect(status.totalEarnedCount).toBeNull();
    expect(status.detailsComplete).toBe(false);
    expect(status.credits).toEqual([]);
  });

  it("sorts supplied expiries and keeps unknown expiry last", () => {
    const status = normalizeResetCreditStatus(measurement({
      availableCount: 2,
      detailsComplete: true,
      details: [
        detail(null),
        detail("2030-01-26T00:00:00.000Z"),
      ],
    }), NOW);

    expect(status.credits.map((credit) => credit.expiresAtUtc)).toEqual([
      "2030-01-26T00:00:00.000Z",
      null,
    ]);
    expect(status.credits.map((credit) => credit.status)).toEqual([
      "expiring-soon",
      "unknown",
    ]);
  });
});

function measurement(
  resetCredits: AvailableRateLimits["data"]["resetCredits"],
): AvailableRateLimits {
  return {
    schemaVersion: 2,
    availability: "available",
    source: "codex-app-server-rate-limits",
    accuracy: "official",
    fetchedAt: FETCHED_AT,
    data: {
      primary: null,
      secondary: null,
      reachedType: null,
      resetCredits,
    },
  };
}

function detail(expiresAt: string | null) {
  return {
    resetType: "codexRateLimits" as const,
    status: "available" as const,
    grantedAt: null,
    expiresAt,
    title: null,
    description: null,
  };
}
