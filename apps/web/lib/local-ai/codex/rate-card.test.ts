import { describe, expect, it } from "vitest";
import type { CodexKnownModelId, CodexModelUsage, CodexSafeModelId } from "./types";
import {
  CODEX_GPT56_RATE_CARD,
  estimateCodexCredits,
  readCodexCreditEstimateApplicability,
} from "./rate-card";

describe("GPT-5.6 Codex rate card", () => {
  it("pins the official dated Sol, Terra, and Luna token rates", () => {
    expect(CODEX_GPT56_RATE_CARD).toMatchObject({
      verifiedAt: "2026-07-10",
      unitTokens: 1_000_000,
      rates: {
        "gpt-5.6-sol": {
          inputCredits: 125,
          cachedInputCredits: 12.5,
          outputCredits: 750,
        },
        "gpt-5.6-terra": {
          inputCredits: 62.5,
          cachedInputCredits: 6.25,
          outputCredits: 375,
        },
        "gpt-5.6-luna": {
          inputCredits: 25,
          cachedInputCredits: 2.5,
          outputCredits: 150,
        },
      },
    });
  });

  it("charges cached input at the cached rate and never adds reasoning separately", () => {
    const estimate = estimateCodexCredits([
      model("gpt-5.6-sol", {
        inputTokens: 2_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 1_000_000,
        reasoningTokens: 900_000,
      }),
    ], "estimated", {
      rateCardMode: "token-based",
      executionMode: "standard",
    });

    expect(estimate).toMatchObject({
      accuracy: "estimated",
      estimatedCredits: 887.5,
      notOfficialAccountSpend: true,
      models: [{
        canonicalModelId: "gpt-5.6-sol",
        estimatedCredits: 887.5,
      }],
    });
  });

  it("keeps all three model rates separate", () => {
    const estimate = estimateCodexCredits([
      model("gpt-5.6-sol"),
      model("gpt-5.6-terra"),
      model("gpt-5.6-luna"),
    ], "bounded", {
      rateCardMode: "token-based",
      executionMode: "standard",
    });

    expect(estimate.models.map((item) => item.estimatedCredits)).toEqual([
      887.5,
      443.75,
      177.5,
    ]);
    expect(estimate.accuracy).toBe("bounded");
  });

  it("fails closed for legacy, unknown, and fast-mode applicability", () => {
    for (const applicability of [
      { rateCardMode: "legacy" as const, executionMode: "standard" as const },
      { rateCardMode: "unknown" as const, executionMode: "standard" as const },
      { rateCardMode: "token-based" as const, executionMode: "unknown" as const },
      { rateCardMode: "token-based" as const, executionMode: "fast" as const },
    ]) {
      const estimate = estimateCodexCredits([model("gpt-5.6-sol")], "estimated", applicability);

      expect(estimate.accuracy).toBe("unavailable");
      expect(estimate.estimatedCredits).toBeNull();
      expect(estimate.models[0]?.reason).not.toBeNull();
    }
  });

  it("does not guess rates for future models or cache writes", () => {
    const future = model(null, { canonicalModelId: "future-model" as CodexSafeModelId });
    const cacheWrite = model("gpt-5.6-terra", { cacheWriteTokens: 1 });

    const estimate = estimateCodexCredits([future, cacheWrite], "estimated", {
      rateCardMode: "token-based",
      executionMode: "standard",
    });

    expect(estimate.models).toMatchObject([
      { reason: "unknown-model", estimatedCredits: null },
      { reason: "cache-write-rate-unavailable", estimatedCredits: null },
    ]);
    expect(estimate.estimatedCredits).toBeNull();
  });

  it("fails the overall total closed when any mixed model is unrated", () => {
    const estimate = estimateCodexCredits([
      model("gpt-5.6-sol"),
      model(null, { canonicalModelId: "future-model" as CodexSafeModelId }),
    ], "estimated", {
      rateCardMode: "token-based",
      executionMode: "standard",
    });

    expect(estimate.models).toMatchObject([
      {
        availability: "available",
        estimatedCredits: 887.5,
        reason: null,
      },
      {
        availability: "unavailable",
        estimatedCredits: null,
        reason: "unknown-model",
      },
    ]);
    expect(estimate.estimatedCredits).toBeNull();
    expect(estimate.accuracy).toBe("unavailable");
  });

  it("requires explicit non-secret local applicability settings", () => {
    expect(readCodexCreditEstimateApplicability({
      MONEYSIREN_CODEX_RATE_CARD_MODE: "token-based",
      MONEYSIREN_CODEX_EXECUTION_MODE: "standard",
    })).toEqual({
      rateCardMode: "token-based",
      executionMode: "standard",
    });
    expect(readCodexCreditEstimateApplicability({})).toEqual({
      rateCardMode: "unknown",
      executionMode: "unknown",
    });
  });
});

function model(
  knownModelId: CodexKnownModelId | null,
  overrides: Partial<CodexModelUsage> = {},
): CodexModelUsage {
  const canonicalModelId = (overrides.canonicalModelId ?? knownModelId ?? "future-model") as CodexSafeModelId;

  return {
    canonicalModelId,
    knownModelId,
    observedModelIds: [canonicalModelId],
    inputTokens: 2_000_000,
    cachedInputTokens: 1_000_000,
    cacheWriteTokens: null,
    outputTokens: 1_000_000,
    reasoningTokens: 0,
    totalTokens: 3_000_000,
    totalTokensBasis: "explicit",
    requestCount: 1,
    ...overrides,
  };
}
