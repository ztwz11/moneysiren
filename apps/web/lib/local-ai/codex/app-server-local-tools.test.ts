import { describe, expect, it } from "vitest";
import partialCreditsFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-partial-credits.json";
import rateLimitsFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-rate-limits.json";
import accountUsageFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-usage.json";
import { statusLineFromCodexOfficialMeasurements } from "../../local-tools";
import {
  normalizeCodexAccountUsageResult,
  normalizeCodexRateLimitsResult,
} from "./app-server-normalize";

const FETCHED_AT = "2030-01-03T00:00:00.000Z";

describe("Codex official local-tools adapter", () => {
  it("maps official quota windows and exact supplied credit details", () => {
    const statusLine = statusLineFromCodexOfficialMeasurements({
      rateLimits: normalizeCodexRateLimitsResult(
        rateLimitsFixture.result,
        FETCHED_AT,
      ),
      accountUsage: normalizeCodexAccountUsageResult(
        accountUsageFixture.result,
        FETCHED_AT,
      ),
    }, {
      env: {},
      now: new Date(FETCHED_AT),
    });

    expect(statusLine).toMatchObject({
      fiveHourLimitPercent: 25,
      fiveHourResetAt: "2030-01-01T00:00:00.000Z",
      weeklyLimitPercent: 10,
      weeklyResetAt: "2030-01-07T00:00:00.000Z",
      usageResetCredits: [
        {
          label: "FAKE rate-limit reset",
          expiresAt: "2030-02-01T00:00:00.000Z",
          isExact: true,
        },
        {
          label: null,
          expiresAt: null,
          isExact: true,
        },
      ],
    });
  });

  it("does not invent legacy rows when availableCount exceeds supplied details", () => {
    const statusLine = statusLineFromCodexOfficialMeasurements({
      rateLimits: normalizeCodexRateLimitsResult(
        partialCreditsFixture.result,
        FETCHED_AT,
      ),
      accountUsage: normalizeCodexAccountUsageResult(
        accountUsageFixture.result,
        FETCHED_AT,
      ),
    }, {
      env: {},
      now: new Date(FETCHED_AT),
    });

    expect(statusLine?.usageResetCredits).toHaveLength(1);
    expect(statusLine?.usageResetCredits[0]).toMatchObject({
      label: "FAKE capped detail",
      expiresAt: "2030-02-01T00:00:00.000Z",
      isExact: true,
    });
  });

  it("returns no legacy quota status while preserving unavailable data separately", () => {
    const statusLine = statusLineFromCodexOfficialMeasurements({
      rateLimits: normalizeCodexRateLimitsResult({}, FETCHED_AT),
      accountUsage: normalizeCodexAccountUsageResult(
        accountUsageFixture.result,
        FETCHED_AT,
      ),
    }, {
      env: {},
      now: new Date(FETCHED_AT),
    });

    expect(statusLine).toBeNull();
  });
});
