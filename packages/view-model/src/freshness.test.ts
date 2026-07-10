import { describe, expect, it } from "vitest";
import {
  calculateProviderFreshness,
  classifyProviderFreshness,
  providerFreshnessPolicy,
  type ProviderSyncRunLike,
} from "./freshness.js";

const NOW = new Date("2026-07-10T12:00:00.000Z");

describe("provider freshness", () => {
  it("returns never before the first sync attempt", () => {
    expect(calculateProviderFreshness("openai", [], NOW)).toMatchObject({
      status: "never",
      lastAttemptAt: null,
      lastSuccessAt: null,
      dataThrough: null,
      lastRefreshFailed: false,
    });
  });

  it("treats a first failed attempt without usable data as error", () => {
    expect(calculateProviderFreshness("openai", [
      run({
        attemptedAt: "2026-07-10T11:59:00.000Z",
        status: "error",
        sanitizedMessage: "request failed for sk-fake-secret",
      }),
    ], NOW)).toMatchObject({
      status: "error",
      lastAttemptAt: "2026-07-10T11:59:00.000Z",
      lastSuccessAt: null,
      dataThrough: null,
      lastRefreshFailed: true,
      sanitizedMessage: "request failed for [redacted]",
    });
  });

  it("retains the prior data timestamp as stale after a failed refresh", () => {
    const freshness = calculateProviderFreshness("openai", [
      run({
        attemptedAt: "2026-07-10T10:00:00.000Z",
        completedAt: "2026-07-10T10:00:05.000Z",
        status: "ok",
        snapshotCount: 2,
        dataThrough: "2026-07-10T09:59:00.000Z",
      }),
      run({
        attemptedAt: "2026-07-10T11:59:00.000Z",
        completedAt: "2026-07-10T11:59:02.000Z",
        status: "error",
      }),
    ], NOW);

    expect(freshness).toMatchObject({
      status: "stale",
      lastAttemptAt: "2026-07-10T11:59:00.000Z",
      lastSuccessAt: "2026-07-10T10:00:05.000Z",
      dataThrough: "2026-07-10T09:59:00.000Z",
      lastRefreshFailed: true,
      latestRunStatus: "error",
    });
  });

  it("marks usable partial results and clears the failure after the next success", () => {
    const partial = run({
      attemptedAt: "2026-07-10T11:30:00.000Z",
      status: "partial",
      snapshotCount: 1,
      dataThrough: "2026-07-10T11:29:00.000Z",
    });

    expect(calculateProviderFreshness("openai", [partial], NOW)).toMatchObject({
      status: "partial",
      lastRefreshFailed: true,
      dataThrough: "2026-07-10T11:29:00.000Z",
    });

    expect(calculateProviderFreshness("openai", [
      partial,
      run({
        attemptedAt: "2026-07-10T11:59:00.000Z",
        status: "ok",
        snapshotCount: 1,
        dataThrough: "2026-07-10T11:58:00.000Z",
      }),
    ], NOW)).toMatchObject({
      status: "live",
      lastRefreshFailed: false,
      sanitizedMessage: null,
      dataThrough: "2026-07-10T11:58:00.000Z",
    });
  });

  it("uses the shared documented provider intervals", () => {
    expect(providerFreshnessPolicy("codex-cli")).toEqual({
      canonicalTtlSeconds: 3600,
      recommendedLiveTtlSeconds: 60,
      cacheTtlSeconds: 5,
      staleTtlSeconds: 120,
    });
    expect(providerFreshnessPolicy("openai").canonicalTtlSeconds).toBe(21600);
    expect(providerFreshnessPolicy("aws").canonicalTtlSeconds).toBe(43200);
    expect(providerFreshnessPolicy("openai").recommendedLiveTtlSeconds).toBe(300);
    expect(providerFreshnessPolicy("aws").recommendedLiveTtlSeconds).toBe(900);
  });

  it("does not report a failed refresh as live while an old value remains", () => {
    expect(classifyProviderFreshness({
      latestRunStatus: "error",
      hasUsableData: true,
      referenceAt: "2026-07-10T11:59:00.000Z",
      now: NOW,
      ttlSeconds: 60,
    })).toBe("stale");
  });
});

function run(overrides: Partial<ProviderSyncRunLike>): ProviderSyncRunLike {
  return {
    providerKey: "openai",
    attemptedAt: "2026-07-10T11:00:00.000Z",
    status: "ok",
    snapshotCount: 0,
    ...overrides,
  };
}
