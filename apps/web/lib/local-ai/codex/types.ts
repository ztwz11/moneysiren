export const CODEX_MEASUREMENT_SCHEMA_VERSION = 2 as const;

export type CodexMeasurementAccuracy =
  | "official"
  | "estimated"
  | "bounded"
  | "unavailable";

export type CodexMeasurementSource =
  | "codex-app-server-rate-limits"
  | "codex-app-server-account-usage"
  | "codex-local-session-metadata";

export type CodexUnavailableReason =
  | "not-installed"
  | "not-authenticated"
  | "unsupported-auth-mode"
  | "unsupported-method"
  | "timeout"
  | "malformed-response"
  | "oversized-response"
  | "no-data"
  | "unknown";

type CodexAvailableAccuracy = Exclude<CodexMeasurementAccuracy, "unavailable">;

export interface CodexAvailableMeasurement<
  T,
  S extends CodexMeasurementSource,
  A extends CodexAvailableAccuracy,
> {
  schemaVersion: typeof CODEX_MEASUREMENT_SCHEMA_VERSION;
  availability: "available";
  source: S;
  accuracy: A;
  fetchedAt: string;
  data: T;
}

export interface CodexUnavailableMeasurement<
  S extends CodexMeasurementSource,
> {
  schemaVersion: typeof CODEX_MEASUREMENT_SCHEMA_VERSION;
  availability: "unavailable";
  source: S;
  accuracy: "unavailable";
  fetchedAt: string;
  reason: CodexUnavailableReason;
  message: string;
  data: null;
}

export type CodexMeasurement<
  T,
  S extends CodexMeasurementSource,
  A extends CodexAvailableAccuracy,
> =
  | CodexAvailableMeasurement<T, S, A>
  | CodexUnavailableMeasurement<S>;

export interface CodexRateLimitWindow {
  usedPercent: number | null;
  windowDurationMinutes: number | null;
  resetsAt: string | null;
}

export interface CodexResetCreditDetail {
  resetType: "codexRateLimits" | "unknown";
  status: "available" | "unknown";
  grantedAt: string | null;
  expiresAt: string | null;
  title: string | null;
  description: string | null;
}

export interface CodexResetCreditSummary {
  availableCount: number;
  details: readonly CodexResetCreditDetail[];
  detailsComplete: boolean;
}

export interface CodexRateLimitSummary {
  primary: CodexRateLimitWindow | null;
  secondary: CodexRateLimitWindow | null;
  reachedType: string | null;
  resetCredits: CodexResetCreditSummary | null;
}

export interface CodexAccountUsageSummary {
  lifetimeTokens: number | null;
  peakDailyTokens: number | null;
  longestRunningTurnSeconds: number | null;
  currentStreakDays: number | null;
  longestStreakDays: number | null;
}

export interface CodexDailyUsageBucket {
  startDate: string;
  tokens: number;
}

export interface CodexAccountUsage {
  summary: CodexAccountUsageSummary;
  dailyUsageBuckets: readonly CodexDailyUsageBucket[] | null;
}

export type CodexKnownModelId =
  | "gpt-5.6-sol"
  | "gpt-5.6-terra"
  | "gpt-5.6-luna";

declare const safeModelIdBrand: unique symbol;

export type CodexSafeModelId = string & {
  readonly [safeModelIdBrand]: true;
};

export type CodexTotalTokensBasis = "explicit" | "derived" | "mixed";

export interface CodexModelUsage {
  canonicalModelId: CodexSafeModelId;
  knownModelId: CodexKnownModelId | null;
  observedModelIds: readonly CodexSafeModelId[];
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number | null;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  totalTokensBasis: CodexTotalTokensBasis;
  requestCount: number;
}

export interface LocalUsageCoverage {
  periodStart: string;
  periodEnd: string;
  eligibleFileCount: number;
  scannedFileCount: number;
  parsedRecordCount: number;
  duplicateRecordCount: number;
  malformedRecordCount: number;
  unknownSchemaCount: number;
  truncated: boolean;
}

export interface CodexLocalModelUsage {
  models: readonly CodexModelUsage[];
  coverage: LocalUsageCoverage;
}

export type CodexRateLimitsMeasurement = CodexMeasurement<
  CodexRateLimitSummary,
  "codex-app-server-rate-limits",
  "official"
>;

export type CodexAccountUsageMeasurement = CodexMeasurement<
  CodexAccountUsage,
  "codex-app-server-account-usage",
  "official"
>;

export type CodexLocalUsageMeasurement = CodexMeasurement<
  CodexLocalModelUsage,
  "codex-local-session-metadata",
  "estimated" | "bounded"
>;

export interface CodexMeasurementV2 {
  schemaVersion: typeof CODEX_MEASUREMENT_SCHEMA_VERSION;
  generatedAt: string;
  rateLimits: CodexRateLimitsMeasurement;
  accountUsage: CodexAccountUsageMeasurement;
  localModelUsage: CodexLocalUsageMeasurement;
}

export interface CodexSanitizedUsageRecord {
  schemaVersion: 1;
  eventKey: string;
  seriesKey: string | null;
  occurredAt: string;
  observedModelId: string;
  semantics: "incremental" | "cumulative";
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number | null;
  outputTokens: number;
  reasoningTokens: number;
  explicitTotalTokens: number | null;
  requestCount: number;
}
