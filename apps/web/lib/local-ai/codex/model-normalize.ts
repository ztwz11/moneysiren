import type {
  CodexKnownModelId,
  CodexSafeModelId,
} from "./types";

const SAFE_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/;

export interface NormalizedCodexModel {
  canonicalModelId: CodexSafeModelId;
  knownModelId: CodexKnownModelId | null;
  observedModelId: CodexSafeModelId;
}

export function isCodexSafeModelId(value: unknown): value is CodexSafeModelId {
  return typeof value === "string" &&
    value === value.trim().toLowerCase() &&
    SAFE_MODEL_ID_PATTERN.test(value);
}

export function normalizeCodexModelId(value: unknown): NormalizedCodexModel {
  if (!isCodexSafeModelId(value)) {
    return {
      canonicalModelId: "unknown" as CodexSafeModelId,
      knownModelId: null,
      observedModelId: "unknown" as CodexSafeModelId,
    };
  }

  const canonical = value === "gpt-5.6" ? "gpt-5.6-sol" : value;
  const knownModelId = isKnownModelId(canonical) ? canonical : null;

  return {
    canonicalModelId: canonical as CodexSafeModelId,
    knownModelId,
    observedModelId: value,
  };
}

function isKnownModelId(value: string): value is CodexKnownModelId {
  return value === "gpt-5.6-sol" ||
    value === "gpt-5.6-terra" ||
    value === "gpt-5.6-luna";
}
