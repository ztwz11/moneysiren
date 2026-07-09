export const CODEX_MEASUREMENT_SCHEMA_VERSION = 2 as const;

export type CodexMeasurementAccuracy =
  | "official"
  | "estimated"
  | "bounded"
  | "unavailable";

export type CodexOfficialSource =
  | "codex-app-server"
  | "stale-cache"
  | "unavailable";

export type CodexModelBreakdownSource =
  | "sanitized-session-metadata"
  | "unavailable";

export interface CodexRateLimitWindow {
  usedPercent: number | null;
  windowDurationMinutes: number | null;
  resetsAt: string | null;
}

export interface CodexRateLimitSummary {
  limitId: string;
  limitName: string | null;
  primary: CodexRateLimitWindow | null;
  secondary: CodexRateLimitWindow | null;
  rateLimitReachedType: string | null;
  accuracy: "official";
}

export interface CodexResetCreditDetail {
  id: string;
  resetType: string;
  status: string;
  grantedAt: string | null;
  expiresAt: string | null;
  title: string | null;
  description: string | null;
}

export interface CodexResetCreditSummary {
  source: "codex-app-server";
  availableCount: number;
  details: readonly CodexResetCreditDetail[];
  detailsComplete: boolean;
  fetchedAt: string;
  accuracy: "official";
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
  dailyUsageBuckets: readonly CodexDailyUsageBucket[];
  accuracy: "official";
}

export interface CodexModelUsage {
  canonicalModelId: string;
  rawModelIds: readonly string[];
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number | null;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  requestCount: number;
  accuracy: "estimated" | "bounded";
}

export interface LocalUsageCoverage {
  eligibleFileCount: number;
  scannedFileCount: number;
  parsedRecordCount: number;
  duplicateRecordCount: number;
  malformedRecordCount: number;
  unknownSchemaCount: number;
  truncated: boolean;
}

export interface CodexMeasurementSources {
  rateLimits: CodexOfficialSource;
  accountUsage: Exclude<CodexOfficialSource, "stale-cache">;
  modelBreakdown: CodexModelBreakdownSource;
}

export interface CodexMeasurementSummary {
  schemaVersion: typeof CODEX_MEASUREMENT_SCHEMA_VERSION;
  observedAt: string;
  sources: CodexMeasurementSources;
  rateLimits: CodexRateLimitSummary | null;
  resetCredits: CodexResetCreditSummary | null;
  accountUsage: CodexAccountUsage | null;
  models: readonly CodexModelUsage[];
  coverage: LocalUsageCoverage;
}

export function emptyLocalUsageCoverage(): LocalUsageCoverage {
  return {
    eligibleFileCount: 0,
    scannedFileCount: 0,
    parsedRecordCount: 0,
    duplicateRecordCount: 0,
    malformedRecordCount: 0,
    unknownSchemaCount: 0,
    truncated: false,
  };
}
