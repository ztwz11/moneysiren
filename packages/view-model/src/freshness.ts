const LOCAL_AI_PROVIDER_KEYS = new Set([
  "codex-cli",
  "codex-app",
  "claude-cli",
  "claude-app",
  "antigravity",
]);

export type ProviderFreshnessStatus = "live" | "stale" | "partial" | "error" | "never";
export type ProviderSyncRunStatus = "ok" | "partial" | "error";

export interface ProviderFreshnessPolicy {
  canonicalTtlSeconds: number;
  recommendedLiveTtlSeconds: number;
  cacheTtlSeconds: number;
  staleTtlSeconds: number;
}

export interface ProviderSyncRunLike {
  providerKey: string;
  attemptedAt: string;
  completedAt?: string | null;
  status: ProviderSyncRunStatus;
  snapshotCount: number;
  dataThrough?: string | null;
  sanitizedMessage?: string | null;
}

export interface ProviderFreshness {
  status: ProviderFreshnessStatus;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  dataThrough: string | null;
  freshUntil: string | null;
  staleUntil: string | null;
  lastRefreshFailed: boolean;
  latestRunStatus: ProviderSyncRunStatus | null;
  sanitizedMessage: string | null;
  ttlSeconds: number;
}

export function providerFreshnessPolicy(providerKey: string): ProviderFreshnessPolicy {
  if (LOCAL_AI_PROVIDER_KEYS.has(providerKey)) {
    return {
      canonicalTtlSeconds: 60 * 60,
      recommendedLiveTtlSeconds: 60,
      cacheTtlSeconds: 5,
      staleTtlSeconds: 2 * 60,
    };
  }

  if (providerKey === "openai") {
    return {
      canonicalTtlSeconds: 6 * 60 * 60,
      recommendedLiveTtlSeconds: 5 * 60,
      cacheTtlSeconds: 5 * 60,
      staleTtlSeconds: 15 * 60,
    };
  }

  return {
    canonicalTtlSeconds: 12 * 60 * 60,
    recommendedLiveTtlSeconds: 15 * 60,
    cacheTtlSeconds: 15 * 60,
    staleTtlSeconds: 15 * 60,
  };
}

export function calculateProviderFreshness(
  providerKey: string,
  runs: readonly ProviderSyncRunLike[],
  now: Date = new Date(),
): ProviderFreshness {
  const policy = providerFreshnessPolicy(providerKey);
  const providerRuns = runs
    .filter((run) => run.providerKey === providerKey && isValidIso(run.attemptedAt))
    .sort((first, second) => compareRunTime(first, second));
  const latestRun = providerRuns.at(-1) ?? null;
  const lastSuccessfulRun = [...providerRuns]
    .reverse()
    .find((run) => run.status === "ok") ?? null;
  const latestDataRun = [...providerRuns]
    .reverse()
    .find((run) => run.snapshotCount > 0 && run.dataThrough != null && isValidIso(run.dataThrough)) ?? null;
  const lastAttemptAt = latestRun?.attemptedAt ?? null;
  const lastSuccessAt = lastSuccessfulRun === null ? null : completionTime(lastSuccessfulRun);
  const dataThrough = latestDataRun?.dataThrough ?? null;
  const referenceAt = dataThrough ?? lastSuccessAt;
  const freshUntil = addSeconds(referenceAt, policy.canonicalTtlSeconds);
  const staleUntil = addSeconds(referenceAt, policy.canonicalTtlSeconds + policy.staleTtlSeconds);
  const latestRunHasData = latestRun !== null &&
    latestRun.snapshotCount > 0 &&
    latestRun.dataThrough != null &&
    isValidIso(latestRun.dataThrough);
  const status = classifyProviderFreshness({
    latestRunStatus: latestRun?.status ?? null,
    hasUsableData: referenceAt !== null,
    latestRunHasData,
    referenceAt,
    now,
    ttlSeconds: policy.canonicalTtlSeconds,
  });
  const lastRefreshFailed = latestRun !== null && latestRun.status !== "ok";

  return {
    status,
    lastAttemptAt,
    lastSuccessAt,
    dataThrough,
    freshUntil,
    staleUntil,
    lastRefreshFailed,
    latestRunStatus: latestRun?.status ?? null,
    sanitizedMessage: lastRefreshFailed
      ? sanitizeMessage(latestRun?.sanitizedMessage ?? defaultFailureMessage(latestRun?.status ?? "error"))
      : null,
    ttlSeconds: policy.canonicalTtlSeconds,
  };
}

export function classifyProviderFreshness(input: {
  latestRunStatus: ProviderSyncRunStatus | null;
  hasUsableData: boolean;
  latestRunHasData?: boolean;
  referenceAt: string | null;
  now: Date;
  ttlSeconds: number;
}): ProviderFreshnessStatus {
  if (input.latestRunStatus === null) {
    return "never";
  }

  if (input.latestRunStatus === "error") {
    return input.hasUsableData ? "stale" : "error";
  }

  if (input.latestRunStatus === "partial") {
    if (!input.hasUsableData) {
      return "error";
    }

    return input.latestRunHasData === true ? "partial" : "stale";
  }

  if (input.referenceAt === null) {
    return "live";
  }

  const referenceMs = Date.parse(input.referenceAt);
  const ageMs = input.now.getTime() - referenceMs;

  return Number.isFinite(ageMs) && ageMs <= input.ttlSeconds * 1000 ? "live" : "stale";
}

function compareRunTime(first: ProviderSyncRunLike, second: ProviderSyncRunLike): number {
  const attemptedOrder = Date.parse(first.attemptedAt) - Date.parse(second.attemptedAt);

  if (attemptedOrder !== 0) {
    return attemptedOrder;
  }

  return completionTime(first).localeCompare(completionTime(second));
}

function completionTime(run: ProviderSyncRunLike): string {
  return run.completedAt != null && isValidIso(run.completedAt) ? run.completedAt : run.attemptedAt;
}

function addSeconds(value: string | null, seconds: number): string | null {
  if (value === null) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp)
    ? new Date(timestamp + seconds * 1000).toISOString()
    : null;
}

function isValidIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function defaultFailureMessage(status: ProviderSyncRunStatus): string {
  return status === "partial"
    ? "Provider sync completed with partial data."
    : "Provider sync could not be completed.";
}

function sanitizeMessage(value: string): string {
  return value
    .replace(/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g, "[redacted]")
    .replace(/\b(?:sk|sbp|xox[baprs])[-_][A-Za-z0-9_-]+\b/gi, "[redacted]")
    .replace(/\bacct[_-][A-Za-z0-9_-]+\b/gi, "[redacted]")
    .replace(/\b(?:proj|project|invoice)[_-][A-Za-z0-9_-]+\b/gi, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .slice(0, 500);
}
