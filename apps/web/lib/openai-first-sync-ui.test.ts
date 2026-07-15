import { describe, expect, it } from "vitest";
import type { OpenAiFirstSyncResult } from "./openai-first-sync";
import {
  interpretOpenAiFirstSyncResult,
  interpretOpenAiFirstSyncTransportFailure,
} from "./openai-first-sync-ui";

describe("OpenAI first sync UI state", () => {
  it("clears the secret and refreshes connection state after success", () => {
    expect(interpretOpenAiFirstSyncResult(result())).toEqual({
      kind: "success",
      clearSecret: true,
      canRetryWithoutSecret: false,
      refreshConnectionState: true,
    });
  });

  it("keeps a key-free retry action after a partial canonical save", () => {
    expect(interpretOpenAiFirstSyncResult(result({
      status: "partial",
      stage: "canonical",
      code: "openai_first_sync_canonical_save_failed",
      credentialSaved: true,
      canonicalSynced: false,
    }))).toEqual({
      kind: "partial",
      clearSecret: true,
      canRetryWithoutSecret: true,
      refreshConnectionState: true,
    });
  });

  it("does not claim a transport failure is a credential save failure", () => {
    expect(interpretOpenAiFirstSyncTransportFailure(false)).toEqual({
      kind: "unknown",
      clearSecret: false,
      canRetryWithoutSecret: false,
      refreshConnectionState: true,
    });
  });

  it("preserves the retry action when a key-free retry loses its response", () => {
    expect(interpretOpenAiFirstSyncTransportFailure(true)).toMatchObject({
      kind: "unknown",
      canRetryWithoutSecret: true,
    });
  });
});

function result(overrides: Partial<OpenAiFirstSyncResult> = {}): OpenAiFirstSyncResult {
  return {
    generatedAt: "2026-07-13T03:00:00.000Z",
    providerKey: "openai",
    status: "ok",
    stage: "complete",
    code: "openai_first_sync_complete",
    credentialSaved: true,
    canonicalSynced: true,
    counts: {
      usage: 1,
      billing: 1,
      health: 0,
      estimates: 1,
      alerts: 0,
    },
    localOnly: true,
    secretsReturned: false,
    ...overrides,
  };
}
