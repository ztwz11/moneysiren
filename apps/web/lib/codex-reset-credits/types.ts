import { CODEX_MEASUREMENT_SCHEMA_VERSION } from "../local-ai/codex/types";

export const RESET_CREDIT_SCHEMA_VERSION = CODEX_MEASUREMENT_SCHEMA_VERSION;
export const RESET_CREDIT_TIME_ZONE = "Asia/Seoul";
export const RESET_CREDIT_SOURCE = "codex-app-server";
export const RESET_CREDIT_ACCURACY = "official";

export type ResetCreditStatusValue = "active" | "expiring-soon" | "expired" | "unknown";

export interface ResetCreditStatus {
  schemaVersion: typeof RESET_CREDIT_SCHEMA_VERSION;
  source: typeof RESET_CREDIT_SOURCE;
  accuracy: typeof RESET_CREDIT_ACCURACY;
  fetchedAtUtc: string;
  availableCount: number | null;
  totalEarnedCount: null;
  detailsComplete: boolean;
  credits: readonly ResetCredit[];
}

export interface ResetCredit {
  index: number;
  resetType: "codexRateLimits" | "unknown";
  providerStatus: "available" | "unknown";
  grantedAtUtc: string | null;
  expiresAtUtc: string | null;
  title: string | null;
  description: string | null;
  remainingSeconds: number | null;
  status: ResetCreditStatusValue;
}

export type ResetCreditErrorCode =
  | "UPSTREAM_UNAUTHORIZED"
  | "UPSTREAM_FORBIDDEN"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_INVALID_JSON"
  | "UPSTREAM_INVALID_RESPONSE"
  | "API_UNAUTHORIZED"
  | "CRON_SECRET_NOT_CONFIGURED";

export interface ResetCreditApiSuccess {
  ok: true;
  schemaVersion: typeof RESET_CREDIT_SCHEMA_VERSION;
  data: ResetCreditStatus;
  meta: ResetCreditResponseMeta;
}

export interface ResetCreditApiFailure {
  ok: false;
  // Optional only for the one-release browser fallback object. The API route
  // always emits schemaVersion.
  schemaVersion?: typeof RESET_CREDIT_SCHEMA_VERSION;
  error: {
    code: ResetCreditErrorCode;
    message: string;
  };
}

export type ResetCreditApiResponse = ResetCreditApiSuccess | ResetCreditApiFailure;

export interface ResetCreditResponseMeta {
  schemaVersion: typeof RESET_CREDIT_SCHEMA_VERSION;
  timeZone: typeof RESET_CREDIT_TIME_ZONE;
  source: typeof RESET_CREDIT_SOURCE;
  accuracy: typeof RESET_CREDIT_ACCURACY;
}

export type AlertThreshold = "7d" | "3d" | "1d" | "6h" | "expired";

export interface CreditAlert {
  creditKey: string;
  threshold: AlertThreshold;
  expiresAtUtc: string;
  message: string;
}
