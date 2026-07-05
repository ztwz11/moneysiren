import { redactSensitiveString } from "../../../packages/security/src/index";

export type ConnectionDiagnosticSeverity = "info" | "warning" | "critical";

export interface ConnectionDiagnosticInput {
  providerKey: string;
  displayName: string;
  connectionState: string;
  readOnlyTestState: string;
  liveFreshness: string;
  canonicalFreshness: string;
  healthStatus: string;
  riskLevel: string;
  latestCanonicalSync: string | null;
  latestLiveCheck: string | null;
  missingEnvKeys: readonly string[];
  requiredEnvKeys: readonly string[];
}

export interface ConnectionDiagnosticDetail {
  code: string;
  severity: ConnectionDiagnosticSeverity;
  title: string;
  detail: string;
  nextAction: string;
}

export interface ConnectionDiagnostics {
  providerKey: string;
  displayName: string;
  severity: ConnectionDiagnosticSeverity;
  summary: string;
  primaryCause: string;
  nextAction: string;
  details: readonly ConnectionDiagnosticDetail[];
  localOnly: true;
  secretsReturned: false;
}

export function buildConnectionDiagnostics(input: ConnectionDiagnosticInput): ConnectionDiagnostics {
  const details = detailItems(input).sort(compareDetails);
  const primary = details[0];

  return {
    providerKey: safeText(input.providerKey),
    displayName: safeText(input.displayName),
    severity: primary?.severity ?? "info",
    summary: primary === undefined
      ? `${safeText(input.displayName)} connection looks ready.`
      : `${safeText(input.displayName)} needs attention: ${primary.title}`,
    primaryCause: primary?.detail ?? "No connection, live lookup, health, or risk issue requires action.",
    nextAction: primary?.nextAction ?? "No action needed.",
    details,
    localOnly: true,
    secretsReturned: false,
  };
}

function detailItems(input: ConnectionDiagnosticInput): ConnectionDiagnosticDetail[] {
  const items: ConnectionDiagnosticDetail[] = [];

  if (input.connectionState === "not_configured") {
    items.push(detail({
      code: "connection_not_configured",
      severity: "warning",
      title: "Connection is not configured",
      detail: "MoneySiren does not see a readable local credential or environment setup for this provider.",
      nextAction: requiredEnvAction(input),
    }));
  }

  if (input.connectionState === "invalid" || input.connectionState === "expired") {
    items.push(detail({
      code: `connection_${input.connectionState}`,
      severity: "critical",
      title: "Credential is invalid or expired",
      detail: "The provider credential status indicates it cannot be used for local read-only checks.",
      nextAction: "Open Connections, replace the local read-only credential, then refresh live data.",
    }));
  }

  if (input.connectionState === "locked" || input.readOnlyTestState === "locked") {
    items.push(detail({
      code: "credential_store_locked",
      severity: "critical",
      title: "Credential store is locked",
      detail: "The local credential store is unavailable, so MoneySiren cannot complete read-only checks.",
      nextAction: "Unlock or reinitialize the local credential store, then run a live refresh.",
    }));
  }

  if (input.readOnlyTestState !== "read_only_ready" && input.connectionState !== "not_configured") {
    items.push(detail({
      code: "read_only_check_not_ready",
      severity: input.readOnlyTestState === "invalid" ? "critical" : "warning",
      title: "Read-only validation is not ready",
      detail: "The provider may be configured, but MoneySiren has not confirmed a safe read-only data read.",
      nextAction: "Run live refresh or sync after confirming the provider credential scope.",
    }));
  }

  if (input.canonicalFreshness === "missing") {
    items.push(detail({
      code: "canonical_missing",
      severity: "warning",
      title: "Initial sync is required",
      detail: "No persisted canonical sync result exists for this provider.",
      nextAction: `Run moneysiren sync --provider ${safeText(input.providerKey)}.`,
    }));
  } else if (input.canonicalFreshness === "stale") {
    items.push(detail({
      code: "canonical_stale",
      severity: "warning",
      title: "Canonical sync is stale",
      detail: `Last canonical sync: ${safeText(input.latestCanonicalSync ?? "unknown")}.`,
      nextAction: `Run moneysiren sync --provider ${safeText(input.providerKey)} before trusting forecasts.`,
    }));
  }

  if (input.liveFreshness === "error") {
    items.push(detail({
      code: "live_error",
      severity: "critical",
      title: "Live refresh failed",
      detail: "The latest live lookup failed after local provider state was selected.",
      nextAction: "Check provider status, credential scope, and try Refresh live data again.",
    }));
  } else if (input.liveFreshness === "stale") {
    items.push(detail({
      code: "live_stale",
      severity: "warning",
      title: "Live data is stale",
      detail: `Last live check: ${safeText(input.latestLiveCheck ?? "unknown")}.`,
      nextAction: "Use Refresh live data or wait for the next live refresh window.",
    }));
  }

  if (input.healthStatus === "down" || input.healthStatus === "degraded") {
    items.push(detail({
      code: `health_${input.healthStatus}`,
      severity: input.healthStatus === "down" ? "critical" : "warning",
      title: `Provider health is ${input.healthStatus}`,
      detail: "The latest health signal indicates the provider may be degraded or unavailable.",
      nextAction: "Open the official provider status or console link before changing credentials.",
    }));
  }

  if (input.riskLevel === "critical" || input.riskLevel === "warning") {
    items.push(detail({
      code: `risk_${input.riskLevel}`,
      severity: input.riskLevel === "critical" ? "critical" : "warning",
      title: `Risk level is ${input.riskLevel}`,
      detail: "Budget, stale data, health, or provider alerts put this provider into an attention state.",
      nextAction: "Review the service detail page, official provider links, and emergency readiness guidance.",
    }));
  }

  return items;
}

function requiredEnvAction(input: ConnectionDiagnosticInput): string {
  if (input.missingEnvKeys.length > 0) {
    return `Set required environment values by name: ${input.missingEnvKeys.map(safeText).join(", ")}.`;
  }

  if (input.requiredEnvKeys.length > 0) {
    return `Confirm required environment values by name: ${input.requiredEnvKeys.map(safeText).join(", ")}.`;
  }

  return "Open Connections and configure a local read-only credential.";
}

function detail(input: ConnectionDiagnosticDetail): ConnectionDiagnosticDetail {
  return {
    code: safeText(input.code),
    severity: input.severity,
    title: safeText(input.title),
    detail: safeText(input.detail),
    nextAction: safeText(input.nextAction),
  };
}

function compareDetails(left: ConnectionDiagnosticDetail, right: ConnectionDiagnosticDetail): number {
  const rank: Record<ConnectionDiagnosticSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return rank[left.severity] - rank[right.severity] || left.code.localeCompare(right.code);
}

function safeText(value: string): string {
  return redactSensitiveString(value).slice(0, 500);
}
