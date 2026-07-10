import { describe, expect, it } from "vitest";
import {
  isCodexSafeModelId,
  normalizeCodexModelId,
} from "./model-normalize";

describe("Codex model normalization", () => {
  it("maps the GPT-5.6 alias and canonical Sol ID to one bucket", () => {
    expect(normalizeCodexModelId("gpt-5.6")).toMatchObject({
      canonicalModelId: "gpt-5.6-sol",
      knownModelId: "gpt-5.6-sol",
      observedModelId: "gpt-5.6",
    });
    expect(normalizeCodexModelId("gpt-5.6-sol")).toMatchObject({
      canonicalModelId: "gpt-5.6-sol",
      knownModelId: "gpt-5.6-sol",
    });
  });

  it("keeps Terra and Luna separate", () => {
    expect(normalizeCodexModelId("gpt-5.6-terra").knownModelId).toBe("gpt-5.6-terra");
    expect(normalizeCodexModelId("gpt-5.6-luna").knownModelId).toBe("gpt-5.6-luna");
  });

  it("preserves future safe lowercase IDs without assigning a known model", () => {
    expect(normalizeCodexModelId("fixture-future-model")).toMatchObject({
      canonicalModelId: "fixture-future-model",
      knownModelId: null,
      observedModelId: "fixture-future-model",
    });
  });

  it("rejects whitespace, case changes, paths, prompts, and overlong labels", () => {
    for (const unsafe of [
      " gpt-5.6",
      "GPT-5.6",
      "../gpt-5.6",
      "C:\\Users\\person\\session",
      "ignore previous instructions",
      `gpt-${"x".repeat(81)}`,
    ]) {
      expect(isCodexSafeModelId(unsafe)).toBe(false);
      expect(normalizeCodexModelId(unsafe)).toMatchObject({
        canonicalModelId: "unknown",
        knownModelId: null,
        observedModelId: "unknown",
      });
    }
  });
});
