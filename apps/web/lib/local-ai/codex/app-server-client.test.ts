import { beforeEach, describe, expect, it } from "vitest";
import rateLimitsFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-rate-limits.json";
import accountUsageFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-usage.json";
import {
  clearCodexAppServerClientCacheForTests,
  readCodexAppServerMeasurements,
} from "./app-server-client";
import {
  normalizeCodexAccountUsageResult,
  normalizeCodexRateLimitsResult,
} from "./app-server-normalize";
import type { CodexOfficialAccountMeasurements } from "./app-server-transport";

const FETCHED_AT = "2030-01-03T00:00:00.000Z";

describe("Codex App Server client cache", () => {
  beforeEach(() => {
    clearCodexAppServerClientCacheForTests();
  });

  it("deduplicates concurrent dashboard reads", async () => {
    let callCount = 0;
    const deferred = createDeferred<CodexOfficialAccountMeasurements>();
    const read = () => {
      callCount += 1;
      return deferred.promise;
    };

    const first = readCodexAppServerMeasurements({
      cacheTtlMs: 0,
      read,
    });
    const second = readCodexAppServerMeasurements({
      cacheTtlMs: 0,
      read,
    });

    expect(callCount).toBe(1);
    deferred.resolve(availableMeasurements());

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual(secondResult);
    expect(callCount).toBe(1);
  });

  it("reuses only normalized results during the short cache window", async () => {
    let now = 1_000;
    let callCount = 0;
    const read = async () => {
      callCount += 1;
      return availableMeasurements();
    };

    const first = await readCodexAppServerMeasurements({
      cacheTtlMs: 10_000,
      clock: () => now,
      read,
    });

    now = 5_000;
    const cached = await readCodexAppServerMeasurements({
      cacheTtlMs: 10_000,
      clock: () => now,
      read,
    });

    now = 12_000;
    const refreshed = await readCodexAppServerMeasurements({
      cacheTtlMs: 10_000,
      clock: () => now,
      read,
    });

    expect(first).toBe(cached);
    expect(refreshed).not.toBe(first);
    expect(refreshed).toEqual(first);
    expect(callCount).toBe(2);
  });

  it("converts unexpected client failures into sanitized unavailable states", async () => {
    const result = await readCodexAppServerMeasurements({
      cacheTtlMs: 0,
      clock: () => Date.parse(FETCHED_AT),
      read: async () => {
        throw new Error("Bearer FAKE_PRIVATE_VALUE from C:\\Users\\FAKE\\auth.json");
      },
    });

    expect(result.rateLimits).toMatchObject({
      availability: "unavailable",
      reason: "unknown",
      data: null,
    });
    expect(result.accountUsage).toMatchObject({
      availability: "unavailable",
      reason: "unknown",
      data: null,
    });
    expect(JSON.stringify(result)).not.toContain("FAKE_PRIVATE_VALUE");
    expect(JSON.stringify(result)).not.toContain("auth.json");
  });
});

function availableMeasurements(): CodexOfficialAccountMeasurements {
  return {
    rateLimits: normalizeCodexRateLimitsResult(
      rateLimitsFixture.result,
      FETCHED_AT,
    ),
    accountUsage: normalizeCodexAccountUsageResult(
      accountUsageFixture.result,
      FETCHED_AT,
    ),
  };
}


function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}
