import { describe, expect, it } from "vitest";
import { assertNoSensitivePayloadLeaks } from "../../../packages/security/src/index";
import { buildConnectionDiagnostics } from "./connection-diagnostics";

describe("connection diagnostics", () => {
  it("returns an info summary for a healthy provider", () => {
    const diagnostics = buildConnectionDiagnostics(provider());

    expect(diagnostics.severity).toBe("info");
    expect(diagnostics.details).toEqual([]);
    expect(diagnostics.nextAction).toBe("No action needed.");
  });

  it("prioritizes credential errors over stale sync details", () => {
    const diagnostics = buildConnectionDiagnostics({
      ...provider(),
      connectionState: "invalid",
      readOnlyTestState: "invalid",
      canonicalFreshness: "stale",
      liveFreshness: "stale",
    });

    expect(diagnostics.severity).toBe("critical");
    expect(diagnostics.details[0]).toEqual(expect.objectContaining({
      code: "connection_invalid",
      severity: "critical",
    }));
  });

  it("turns missing canonical data into an initial sync action", () => {
    const diagnostics = buildConnectionDiagnostics({
      ...provider(),
      canonicalFreshness: "missing",
    });

    expect(diagnostics.details).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "canonical_missing",
        nextAction: "Run moneysiren sync --provider openai.",
      }),
    ]));
  });

  it("redacts sensitive-looking values from diagnostics", () => {
    const diagnostics = buildConnectionDiagnostics({
      ...provider(),
      displayName: "OpenAI acct_fake_connection_test",
      missingEnvKeys: ["OPENAI_ADMIN_KEY", "project_fake_connection_test"],
      connectionState: "not_configured",
    });
    const serialized = JSON.stringify(diagnostics);

    expect(serialized).not.toContain("acct_fake_connection_test");
    expect(serialized).not.toContain("project_fake_connection_test");
    assertNoSensitivePayloadLeaks(diagnostics);
  });
});

function provider() {
  return {
    providerKey: "openai",
    displayName: "OpenAI",
    connectionState: "read_only_ready",
    readOnlyTestState: "read_only_ready",
    liveFreshness: "live",
    canonicalFreshness: "fresh",
    healthStatus: "ok",
    riskLevel: "low",
    latestCanonicalSync: "2026-07-04T00:00:00.000Z",
    latestLiveCheck: "2026-07-04T00:05:00.000Z",
    missingEnvKeys: [],
    requiredEnvKeys: ["OPENAI_ADMIN_KEY"],
  };
}
