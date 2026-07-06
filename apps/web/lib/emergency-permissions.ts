import { redactSensitiveString } from "../../../packages/security/src/index";
import type { EmergencyActionCandidate, EmergencyActionProvider } from "./emergency-actions";

export type EmergencyPermissionCheckStatus =
  | "not_checked"
  | "missing_emergency_credential"
  | "read_only_only"
  | "permission_unknown"
  | "permission_sufficient_for_dry_run"
  | "permission_insufficient"
  | "provider_check_unavailable";

export interface EmergencyPermissionReadiness {
  providerKey: string;
  actionKey: string;
  status: EmergencyPermissionCheckStatus;
  localOnly: true;
  secretsReturned: false;
  executeEnabled: false;
  providerWriteActionsEnabled: false;
  checkMode: "local_status_only" | "manual_provider_console" | "dry_run_capability" | "unavailable";
  summary: string;
  details: readonly string[];
  requiredPermissions: readonly string[];
  nextSteps: readonly string[];
}

type EmergencyPermissionProvider = Pick<EmergencyActionProvider,
  "providerKey" | "connectionState" | "readOnlyTestState" | "emergencyAccessState" | "credentialStore"
>;
type EmergencyPermissionCandidate = Pick<EmergencyActionCandidate,
  "actionKey" | "kind" | "requiresEmergencyCredential" | "requiredPermissions"
>;

const AWS_DRY_RUN_ACTIONS = new Set(["future_write_requirements"]);
const LOCAL_AI_PROVIDER_KEYS = new Set(["codex-cli", "codex-app", "claude-cli", "claude-app", "antigravity"]);

export function buildEmergencyPermissionReadiness(
  provider: EmergencyPermissionProvider,
  candidate: EmergencyPermissionCandidate,
): EmergencyPermissionReadiness {
  const providerKey = safeText(provider.providerKey);
  const actionKey = safeText(candidate.actionKey);
  const requiredPermissions = candidate.requiredPermissions.map(safeText);
  const emergencyState = emergencyCredentialState(provider);
  const readOnlyReady = provider.connectionState === "read_only_ready" || provider.readOnlyTestState === "read_only_ready";

  if (!candidate.requiresEmergencyCredential) {
    return readiness({
      providerKey,
      actionKey,
      status: readOnlyReady ? "read_only_only" : "not_checked",
      checkMode: "local_status_only",
      summary: readOnlyReady
        ? "This action uses read-only or manual guidance only; no emergency credential is required."
        : "This action is manual guidance only; read-only readiness has not been fully verified.",
      details: [
        "MoneySiren will not execute provider write calls for this action.",
        "Read-only credentials remain separate from future emergency credentials.",
      ],
      requiredPermissions,
      nextSteps: [
        "Review the official provider links and manual checklist.",
        "Run a read-only sync or live refresh if the displayed state looks stale.",
      ],
    });
  }

  if (!isEmergencyCredentialConfigured(emergencyState)) {
    return readiness({
      providerKey,
      actionKey,
      status: "missing_emergency_credential",
      checkMode: "local_status_only",
      summary: "A separate emergency credential is not configured for this provider.",
      details: [
        `Emergency credential state: ${emergencyState}.`,
        "Read-only credentials cannot be reused for emergency actions.",
        "Execution remains disabled even after an emergency credential is configured.",
      ],
      requiredPermissions,
      nextSteps: [
        "Create a separate emergency credential in the provider console only if a future provider-specific spec requires it.",
        "Keep using the official links and manual runbook for this release.",
      ],
    });
  }

  if (LOCAL_AI_PROVIDER_KEYS.has(providerKey)) {
    return readiness({
      providerKey,
      actionKey,
      status: "provider_check_unavailable",
      checkMode: "unavailable",
      summary: "Local AI providers do not expose a safe provider write-permission check in MoneySiren.",
      details: [
        "MoneySiren only reviews sanitized local usage metadata.",
        "Prompt text, shell commands, auth files, and raw logs must not be exposed.",
      ],
      requiredPermissions,
      nextSteps: ["Review local CLI or app state manually."],
    });
  }

  if (providerKey === "aws" && AWS_DRY_RUN_ACTIONS.has(actionKey)) {
    return readiness({
      providerKey,
      actionKey,
      status: "permission_sufficient_for_dry_run",
      checkMode: "dry_run_capability",
      summary: "An emergency credential exists, and AWS has provider-specific dry-run surfaces for some future write actions.",
      details: [
        "This release does not call AWS write APIs or AWS DryRun APIs.",
        "A future provider-specific spec must verify exact IAM permissions before execution is enabled.",
      ],
      requiredPermissions,
      nextSteps: [
        "Review the AWS permission matrix and official AWS console links.",
        "Keep execution disabled until a provider-specific write adapter is reviewed.",
      ],
    });
  }

  return readiness({
    providerKey,
    actionKey,
    status: "permission_unknown",
    checkMode: "manual_provider_console",
    summary: "An emergency credential exists, but MoneySiren cannot safely prove destructive permissions in this release.",
    details: [
      `Emergency credential state: ${emergencyState}.`,
      "Permission checks for destructive actions must be confirmed in the official provider console.",
      "Provider write execution remains disabled.",
    ],
    requiredPermissions,
    nextSteps: [
      "Open the official provider console and review the credential scope manually.",
      "Do not grant broad write permissions unless a future provider-specific spec requires them.",
    ],
  });
}

function readiness(input: Omit<EmergencyPermissionReadiness,
  "localOnly" | "secretsReturned" | "executeEnabled" | "providerWriteActionsEnabled"
>): EmergencyPermissionReadiness {
  return {
    ...input,
    summary: safeText(input.summary),
    details: input.details.map(safeText),
    requiredPermissions: input.requiredPermissions.map(safeText),
    nextSteps: input.nextSteps.map(safeText),
    localOnly: true,
    secretsReturned: false,
    executeEnabled: false,
    providerWriteActionsEnabled: false,
  };
}

function emergencyCredentialState(provider: EmergencyPermissionProvider): string {
  return safeText(provider.credentialStore?.emergencyState ?? "not_configured");
}

function isEmergencyCredentialConfigured(state: string): boolean {
  return state === "credential_store_configured" || state === "oauth_connected";
}

function safeText(value: string): string {
  return redactSensitiveString(value).slice(0, 500);
}
