import { describe, expect, it } from "vitest";
import { providerIconAssetFor } from "../lib/provider-icon-assets";

describe("providerIconAssetFor", () => {
  it.each([
    ["codex-cli", "openai", "openai.svg"],
    ["codex-app", "openai", "openai.svg"],
    ["claude-cli", "anthropic", "anthropic-claude.svg"],
    ["claude-app", "anthropic", "anthropic-claude.svg"],
    ["antigravity", "gemini", "google-gemini-vertex-ai.svg"],
  ])("uses the %s provider asset with the %s brand style", (providerKey, brandKey, filename) => {
    expect(providerIconAssetFor(providerKey)).toEqual({
      brandKey,
      filename,
    });
  });

  it("keeps the neutral cloud fallback for unknown providers", () => {
    expect(providerIconAssetFor("unknown-provider")).toBeUndefined();
  });
});
