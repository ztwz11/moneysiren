import type {
  CodexCreditEstimate,
  CodexCreditEstimateUnavailableReason,
} from "./rate-card";

export interface CodexCreditEstimateReasonLabels {
  unavailable: string;
  rateCardNotConfirmed: string;
  legacyRateCard: string;
  executionModeNotConfirmed: string;
  fastModeUnavailable: string;
  unknownModel: string;
  cacheWriteUnavailable: string;
  invalidCachedInputSubset: string;
}

export function formatCodexCreditEstimateUnavailable(
  estimate: CodexCreditEstimate | undefined,
  labels: CodexCreditEstimateReasonLabels,
): string {
  const reasons = estimate?.models
    .flatMap((model) => model.reason === null ? [] : [model.reason])
    .filter((reason, index, values) => values.indexOf(reason) === index)
    .map((reason) => reasonLabel(reason, labels)) ?? [];

  return reasons.length === 0
    ? labels.unavailable
    : `${labels.unavailable} (${reasons.join("; ")})`;
}

function reasonLabel(
  reason: CodexCreditEstimateUnavailableReason,
  labels: CodexCreditEstimateReasonLabels,
): string {
  switch (reason) {
    case "rate-card-not-confirmed":
      return labels.rateCardNotConfirmed;
    case "legacy-rate-card":
      return labels.legacyRateCard;
    case "execution-mode-not-confirmed":
      return labels.executionModeNotConfirmed;
    case "fast-mode-rate-unavailable":
      return labels.fastModeUnavailable;
    case "unknown-model":
      return labels.unknownModel;
    case "cache-write-rate-unavailable":
      return labels.cacheWriteUnavailable;
    case "invalid-cached-input-subset":
      return labels.invalidCachedInputSubset;
  }
}
