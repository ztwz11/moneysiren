import { describe, expect, it } from "vitest";
import { assertNoSensitivePayloadLeaks } from "../../../packages/security/src/index";
import { buildEmergencyPermissionReadiness } from "./emergency-permissions";

describe("emergency permission readiness", () => {
  it("keeps manual actions read-only and non-executable", () => {
    const readiness = buildEmergencyPermissionReadiness(provider(), {
      actionKey: "manual_runbook",
      kind: "manual_runbook",
      requiresEmergencyCredential: false,
      requiredPermissions: ["ce:GetCostAndUsage"],
    });

    expect(readiness).toMatchObject({
      status: "read_only_only",
      localOnly: true,
      secretsReturned: false,
      executeEnabled: false,
      providerWriteActionsEnabled: false,
    });
  });

  it("reports missing emergency credentials for future write requirements", () => {
    const readiness = buildEmergencyPermissionReadiness(provider(), {
      actionKey: "future_write_requirements",
      kind: "planned_write_requirement",
      requiresEmergencyCredential: true,
      requiredPermissions: ["ec2:StopInstances"],
    });

    expect(readiness.status).toBe("missing_emergency_credential");
    expect(readiness.summary).toContain("separate emergency credential");
    expect(readiness.executeEnabled).toBe(false);
  });

  it("treats AWS future actions as dry-run capable only after an emergency credential exists", () => {
    const readiness = buildEmergencyPermissionReadiness({
      ...provider(),
      credentialStore: {
        emergencyState: "credential_store_configured",
      },
    }, {
      actionKey: "future_write_requirements",
      kind: "planned_write_requirement",
      requiresEmergencyCredential: true,
      requiredPermissions: ["ec2:StopInstances"],
    });

    expect(readiness.status).toBe("permission_sufficient_for_dry_run");
    expect(readiness.checkMode).toBe("dry_run_capability");
    expect(readiness.executeEnabled).toBe(false);
  });

  it("does not leak sensitive-looking permission text", () => {
    const readiness = buildEmergencyPermissionReadiness({
      ...provider(),
      providerKey: "openai",
      credentialStore: {
        emergencyState: "credential_store_configured",
      },
    }, {
      actionKey: "future_write_requirements",
      kind: "planned_write_requirement",
      requiresEmergencyCredential: true,
      requiredPermissions: ["Admin key for acct_fake_emergency_test"],
    });
    const serialized = JSON.stringify(readiness);

    expect(serialized).not.toContain("acct_fake_emergency_test");
    assertNoSensitivePayloadLeaks(readiness);
  });
});

function provider() {
  return {
    providerKey: "aws",
    connectionState: "read_only_ready",
    readOnlyTestState: "read_only_ready",
    emergencyAccessState: "emergency_planned",
    credentialStore: {
      emergencyState: "not_configured",
    },
  };
}
