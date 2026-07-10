import { describe, expect, it } from "vitest";
import type {
  CodexCreditEstimate,
  CodexCreditEstimateUnavailableReason,
} from "./rate-card";
import { formatCodexCreditEstimateUnavailable } from "./credit-estimate-presentation";

const labels = {
  unavailable: "확인 불가",
  rateCardNotConfirmed: "요율표 적용 여부를 확인하세요",
  legacyRateCard: "레거시 요율표에는 적용할 수 없습니다",
  executionModeNotConfirmed: "실행 모드를 확인하세요",
  fastModeUnavailable: "GPT-5.6 fast 요율은 제공되지 않습니다",
  unknownModel: "지원되지 않는 모델이 포함되어 있습니다",
  cacheWriteUnavailable: "캐시 쓰기 요율을 확인할 수 없습니다",
  invalidCachedInputSubset: "캐시 입력 범위가 올바르지 않습니다",
};

describe("Codex credit estimate presentation", () => {
  it("maps every stable reason to localized human-safe copy without echoing codes", () => {
    const reasons: CodexCreditEstimateUnavailableReason[] = [
      "rate-card-not-confirmed",
      "legacy-rate-card",
      "execution-mode-not-confirmed",
      "fast-mode-rate-unavailable",
      "unknown-model",
      "cache-write-rate-unavailable",
      "invalid-cached-input-subset",
    ];
    const text = formatCodexCreditEstimateUnavailable(estimate(reasons), labels);

    expect(text).toContain(labels.unavailable);
    for (const label of Object.values(labels).slice(1)) {
      expect(text).toContain(label);
    }
    for (const reason of reasons) {
      expect(text).not.toContain(reason);
    }
  });

  it("uses a generic safe label when no model reason exists", () => {
    expect(formatCodexCreditEstimateUnavailable(undefined, labels)).toBe(labels.unavailable);
  });
});

function estimate(reasons: readonly CodexCreditEstimateUnavailableReason[]): CodexCreditEstimate {
  return {
    source: "official-rate-card-x-local-token-estimate",
    accuracy: "unavailable",
    officialRateSource: "https://help.openai.com/en/articles/20001106-codex-rate-card",
    rateCardVerifiedAt: "2026-07-10",
    notOfficialAccountSpend: true,
    applicability: {
      rateCardMode: "unknown",
      executionMode: "unknown",
    },
    models: reasons.map((reason, index) => ({
      canonicalModelId: `safe-model-${index}`,
      availability: "unavailable",
      estimatedCredits: null,
      reason,
    })),
    estimatedCredits: null,
  };
}
