import { redactSensitiveString } from "../../../packages/security/src/index";

export type SyncPolicyStatus =
  | "initial_sync_required"
  | "canonical_fresh"
  | "canonical_stale"
  | "live_fresh"
  | "live_stale"
  | "live_error";

export interface SyncPolicyInput {
  providerKey: string;
  displayName: string;
  latestCanonicalSync: string | null;
  latestLiveCheck: string | null;
  canonicalFreshness: string;
  liveFreshness: string;
}

export interface ProviderSyncPolicy {
  providerKey: string;
  displayName: string;
  canonicalStatus: "initial_sync_required" | "canonical_fresh" | "canonical_stale";
  liveStatus: "live_fresh" | "live_stale" | "live_error";
  recommendedCanonicalIntervalMinutes: number;
  recommendedLiveTtlSeconds: number;
  initialSyncRequired: boolean;
  syncCommand: string;
  summary: string;
  localOnly: true;
}

const LOCAL_AI_PROVIDER_KEYS = new Set(["codex-cli", "codex-app", "claude-cli", "claude-app", "antigravity"]);

export function buildProviderSyncPolicy(input: SyncPolicyInput, now: Date = new Date()): ProviderSyncPolicy {
  const providerKey = safeText(input.providerKey);
  const canonicalMinutes = canonicalIntervalMinutes(providerKey);
  const liveSeconds = liveTtlSeconds(providerKey);
  const canonicalStatus = canonicalSyncStatus(input, now, canonicalMinutes);
  const liveStatus = liveRefreshStatus(input, now, liveSeconds);

  return {
    providerKey,
    displayName: safeText(input.displayName),
    canonicalStatus,
    liveStatus,
    recommendedCanonicalIntervalMinutes: canonicalMinutes,
    recommendedLiveTtlSeconds: liveSeconds,
    initialSyncRequired: canonicalStatus === "initial_sync_required",
    syncCommand: `moneysiren sync --provider ${providerKey}`,
    summary: syncSummary(input.displayName, canonicalStatus, liveStatus),
    localOnly: true,
  };
}

function canonicalSyncStatus(
  input: SyncPolicyInput,
  now: Date,
  recommendedIntervalMinutes: number,
): ProviderSyncPolicy["canonicalStatus"] {
  if (input.latestCanonicalSync === null || input.canonicalFreshness === "missing") {
    return "initial_sync_required";
  }

  if (input.canonicalFreshness === "stale") {
    return "canonical_stale";
  }

  const ageMs = now.getTime() - Date.parse(input.latestCanonicalSync);
  const maxAgeMs = recommendedIntervalMinutes * 60 * 1000;

  return Number.isFinite(ageMs) && ageMs <= maxAgeMs ? "canonical_fresh" : "canonical_stale";
}

function liveRefreshStatus(
  input: SyncPolicyInput,
  now: Date,
  liveTtlSecondsValue: number,
): ProviderSyncPolicy["liveStatus"] {
  if (input.liveFreshness === "error" || input.liveFreshness === "locked") {
    return "live_error";
  }

  if (input.latestLiveCheck === null || input.liveFreshness === "stale" || input.liveFreshness === "not_configured") {
    return "live_stale";
  }

  const ageMs = now.getTime() - Date.parse(input.latestLiveCheck);
  const maxAgeMs = liveTtlSecondsValue * 1000;

  return input.liveFreshness === "live" && Number.isFinite(ageMs) && ageMs <= maxAgeMs ? "live_fresh" : "live_stale";
}

function canonicalIntervalMinutes(providerKey: string): number {
  if (providerKey === "openai") {
    return 360;
  }

  if (providerKey === "aws" || providerKey === "supabase" || providerKey === "cloudflare") {
    return 720;
  }

  return LOCAL_AI_PROVIDER_KEYS.has(providerKey) ? 60 : 720;
}

function liveTtlSeconds(providerKey: string): number {
  if (LOCAL_AI_PROVIDER_KEYS.has(providerKey)) {
    return 60;
  }

  return providerKey === "openai" ? 300 : 900;
}

function syncSummary(displayName: string, canonicalStatus: string, liveStatus: string): string {
  const name = safeText(displayName);

  if (canonicalStatus === "initial_sync_required") {
    return `${name} needs an initial sync before forecasts and history can be trusted.`;
  }

  if (canonicalStatus === "canonical_stale") {
    return `${name} canonical data is stale; run a read-only sync.`;
  }

  if (liveStatus === "live_error") {
    return `${name} live refresh failed; check provider state and keep the previous safe value.`;
  }

  if (liveStatus === "live_stale") {
    return `${name} live data is stale; refresh live data when you need current values.`;
  }

  return `${name} sync state looks fresh.`;
}

function safeText(value: string): string {
  return redactSensitiveString(value).slice(0, 500);
}
