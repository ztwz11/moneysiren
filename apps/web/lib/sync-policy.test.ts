import { describe, expect, it } from "vitest";
import { buildProviderSyncPolicy } from "./sync-policy";

describe("sync policy", () => {
  const now = new Date("2026-07-04T12:00:00.000Z");

  it("marks missing canonical data as initial sync required", () => {
    const policy = buildProviderSyncPolicy({
      providerKey: "openai",
      displayName: "OpenAI",
      latestCanonicalSync: null,
      latestLiveCheck: null,
      canonicalFreshness: "missing",
      liveFreshness: "stale",
    }, now);

    expect(policy).toMatchObject({
      canonicalStatus: "initial_sync_required",
      initialSyncRequired: true,
      syncCommand: "moneysiren sync --provider openai",
      localOnly: true,
    });
  });

  it("marks canonical sync as stale after the recommended provider window", () => {
    const policy = buildProviderSyncPolicy({
      providerKey: "aws",
      displayName: "AWS",
      latestCanonicalSync: "2026-07-03T20:00:00.000Z",
      latestLiveCheck: "2026-07-04T11:55:00.000Z",
      canonicalFreshness: "fresh",
      liveFreshness: "live",
    }, now);

    expect(policy.recommendedCanonicalIntervalMinutes).toBe(720);
    expect(policy.canonicalStatus).toBe("canonical_stale");
  });

  it("uses a short live TTL for local AI providers", () => {
    const policy = buildProviderSyncPolicy({
      providerKey: "codex-cli",
      displayName: "Codex",
      latestCanonicalSync: "2026-07-04T11:55:00.000Z",
      latestLiveCheck: "2026-07-04T11:59:30.000Z",
      canonicalFreshness: "fresh",
      liveFreshness: "live",
    }, now);

    expect(policy.recommendedLiveTtlSeconds).toBe(60);
    expect(policy.liveStatus).toBe("live_fresh");
  });
});
