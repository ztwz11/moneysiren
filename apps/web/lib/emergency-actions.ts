import { redactSensitiveString } from "../../../packages/security/src/index";

export type EmergencyActionKind =
  | "manual_runbook"
  | "provider_console"
  | "credential_recovery"
  | "sync_recovery"
  | "notification_escalate"
  | "planned_write_requirement";

export type EmergencyActionExecutionMode =
  | "requirements_only"
  | "dry_run"
  | "manual"
  | "execute";

export type EmergencyActionReadiness =
  | "not_supported"
  | "planned"
  | "missing_emergency_credential"
  | "requires_confirmation"
  | "dry_run_ready"
  | "manual_ready"
  | "execute_ready";

export type EmergencyActionSeverity = "info" | "warning" | "critical";

export interface EmergencyActionProvider {
  providerKey: string;
  displayName: string;
  connectionState: string;
  readOnlyTestState: string;
  emergencyAccessState: string;
  credentialStore?: {
    emergencyState?: string;
  };
  setupLinks?: readonly {
    label: string;
    href: string;
    description?: string;
  }[];
  canonicalFreshness: string;
  liveFreshness: string;
  healthStatus: string;
  riskLevel: string;
  missingEnvKeys?: readonly string[];
  requiredEnvKeys?: readonly string[];
}

export interface EmergencyActionCandidate {
  id: string;
  providerKey: string;
  providerDisplayName: string;
  actionKey: string;
  kind: EmergencyActionKind;
  title: string;
  description: string;
  severity: EmergencyActionSeverity;
  mode: Exclude<EmergencyActionExecutionMode, "execute">;
  readiness: Exclude<EmergencyActionReadiness, "execute_ready">;
  executeEnabled: false;
  providerWrite: false;
  localOnly: true;
  secretsReturned: false;
  requiresEmergencyCredential: boolean;
  requiredPermissions: readonly string[];
  safeCommands: readonly EmergencySafeCommand[];
  checklist: readonly string[];
  providerConsoleHref?: string;
  reasonCodes: readonly string[];
}

export type EmergencySafeCommand =
  | "view_requirements"
  | "open_runbook"
  | "open_provider_console"
  | "copy_manual_checklist";

export interface EmergencyActionPlan {
  providerKey: string;
  providerDisplayName: string;
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  providerWriteActionsEnabled: false;
  executeEnabled: false;
  emergencyAccessState: string;
  emergencyCredentialState: string;
  candidateCount: number;
  highestSeverity: EmergencyActionSeverity | "none";
  candidates: readonly EmergencyActionCandidate[];
}

interface ProviderEmergencyGuidance {
  manualTitle: string;
  manualDescription: string;
  manualChecklist: readonly string[];
  readPermissions: readonly string[];
  futureWritePermissions: readonly string[];
  recoveryGuidance: readonly string[];
}

const LOCAL_AI_PROVIDER_KEYS = new Set([
  "codex-cli",
  "codex-app",
  "claude-cli",
  "claude-app",
  "antigravity",
]);

const PROVIDER_GUIDANCE: Readonly<Record<string, ProviderEmergencyGuidance>> = {
  aws: {
    manualTitle: "Review AWS spend drivers",
    manualDescription: "Use Cost Explorer, Budgets, and top-service cost views before considering future write actions.",
    manualChecklist: [
      "Open Cost Explorer and compare month-to-date spend with forecast.",
      "Review Budgets and anomaly alerts.",
      "Check EC2, RDS, Lambda, S3, and data transfer cost drivers.",
      "Confirm the local AWS profile still has Cost Explorer read permissions.",
    ],
    readPermissions: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
    futureWritePermissions: ["ec2:StopInstances or narrower provider-specific write permissions"],
    recoveryGuidance: ["Future stopped resources must have manual restart guidance before execution is enabled."],
  },
  openai: {
    manualTitle: "Review OpenAI usage and costs",
    manualDescription: "Use the provider dashboard and Admin API key guidance before any future key-management action.",
    manualChecklist: [
      "Open the usage and costs dashboard.",
      "Confirm the organization and project context in the provider console.",
      "Review high-usage models, projects, and API key owners manually.",
      "Use manual key rotation guidance instead of automated revoke in this build.",
    ],
    readPermissions: ["OpenAI organization usage and costs read access"],
    futureWritePermissions: ["Admin API key management permission"],
    recoveryGuidance: ["Future key revocation must include replacement key creation and rollout guidance."],
  },
  supabase: {
    manualTitle: "Review Supabase usage and health",
    manualDescription: "Use Supabase project usage, health, and credential recovery guidance before any future project action.",
    manualChecklist: [
      "Open the Supabase project dashboard.",
      "Review database, storage, auth, and edge function usage.",
      "Confirm the PAT or OAuth connection has read scopes.",
      "Regenerate local read credentials manually when needed.",
    ],
    readPermissions: ["projects:read", "analytics usage read scope"],
    futureWritePermissions: ["Project write or admin permission"],
    recoveryGuidance: ["Future project pause actions must include resume and incident recovery guidance."],
  },
  cloudflare: {
    manualTitle: "Review Cloudflare billing and usage",
    manualDescription: "Use Cloudflare billing, token permission, Workers, Pages, and zone usage guidance.",
    manualChecklist: [
      "Open the Billing dashboard.",
      "Review Account Billing Read token permissions.",
      "Check Workers, Pages, R2, D1, and zone usage manually.",
      "Regenerate local read token guidance only when the current token is invalid.",
    ],
    readPermissions: ["Account Billing Read"],
    futureWritePermissions: ["Worker route, account, or zone write permission scoped to the target"],
    recoveryGuidance: ["Future Worker or zone actions must include re-enable guidance."],
  },
};

const LOCAL_AI_GUIDANCE: ProviderEmergencyGuidance = {
  manualTitle: "Review local AI usage state",
  manualDescription: "Review local quota and log discovery metadata without exposing prompts, shell commands, auth files, or raw logs.",
  manualChecklist: [
    "Confirm the local app or CLI is installed.",
    "Confirm MoneySiren can find usage metadata paths.",
    "Review quota percentages and reset windows only.",
    "Do not expose prompt text, shell command bodies, auth files, or raw JSONL lines.",
  ],
  readPermissions: ["Local metadata read only"],
  futureWritePermissions: [],
  recoveryGuidance: ["Fix local app or CLI configuration manually."],
};

const DEFAULT_GUIDANCE: ProviderEmergencyGuidance = {
  manualTitle: "Review provider requirements",
  manualDescription: "This provider has no provider-specific emergency runbook in this build.",
  manualChecklist: [
    "Open provider documentation.",
    "Review read-only connection state.",
    "Use manual provider console checks until a provider-specific spec exists.",
  ],
  readPermissions: ["Provider-specific read permission"],
  futureWritePermissions: [],
  recoveryGuidance: ["Provider-specific recovery guidance is required before execution can be enabled."],
};

export function buildEmergencyActionPlan(
  provider: EmergencyActionProvider,
  now: Date = new Date(),
): EmergencyActionPlan {
  const candidates = buildEmergencyActionCandidates(provider);

  return {
    providerKey: safeText(provider.providerKey),
    providerDisplayName: safeText(provider.displayName),
    generatedAt: now.toISOString(),
    localOnly: true,
    secretsReturned: false,
    providerWriteActionsEnabled: false,
    executeEnabled: false,
    emergencyAccessState: safeText(provider.emergencyAccessState),
    emergencyCredentialState: emergencyCredentialState(provider),
    candidateCount: candidates.length,
    highestSeverity: highestSeverity(candidates),
    candidates,
  };
}

export function buildEmergencyActionCandidates(
  provider: EmergencyActionProvider,
): EmergencyActionCandidate[] {
  const guidance = guidanceForProvider(provider.providerKey);
  const reasonCodes = reasonCodesFor(provider);
  const candidates: EmergencyActionCandidate[] = [];

  if (isAttentionState(provider)) {
    candidates.push(candidate(provider, {
      actionKey: "manual_runbook",
      kind: "manual_runbook",
      title: guidance.manualTitle,
      description: guidance.manualDescription,
      severity: severityFor(provider),
      mode: "manual",
      requiresEmergencyCredential: false,
      requiredPermissions: guidance.readPermissions,
      safeCommands: ["view_requirements", "open_runbook", "copy_manual_checklist"],
      checklist: guidance.manualChecklist,
      reasonCodes,
    }));
  }

  if (isCredentialRecoveryState(provider.connectionState) || isCredentialRecoveryState(provider.readOnlyTestState)) {
    candidates.push(candidate(provider, {
      actionKey: "credential_recovery",
      kind: "credential_recovery",
      title: "Recover read-only credential",
      description: "Fix the local read-only credential before attempting live reads or future emergency readiness.",
      severity: "critical",
      mode: "manual",
      requiresEmergencyCredential: false,
      requiredPermissions: guidance.readPermissions,
      safeCommands: ["view_requirements", "open_runbook", "copy_manual_checklist"],
      checklist: credentialRecoveryChecklist(provider),
      reasonCodes: [...reasonCodes, "credential_recovery_required"],
    }));
  }

  if (isLiveRecoveryState(provider.liveFreshness) || isCanonicalRecoveryState(provider.canonicalFreshness)) {
    candidates.push(candidate(provider, {
      actionKey: "sync_recovery",
      kind: "sync_recovery",
      title: "Refresh local read data",
      description: "Refresh live data or rerun read-only sync after credentials and provider availability are checked.",
      severity: provider.liveFreshness === "error" ? "critical" : "warning",
      mode: "manual",
      requiresEmergencyCredential: false,
      requiredPermissions: guidance.readPermissions,
      safeCommands: ["view_requirements", "open_runbook", "copy_manual_checklist"],
      checklist: [
        "Use Refresh live data from the local dashboard.",
        `Run moneysiren sync --provider ${safeText(provider.providerKey)} after read-only credentials are fixed.`,
        "Retry later if the provider API is temporarily unavailable.",
      ],
      reasonCodes: [...reasonCodes, "sync_or_live_recovery_required"],
    }));
  }

  const providerConsole = primaryProviderConsole(provider);
  if (providerConsole !== undefined && isAttentionState(provider)) {
    candidates.push(candidate(provider, {
      actionKey: "provider_console",
      kind: "provider_console",
      title: `Open ${safeText(providerConsole.label)}`,
      description: safeText(providerConsole.description ?? "Open the provider console for manual review."),
      severity: "info",
      mode: "manual",
      requiresEmergencyCredential: false,
      requiredPermissions: [],
      safeCommands: ["open_provider_console", "view_requirements"],
      checklist: ["Use the provider console for manual review. Do not paste credentials into MoneySiren."],
      providerConsoleHref: safeText(providerConsole.href),
      reasonCodes,
    }));
  }

  if (provider.riskLevel === "critical") {
    candidates.push(candidate(provider, {
      actionKey: "notification_escalate",
      kind: "notification_escalate",
      title: "Escalate local notification",
      description: "Use local notification and report surfaces to keep the critical state visible without mutating provider resources.",
      severity: "warning",
      mode: "manual",
      requiresEmergencyCredential: false,
      requiredPermissions: [],
      safeCommands: ["view_requirements", "copy_manual_checklist"],
      checklist: [
        "Keep the dashboard or HUD visible.",
        "Include the provider in the next local report.",
        "Use the Slack webhook only when explicitly configured for this run.",
      ],
      reasonCodes: [...reasonCodes, "critical_notification_escalation"],
    }));
  }

  if (requiresFutureWriteRequirements(provider, guidance)) {
    candidates.push(candidate(provider, {
      actionKey: "future_write_requirements",
      kind: "planned_write_requirement",
      title: "Future write action requirements",
      description: "Provider write execution is disabled. These requirements must be satisfied before a future adapter can execute.",
      severity: "critical",
      mode: "requirements_only",
      requiresEmergencyCredential: true,
      requiredPermissions: guidance.futureWritePermissions,
      safeCommands: ["view_requirements", "copy_manual_checklist"],
      checklist: [
        "Use a separate emergency credential slot.",
        "Complete a provider-specific permission matrix.",
        "Complete local dry-run readiness.",
        "Use two-step confirmation.",
        "Record a sanitized audit event.",
        ...guidance.recoveryGuidance,
      ],
      reasonCodes: [...reasonCodes, "provider_write_disabled"],
    }));
  }

  return dedupeCandidates(candidates);
}

export function emergencyActionReadinessFor(
  provider: EmergencyActionProvider,
  action: Pick<EmergencyActionCandidate, "kind" | "requiresEmergencyCredential">,
): Exclude<EmergencyActionReadiness, "execute_ready"> {
  if (action.kind === "planned_write_requirement") {
    return isEmergencyCredentialConfigured(provider) ? "requires_confirmation" : "missing_emergency_credential";
  }

  if (action.requiresEmergencyCredential && !isEmergencyCredentialConfigured(provider)) {
    return "missing_emergency_credential";
  }

  if (action.kind === "manual_runbook" ||
    action.kind === "provider_console" ||
    action.kind === "credential_recovery" ||
    action.kind === "sync_recovery" ||
    action.kind === "notification_escalate") {
    return "manual_ready";
  }

  return "planned";
}

function candidate(
  provider: EmergencyActionProvider,
  input: Omit<EmergencyActionCandidate,
    | "id"
    | "providerKey"
    | "providerDisplayName"
    | "readiness"
    | "executeEnabled"
    | "providerWrite"
    | "localOnly"
    | "secretsReturned"
  >,
): EmergencyActionCandidate {
  const providerConsoleHref = safeProviderConsoleHref(input.providerConsoleHref);
  const { providerConsoleHref: _unsafeProviderConsoleHref, ...candidateInput } = input;
  const base = {
    ...candidateInput,
    providerKey: safeText(provider.providerKey),
    providerDisplayName: safeText(provider.displayName),
    actionKey: safeText(input.actionKey),
    title: safeText(input.title),
    description: safeText(input.description),
    requiredPermissions: input.requiredPermissions.map(safeText),
    checklist: input.checklist.map(safeText),
    reasonCodes: input.reasonCodes.map(safeText),
    ...(providerConsoleHref === undefined ? {} : { providerConsoleHref }),
  };

  return {
    ...base,
    id: `${base.providerKey}:${base.actionKey}`,
    readiness: emergencyActionReadinessFor(provider, base),
    executeEnabled: false,
    providerWrite: false,
    localOnly: true,
    secretsReturned: false,
  };
}

function guidanceForProvider(providerKey: string): ProviderEmergencyGuidance {
  if (LOCAL_AI_PROVIDER_KEYS.has(providerKey)) {
    return LOCAL_AI_GUIDANCE;
  }

  return PROVIDER_GUIDANCE[providerKey] ?? DEFAULT_GUIDANCE;
}

function reasonCodesFor(provider: EmergencyActionProvider): string[] {
  return [
    provider.riskLevel === "critical" || provider.riskLevel === "warning" ? `risk_${provider.riskLevel}` : null,
    provider.healthStatus === "down" || provider.healthStatus === "degraded" ? `health_${provider.healthStatus}` : null,
    isCredentialRecoveryState(provider.connectionState) ? `connection_${provider.connectionState}` : null,
    isCredentialRecoveryState(provider.readOnlyTestState) ? `read_only_${provider.readOnlyTestState}` : null,
    isLiveRecoveryState(provider.liveFreshness) ? `live_${provider.liveFreshness}` : null,
    isCanonicalRecoveryState(provider.canonicalFreshness) ? `canonical_${provider.canonicalFreshness}` : null,
  ].filter((value): value is string => value !== null);
}

function isAttentionState(provider: EmergencyActionProvider): boolean {
  return provider.riskLevel === "critical" ||
    provider.riskLevel === "warning" ||
    provider.healthStatus === "down" ||
    provider.healthStatus === "degraded" ||
    isCredentialRecoveryState(provider.connectionState) ||
    isCredentialRecoveryState(provider.readOnlyTestState) ||
    isLiveRecoveryState(provider.liveFreshness) ||
    isCanonicalRecoveryState(provider.canonicalFreshness);
}

function isCredentialRecoveryState(state: string): boolean {
  return state === "invalid" || state === "expired" || state === "locked";
}

function isLiveRecoveryState(state: string): boolean {
  return state === "error" || state === "stale" || state === "locked";
}

function isCanonicalRecoveryState(state: string): boolean {
  return state === "stale" || state === "missing";
}

function severityFor(provider: EmergencyActionProvider): EmergencyActionSeverity {
  if (
    provider.riskLevel === "critical" ||
    provider.healthStatus === "down" ||
    provider.liveFreshness === "error" ||
    isCredentialRecoveryState(provider.connectionState) ||
    isCredentialRecoveryState(provider.readOnlyTestState)
  ) {
    return "critical";
  }

  if (
    provider.riskLevel === "warning" ||
    provider.healthStatus === "degraded" ||
    provider.liveFreshness === "stale" ||
    isCanonicalRecoveryState(provider.canonicalFreshness)
  ) {
    return "warning";
  }

  return "info";
}

function credentialRecoveryChecklist(provider: EmergencyActionProvider): string[] {
  const required = provider.requiredEnvKeys?.length
    ? `Confirm required environment keys are set by name only: ${provider.requiredEnvKeys.map(safeText).join(", ")}.`
    : "Confirm the local credential backend is unlocked and configured.";
  const missing = provider.missingEnvKeys?.length
    ? `Missing environment key names: ${provider.missingEnvKeys.map(safeText).join(", ")}.`
    : "No missing environment key names were reported.";

  return [
    required,
    missing,
    "Update or remove the read-only credential from local Connections.",
    "Refresh live data after the credential is fixed.",
  ];
}

function primaryProviderConsole(
  provider: EmergencyActionProvider,
): { label: string; href: string; description?: string } | undefined {
  return provider.setupLinks?.find((link) => /^https:\/\//.test(link.href)) ?? provider.setupLinks?.[0];
}

function requiresFutureWriteRequirements(
  provider: EmergencyActionProvider,
  guidance: ProviderEmergencyGuidance,
): boolean {
  return guidance.futureWritePermissions.length > 0 &&
    (provider.riskLevel === "critical" || provider.healthStatus === "down");
}

function isEmergencyCredentialConfigured(provider: EmergencyActionProvider): boolean {
  const state = emergencyCredentialState(provider);

  return state === "credential_store_configured" || state === "oauth_connected";
}

function emergencyCredentialState(provider: EmergencyActionProvider): string {
  return safeText(provider.credentialStore?.emergencyState ?? "not_configured");
}

function highestSeverity(candidates: readonly EmergencyActionCandidate[]): EmergencyActionSeverity | "none" {
  if (candidates.some((candidate) => candidate.severity === "critical")) {
    return "critical";
  }

  if (candidates.some((candidate) => candidate.severity === "warning")) {
    return "warning";
  }

  return candidates.length > 0 ? "info" : "none";
}

function dedupeCandidates(candidates: readonly EmergencyActionCandidate[]): EmergencyActionCandidate[] {
  const seen = new Set<string>();
  const result: EmergencyActionCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) {
      continue;
    }

    seen.add(candidate.id);
    result.push(candidate);
  }

  return result.sort(compareCandidates);
}

function compareCandidates(left: EmergencyActionCandidate, right: EmergencyActionCandidate): number {
  const severityOrder: Record<EmergencyActionSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return severityOrder[left.severity] - severityOrder[right.severity] ||
    left.actionKey.localeCompare(right.actionKey);
}

function safeText(value: string): string {
  return redactSensitiveString(value).slice(0, 500);
}

function safeProviderConsoleHref(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const redacted = safeText(value);

  if (!redacted.startsWith("https://") || redacted.includes("[REDACTED:")) {
    return undefined;
  }

  return redacted;
}
