import { describe, expect, it } from "vitest";
import { assertNoSensitivePayloadLeaks } from "../../../packages/security/src/index";
import {
  buildEmergencyActionCandidates,
  buildEmergencyActionPlan,
  emergencyActionReadinessFor,
  type EmergencyActionProvider,
} from "./emergency-actions";

describe("emergency actions", () => {
  it("creates safe emergency candidates for a critical provider", () => {
    const plan = buildEmergencyActionPlan({
      ...healthyProvider(),
      providerKey: "aws",
      displayName: "AWS",
      riskLevel: "critical",
    }, new Date("2026-07-04T00:00:00.000Z"));

    expect(plan).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
      executeEnabled: false,
      highestSeverity: "critical",
    });
    expect(plan.candidates.map((candidate) => candidate.actionKey)).toEqual(expect.arrayContaining([
      "manual_runbook",
      "future_write_requirements",
      "notification_escalate",
    ]));
  });

  it("does not create candidates for a healthy low-risk provider", () => {
    expect(buildEmergencyActionCandidates(healthyProvider())).toEqual([]);
  });

  it("creates credential recovery guidance for invalid credentials", () => {
    const candidates = buildEmergencyActionCandidates({
      ...healthyProvider(),
      providerKey: "openai",
      displayName: "OpenAI",
      connectionState: "invalid",
      readOnlyTestState: "invalid",
      requiredEnvKeys: ["OPENAI_ADMIN_KEY"],
      missingEnvKeys: ["OPENAI_ADMIN_KEY"],
    });

    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionKey: "credential_recovery",
        kind: "credential_recovery",
        executeEnabled: false,
        providerWrite: false,
        readiness: "manual_ready",
      }),
    ]));
  });

  it("never returns executable candidates", () => {
    const plan = buildEmergencyActionPlan({
      ...healthyProvider(),
      providerKey: "cloudflare",
      displayName: "Cloudflare",
      healthStatus: "down",
      riskLevel: "critical",
      liveFreshness: "error",
    });

    expect(plan.candidates.length).toBeGreaterThan(0);
    expect(plan.candidates.every((candidate) => candidate.executeEnabled === false)).toBe(true);
    expect(plan.candidates.every((candidate) => candidate.providerWrite === false)).toBe(true);
    expect(JSON.stringify(plan.candidates)).not.toContain('"mode":"execute"');
    expect(plan.candidates.every((candidate) => candidate.secretsReturned === false)).toBe(true);
  });

  it("keeps future write readiness separated from read-only state", () => {
    const provider = {
      ...healthyProvider(),
      providerKey: "aws",
      displayName: "AWS",
      riskLevel: "critical",
      credentialStore: {
        emergencyState: "not_configured",
      },
    } satisfies EmergencyActionProvider;
    const futureWrite = buildEmergencyActionCandidates(provider).find((candidate) =>
      candidate.actionKey === "future_write_requirements"
    );

    expect(futureWrite).toBeDefined();
    expect(futureWrite?.readiness).toBe("missing_emergency_credential");
    expect(emergencyActionReadinessFor(provider, futureWrite!)).toBe("missing_emergency_credential");
  });

  it("redacts sensitive-looking input from serialized output", () => {
    const plan = buildEmergencyActionPlan({
      ...healthyProvider(),
      providerKey: "openai",
      displayName: "OpenAI acct_fake_emergency_test",
      riskLevel: "critical",
      setupLinks: [
        {
          label: "Usage dashboard",
          href: "https://platform.openai.com/usage?project=project_fake_emergency_test",
          description: "Open fake fixture usage dashboard",
        },
      ],
    });
    const serialized = JSON.stringify(plan);

    expect(serialized).not.toContain("acct_fake_emergency_test");
    expect(serialized).not.toContain("project_fake_emergency_test");
    assertNoSensitivePayloadLeaks(plan);
  });
});

function healthyProvider(): EmergencyActionProvider {
  return {
    providerKey: "aws",
    displayName: "AWS",
    connectionState: "read_only_ready",
    readOnlyTestState: "read_only_ready",
    emergencyAccessState: "emergency_planned",
    credentialStore: {
      emergencyState: "not_configured",
    },
    setupLinks: [
      {
        label: "Provider console",
        href: "https://example.com/provider-console",
        description: "Open provider console",
      },
    ],
    canonicalFreshness: "fresh",
    liveFreshness: "live",
    healthStatus: "ok",
    riskLevel: "low",
    missingEnvKeys: [],
    requiredEnvKeys: [],
  };
}
