import type {
  CodexKnownModelId,
  CodexMeasurementAccuracy,
  CodexModelUsage,
} from "./types";

export const CODEX_GPT56_RATE_CARD = {
  sourceUrl: "https://help.openai.com/en/articles/20001106-codex-rate-card",
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
} as const;

export type CodexRateCardMode = "token-based" | "legacy" | "unknown";
export type CodexExecutionMode = "standard" | "fast" | "unknown";

export interface CodexCreditEstimateApplicability {
  rateCardMode: CodexRateCardMode;
  executionMode: CodexExecutionMode;
}

export type CodexCreditEstimateUnavailableReason =
  | "rate-card-not-confirmed"
  | "legacy-rate-card"
  | "execution-mode-not-confirmed"
  | "fast-mode-rate-unavailable"
  | "unknown-model"
  | "cache-write-rate-unavailable"
  | "invalid-cached-input-subset";

export interface CodexModelCreditEstimate {
  canonicalModelId: string;
  availability: "available" | "unavailable";
  estimatedCredits: number | null;
  reason: CodexCreditEstimateUnavailableReason | null;
}

export interface CodexCreditEstimate {
  source: "official-rate-card-x-local-token-estimate";
  accuracy: Extract<CodexMeasurementAccuracy, "estimated" | "bounded" | "unavailable">;
  officialRateSource: typeof CODEX_GPT56_RATE_CARD.sourceUrl;
  rateCardVerifiedAt: typeof CODEX_GPT56_RATE_CARD.verifiedAt;
  notOfficialAccountSpend: true;
  applicability: CodexCreditEstimateApplicability;
  models: readonly CodexModelCreditEstimate[];
  estimatedCredits: number | null;
}

export function readCodexCreditEstimateApplicability(
  env: Record<string, string | undefined>,
): CodexCreditEstimateApplicability {
  const rateCardMode = env.MONEYSIREN_CODEX_RATE_CARD_MODE === "token-based"
    ? "token-based"
    : env.MONEYSIREN_CODEX_RATE_CARD_MODE === "legacy"
      ? "legacy"
      : "unknown";
  const executionMode = env.MONEYSIREN_CODEX_EXECUTION_MODE === "standard"
    ? "standard"
    : env.MONEYSIREN_CODEX_EXECUTION_MODE === "fast"
      ? "fast"
      : "unknown";

  return { rateCardMode, executionMode };
}

export function estimateCodexCredits(
  models: readonly CodexModelUsage[],
  accuracy: Extract<CodexMeasurementAccuracy, "estimated" | "bounded">,
  applicability: CodexCreditEstimateApplicability,
): CodexCreditEstimate {
  const applicabilityReason = unavailableApplicabilityReason(applicability);
  const estimates = models.map((model) =>
    applicabilityReason === null
      ? estimateModel(model)
      : unavailableModel(model.canonicalModelId, applicabilityReason));
  const available = estimates.filter((estimate) => estimate.availability === "available");
  const estimatedCredits = available.length === 0 || available.length !== estimates.length
    ? null
    : roundCredits(available.reduce((sum, estimate) => sum + (estimate.estimatedCredits ?? 0), 0));

  return {
    source: "official-rate-card-x-local-token-estimate",
    accuracy: estimatedCredits === null ? "unavailable" : accuracy,
    officialRateSource: CODEX_GPT56_RATE_CARD.sourceUrl,
    rateCardVerifiedAt: CODEX_GPT56_RATE_CARD.verifiedAt,
    notOfficialAccountSpend: true,
    applicability,
    models: estimates,
    estimatedCredits,
  };
}

function estimateModel(model: CodexModelUsage): CodexModelCreditEstimate {
  if (model.knownModelId === null) {
    return unavailableModel(model.canonicalModelId, "unknown-model");
  }

  if (model.cacheWriteTokens !== null && model.cacheWriteTokens > 0) {
    return unavailableModel(model.canonicalModelId, "cache-write-rate-unavailable");
  }

  if (model.cachedInputTokens > model.inputTokens) {
    return unavailableModel(model.canonicalModelId, "invalid-cached-input-subset");
  }

  const rates = CODEX_GPT56_RATE_CARD.rates[model.knownModelId];
  const uncachedInputTokens = model.inputTokens - model.cachedInputTokens;
  const estimatedCredits = (
    uncachedInputTokens * rates.inputCredits +
    model.cachedInputTokens * rates.cachedInputCredits +
    model.outputTokens * rates.outputCredits
  ) / CODEX_GPT56_RATE_CARD.unitTokens;

  return {
    canonicalModelId: model.canonicalModelId,
    availability: "available",
    estimatedCredits: roundCredits(estimatedCredits),
    reason: null,
  };
}

function unavailableApplicabilityReason(
  applicability: CodexCreditEstimateApplicability,
): CodexCreditEstimateUnavailableReason | null {
  if (applicability.rateCardMode === "legacy") {
    return "legacy-rate-card";
  }

  if (applicability.rateCardMode !== "token-based") {
    return "rate-card-not-confirmed";
  }

  if (applicability.executionMode === "fast") {
    return "fast-mode-rate-unavailable";
  }

  return applicability.executionMode === "standard"
    ? null
    : "execution-mode-not-confirmed";
}

function unavailableModel(
  canonicalModelId: string,
  reason: CodexCreditEstimateUnavailableReason,
): CodexModelCreditEstimate {
  return {
    canonicalModelId,
    availability: "unavailable",
    estimatedCredits: null,
    reason,
  };
}

function roundCredits(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
