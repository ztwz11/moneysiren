import type { OpenAiFirstSyncResult } from "./openai-first-sync";

export type OpenAiFirstSyncUiKind =
  | "success"
  | "partial"
  | "validation_error"
  | "save_error"
  | "unknown";

export interface OpenAiFirstSyncUiOutcome {
  kind: OpenAiFirstSyncUiKind;
  clearSecret: boolean;
  canRetryWithoutSecret: boolean;
  refreshConnectionState: boolean;
}

export function interpretOpenAiFirstSyncResult(
  result: OpenAiFirstSyncResult,
): OpenAiFirstSyncUiOutcome {
  if (result.status === "ok") {
    return outcome("success", true, false, true);
  }

  if (result.status === "partial") {
    return outcome("partial", result.credentialSaved, true, true);
  }

  if (result.stage === "validation") {
    return outcome("validation_error", false, false, false);
  }

  return outcome("save_error", false, false, false);
}

export function interpretOpenAiFirstSyncTransportFailure(
  retryingSavedCredential: boolean,
): OpenAiFirstSyncUiOutcome {
  return outcome("unknown", false, retryingSavedCredential, true);
}

function outcome(
  kind: OpenAiFirstSyncUiKind,
  clearSecret: boolean,
  canRetryWithoutSecret: boolean,
  refreshConnectionState: boolean,
): OpenAiFirstSyncUiOutcome {
  return {
    kind,
    clearSecret,
    canRetryWithoutSecret,
    refreshConnectionState,
  };
}
