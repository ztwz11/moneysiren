import { describe, expect, it } from "vitest";
import partialCreditsFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-partial-credits.json";
import rateLimitsFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-rate-limits.json";
import accountUsageFixture from "../../../../../tests/fixtures/local-ai/codex/app-server-usage.json";
import gpt56Fixture from "../../../../../tests/fixtures/local-ai/codex/sanitized-gpt56-usage.json";
import {
  CODEX_MEASUREMENT_SCHEMA_VERSION,
  type CodexMeasurementV2,
} from "./types";

const forbiddenKeyPattern =
  /^(prompt|response|content|command|commandLine|cwd|path|raw|auth|authorization|accessToken|refreshToken|accountId|organizationId|projectId|email)$/i;
const forbiddenValuePattern =
  /(Bearer\s|sk-[A-Za-z0-9]|OpenAI-Account|auth\.json|[A-Z]:\\Users\\|\/Users\/|\/home\/)/i;

describe("Codex measurement v2 contract", () => {
  it("uses schema version 2 for the public measurement contract", () => {
    expect(CODEX_MEASUREMENT_SCHEMA_VERSION).toBe(2);

    const contractShape = {
      schemaVersion: CODEX_MEASUREMENT_SCHEMA_VERSION,
      generatedAt: "2030-01-02T00:00:00.000Z",
    } satisfies Pick<CodexMeasurementV2, "schemaVersion" | "generatedAt">;

    expect(contractShape.schemaVersion).toBe(2);
  });

  it("keeps reset-credit availableCount authoritative when details are capped", () => {
    const resetCredits = partialCreditsFixture.result.rateLimitResetCredits;

    expect(resetCredits.availableCount).toBe(3);
    expect(resetCredits.credits).toHaveLength(1);
    expect(resetCredits.credits.length).toBeLessThan(resetCredits.availableCount);
  });

  it("contains synthetic official-source fixtures for rate limits and account usage", () => {
    expect(rateLimitsFixture.result.rateLimitsByLimitId.codex.limitId).toBe("codex");
    expect(rateLimitsFixture.result.rateLimitResetCredits.availableCount).toBe(2);
    expect(accountUsageFixture.result.summary.lifetimeTokens).toBeGreaterThan(0);
    expect(accountUsageFixture.result.dailyUsageBuckets).toHaveLength(2);
  });

  it("locks the GPT-5.6 alias and separate model-bucket expectations", () => {
    expect(gpt56Fixture.expected.modelBucketCount).toBe(4);
    expect(gpt56Fixture.expected.sol.canonicalModelId).toBe("gpt-5.6-sol");
    expect(gpt56Fixture.expected.sol.totalTokens).toBe(180);
    expect(gpt56Fixture.expected.terraTotalTokens).toBe(230);
    expect(gpt56Fixture.expected.lunaTotalTokens).toBe(80);
    expect(gpt56Fixture.expected.unknownHasCreditRate).toBe(false);

    const modelIds = gpt56Fixture.records.map((record) => record.observedModelId);
    expect(modelIds).toContain("gpt-5.6");
    expect(modelIds).toContain("gpt-5.6-sol");
    expect(modelIds).toContain("gpt-5.6-terra");
    expect(modelIds).toContain("gpt-5.6-luna");
  });

  it("keeps explicit totals from being specified as additive values", () => {
    const solAlias = gpt56Fixture.records.find(
      (record) => record.eventKey === "fixture-event-sol-alias",
    );

    expect(solAlias).toBeDefined();
    expect(solAlias?.inputTokens).toBe(100);
    expect(solAlias?.cachedInputTokens).toBe(40);
    expect(solAlias?.outputTokens).toBe(20);
    expect(solAlias?.reasoningTokens).toBe(5);
    expect(solAlias?.explicitTotalTokens).toBe(120);
  });

  it("contains no forbidden fixture keys or sensitive-looking values", () => {
    for (const fixture of [
      partialCreditsFixture,
      rateLimitsFixture,
      accountUsageFixture,
      gpt56Fixture,
    ]) {
      inspectFixture(fixture);
    }
  });
});

function inspectFixture(value: unknown, key = ""): void {
  if (key.length > 0) {
    expect(key).not.toMatch(forbiddenKeyPattern);
  }

  if (typeof value === "string") {
    expect(value).not.toMatch(forbiddenValuePattern);

    if (key === "id") {
      expect(value).toContain("FAKE");
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      inspectFixture(item);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      inspectFixture(nestedValue, nestedKey);
    }
  }
}
