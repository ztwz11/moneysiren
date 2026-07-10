import {
  CODEX_MEASUREMENT_SCHEMA_VERSION,
  type CodexAccountUsage,
  type CodexAccountUsageMeasurement,
  type CodexDailyUsageBucket,
  type CodexRateLimitSummary,
  type CodexRateLimitsMeasurement,
  type CodexRateLimitWindow,
  type CodexResetCreditDetail,
  type CodexResetCreditSummary,
  type CodexUnavailableReason,
} from "./types";

const MAX_RESET_CREDIT_DETAILS = 100;
const MAX_DAILY_USAGE_BUCKETS = 400;
const SAFE_CLASSIFICATION = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_PROVIDER_TEXT = /^[\p{L}\p{N} .,;:!?()/_'\-]{1,240}$/u;
const SENSITIVE_PROVIDER_TEXT =
  /(Bearer\s|sk-[A-Za-z0-9]|authorization|access[_ -]?token|refresh[_ -]?token|auth\.json|[A-Z]:\\|\/Users\/|\/home\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i;

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false };

export function normalizeCodexRateLimitsResult(
  value: unknown,
  fetchedAt: string,
): CodexRateLimitsMeasurement {
  const root = asRecord(value);

  if (root === null) {
    return unavailableCodexRateLimits(fetchedAt, "malformed-response");
  }

  const byLimitIdValue = root.rateLimitsByLimitId;
  const byLimitId = byLimitIdValue === null || byLimitIdValue === undefined
    ? null
    : asRecord(byLimitIdValue);

  if (byLimitIdValue !== null && byLimitIdValue !== undefined && byLimitId === null) {
    return unavailableCodexRateLimits(fetchedAt, "malformed-response");
  }

  const bucketValue = byLimitId?.codex ?? root.rateLimits;
  const bucket = bucketValue === null || bucketValue === undefined
    ? null
    : asRecord(bucketValue);

  if (bucketValue !== null && bucketValue !== undefined && bucket === null) {
    return unavailableCodexRateLimits(fetchedAt, "malformed-response");
  }

  const primary = parseRateLimitWindow(bucket?.primary);
  const secondary = parseRateLimitWindow(bucket?.secondary);
  const resetCredits = parseResetCredits(root.rateLimitResetCredits);

  if (!primary.ok || !secondary.ok || !resetCredits.ok) {
    return unavailableCodexRateLimits(fetchedAt, "malformed-response");
  }

  if (bucket === null && resetCredits.value === null) {
    return unavailableCodexRateLimits(fetchedAt, "no-data");
  }

  const data: CodexRateLimitSummary = {
    primary: primary.value,
    secondary: secondary.value,
    reachedType: safeClassification(bucket?.rateLimitReachedType),
    resetCredits: resetCredits.value,
  };

  return {
    schemaVersion: CODEX_MEASUREMENT_SCHEMA_VERSION,
    availability: "available",
    source: "codex-app-server-rate-limits",
    accuracy: "official",
    fetchedAt: safeFetchedAt(fetchedAt),
    data,
  };
}

export function normalizeCodexAccountUsageResult(
  value: unknown,
  fetchedAt: string,
): CodexAccountUsageMeasurement {
  const root = asRecord(value);

  if (root === null) {
    return unavailableCodexAccountUsage(fetchedAt, "malformed-response");
  }

  if (
    Array.isArray(root.dailyUsageBuckets) &&
    root.dailyUsageBuckets.length > MAX_DAILY_USAGE_BUCKETS
  ) {
    return unavailableCodexAccountUsage(fetchedAt, "oversized-response");
  }

  const summaryValue = root.summary;
  const summary = summaryValue === null || summaryValue === undefined
    ? null
    : asRecord(summaryValue);

  if (summaryValue !== null && summaryValue !== undefined && summary === null) {
    return unavailableCodexAccountUsage(fetchedAt, "malformed-response");
  }

  const lifetimeTokens = parseNullableNonNegativeInteger(summary?.lifetimeTokens);
  const peakDailyTokens = parseNullableNonNegativeInteger(summary?.peakDailyTokens);
  const longestRunningTurnSeconds = parseNullableNonNegativeInteger(
    summary?.longestRunningTurnSec,
  );
  const currentStreakDays = parseNullableNonNegativeInteger(summary?.currentStreakDays);
  const longestStreakDays = parseNullableNonNegativeInteger(summary?.longestStreakDays);
  const dailyUsageBuckets = parseDailyUsageBuckets(root.dailyUsageBuckets);

  if (
    !lifetimeTokens.ok ||
    !peakDailyTokens.ok ||
    !longestRunningTurnSeconds.ok ||
    !currentStreakDays.ok ||
    !longestStreakDays.ok ||
    !dailyUsageBuckets.ok
  ) {
    return unavailableCodexAccountUsage(fetchedAt, "malformed-response");
  }

  if (summary === null && dailyUsageBuckets.value === null) {
    return unavailableCodexAccountUsage(fetchedAt, "no-data");
  }

  const data: CodexAccountUsage = {
    summary: {
      lifetimeTokens: lifetimeTokens.value,
      peakDailyTokens: peakDailyTokens.value,
      longestRunningTurnSeconds: longestRunningTurnSeconds.value,
      currentStreakDays: currentStreakDays.value,
      longestStreakDays: longestStreakDays.value,
    },
    dailyUsageBuckets: dailyUsageBuckets.value,
  };

  return {
    schemaVersion: CODEX_MEASUREMENT_SCHEMA_VERSION,
    availability: "available",
    source: "codex-app-server-account-usage",
    accuracy: "official",
    fetchedAt: safeFetchedAt(fetchedAt),
    data,
  };
}

export function unavailableCodexRateLimits(
  fetchedAt: string,
  reason: CodexUnavailableReason,
): CodexRateLimitsMeasurement {
  return {
    schemaVersion: CODEX_MEASUREMENT_SCHEMA_VERSION,
    availability: "unavailable",
    source: "codex-app-server-rate-limits",
    accuracy: "unavailable",
    fetchedAt: safeFetchedAt(fetchedAt),
    reason,
    message: unavailableMessage("rate-limit data", reason),
    data: null,
  };
}

export function unavailableCodexAccountUsage(
  fetchedAt: string,
  reason: CodexUnavailableReason,
): CodexAccountUsageMeasurement {
  return {
    schemaVersion: CODEX_MEASUREMENT_SCHEMA_VERSION,
    availability: "unavailable",
    source: "codex-app-server-account-usage",
    accuracy: "unavailable",
    fetchedAt: safeFetchedAt(fetchedAt),
    reason,
    message: unavailableMessage("account token activity", reason),
    data: null,
  };
}

function parseRateLimitWindow(value: unknown): ParseResult<CodexRateLimitWindow | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  const record = asRecord(value);

  if (record === null) {
    return { ok: false };
  }

  const usedPercent = parseNullableFiniteNumber(record.usedPercent);
  const windowDurationMinutes = parseNullableNonNegativeInteger(
    record.windowDurationMins,
  );
  const resetsAt = parseNullableEpochSeconds(record.resetsAt);

  if (!usedPercent.ok || !windowDurationMinutes.ok || !resetsAt.ok) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      usedPercent: usedPercent.value === null
        ? null
        : Math.min(100, Math.max(0, usedPercent.value)),
      windowDurationMinutes: windowDurationMinutes.value,
      resetsAt: resetsAt.value,
    },
  };
}

function parseResetCredits(value: unknown): ParseResult<CodexResetCreditSummary | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  const record = asRecord(value);

  if (record === null) {
    return { ok: false };
  }

  const availableCount = parseRequiredNonNegativeInteger(record.availableCount);

  if (!availableCount.ok) {
    return { ok: false };
  }

  const creditsValue = record.credits;

  if (creditsValue !== null && creditsValue !== undefined && !Array.isArray(creditsValue)) {
    return { ok: false };
  }

  const details: CodexResetCreditDetail[] = [];
  let allRowsValid = true;

  if (Array.isArray(creditsValue)) {
    for (const item of creditsValue.slice(0, MAX_RESET_CREDIT_DETAILS)) {
      const detail = parseResetCreditDetail(item);

      if (detail === null) {
        allRowsValid = false;
        continue;
      }

      details.push(detail);
    }

    if (creditsValue.length > MAX_RESET_CREDIT_DETAILS) {
      allRowsValid = false;
    }
  }

  return {
    ok: true,
    value: {
      availableCount: availableCount.value,
      details,
      detailsComplete: Array.isArray(creditsValue) &&
        allRowsValid &&
        creditsValue.length >= availableCount.value,
    },
  };
}

function parseResetCreditDetail(value: unknown): CodexResetCreditDetail | null {
  const record = asRecord(value);

  if (record === null) {
    return null;
  }

  // The upstream opaque credit id is deliberately not copied.
  return {
    resetType: record.resetType === "codexRateLimits" ? "codexRateLimits" : "unknown",
    status: record.status === "available" ? "available" : "unknown",
    grantedAt: nullableEpochSeconds(record.grantedAt),
    expiresAt: nullableEpochSeconds(record.expiresAt),
    title: safeProviderText(record.title),
    description: safeProviderText(record.description),
  };
}

function parseDailyUsageBuckets(
  value: unknown,
): ParseResult<readonly CodexDailyUsageBucket[] | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  if (!Array.isArray(value) || value.length > MAX_DAILY_USAGE_BUCKETS) {
    return { ok: false };
  }

  const buckets: CodexDailyUsageBucket[] = [];

  for (const item of value) {
    const record = asRecord(item);
    const startDate = record === null ? null : safeDateOnly(record.startDate);
    const tokens = record === null
      ? { ok: false } as const
      : parseRequiredNonNegativeInteger(record.tokens);

    if (startDate === null || !tokens.ok) {
      return { ok: false };
    }

    buckets.push({
      startDate,
      tokens: tokens.value,
    });
  }

  return { ok: true, value: buckets };
}

function parseNullableFiniteNumber(value: unknown): ParseResult<number | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  return typeof value === "number" && Number.isFinite(value)
    ? { ok: true, value }
    : { ok: false };
}

function parseNullableNonNegativeInteger(value: unknown): ParseResult<number | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  const parsed = parseRequiredNonNegativeInteger(value);
  return parsed.ok ? parsed : { ok: false };
}

function parseRequiredNonNegativeInteger(value: unknown): ParseResult<number> {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? { ok: true, value }
    : { ok: false };
}

function parseNullableEpochSeconds(value: unknown): ParseResult<string | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  const parsed = epochSeconds(value);
  return parsed === null ? { ok: false } : { ok: true, value: parsed };
}

function nullableEpochSeconds(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return epochSeconds(value);
}

function epochSeconds(value: unknown): string | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }

  const date = new Date(value * 1_000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function safeClassification(value: unknown): string | null {
  return typeof value === "string" && SAFE_CLASSIFICATION.test(value)
    ? value
    : null;
}

function safeProviderText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (
    normalized.length === 0 ||
    SENSITIVE_PROVIDER_TEXT.test(normalized) ||
    !SAFE_PROVIDER_TEXT.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function safeFetchedAt(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function unavailableMessage(
  domain: "rate-limit data" | "account token activity",
  reason: CodexUnavailableReason,
): string {
  const detail = {
    "not-installed": "Codex CLI is not installed.",
    "not-authenticated": "Codex is not authenticated for this account read.",
    "unsupported-auth-mode": "The active Codex authentication mode does not support this account read.",
    "unsupported-method": "The installed Codex App Server does not support this method.",
    timeout: "Codex App Server did not respond before the local timeout.",
    "malformed-response": "Codex App Server returned an invalid response.",
    "oversized-response": "Codex App Server returned a response above the local safety limit.",
    "no-data": "Codex App Server returned no usable data.",
    unknown: "Codex App Server could not provide this measurement.",
  } satisfies Record<CodexUnavailableReason, string>;

  return `Official Codex ${domain} is unavailable. ${detail[reason]}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
