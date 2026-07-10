import type { CodexRateLimitsMeasurement } from "../local-ai/codex/types";
import {
  RESET_CREDIT_ACCURACY,
  RESET_CREDIT_SCHEMA_VERSION,
  RESET_CREDIT_SOURCE,
  type ResetCredit,
  type ResetCreditStatus,
  type ResetCreditStatusValue,
} from "./types";

type AvailableRateLimitsMeasurement = Extract<
  CodexRateLimitsMeasurement,
  { availability: "available" }
>;

const EXPIRING_SOON_SECONDS = 7 * 24 * 60 * 60;

/**
 * One-release compatibility adapter from the official App Server measurement
 * into the legacy reset-credit dashboard shape.
 *
 * availableCount is authoritative. Only supplied App Server detail rows are
 * mapped; the adapter never invents rows for missing or capped details.
 */
export function normalizeResetCreditStatus(
  measurement: AvailableRateLimitsMeasurement,
  now: Date = new Date(),
): ResetCreditStatus {
  const resetCredits = measurement.data.resetCredits;
  const credits = resetCredits === null
    ? []
    : resetCredits.details
      .map((detail): Omit<ResetCredit, "index"> => {
        const expiresAtUtc = detail.expiresAt;
        const remainingSeconds = expiresAtUtc === null
          ? null
          : Math.max(0, Math.floor((Date.parse(expiresAtUtc) - now.getTime()) / 1000));

        return {
          resetType: detail.resetType,
          providerStatus: detail.status,
          grantedAtUtc: detail.grantedAt,
          expiresAtUtc,
          title: detail.title,
          description: detail.description,
          remainingSeconds,
          status: statusForExpiry(expiresAtUtc, now),
        };
      })
      .sort(compareCredits)
      .map((credit, index) => ({
        ...credit,
        index: index + 1,
      }));

  return {
    schemaVersion: RESET_CREDIT_SCHEMA_VERSION,
    source: RESET_CREDIT_SOURCE,
    accuracy: RESET_CREDIT_ACCURACY,
    fetchedAtUtc: measurement.fetchedAt,
    availableCount: resetCredits?.availableCount ?? null,
    totalEarnedCount: null,
    detailsComplete: resetCredits?.detailsComplete ?? false,
    credits,
  };
}

function compareCredits(
  left: Omit<ResetCredit, "index">,
  right: Omit<ResetCredit, "index">,
): number {
  if (left.expiresAtUtc === null && right.expiresAtUtc === null) {
    return 0;
  }

  if (left.expiresAtUtc === null) {
    return 1;
  }

  if (right.expiresAtUtc === null) {
    return -1;
  }

  return Date.parse(left.expiresAtUtc) - Date.parse(right.expiresAtUtc);
}

function statusForExpiry(
  expiresAtUtc: string | null,
  now: Date,
): ResetCreditStatusValue {
  if (expiresAtUtc === null) {
    return "unknown";
  }

  const remainingSeconds = Math.floor((Date.parse(expiresAtUtc) - now.getTime()) / 1000);

  if (remainingSeconds <= 0) {
    return "expired";
  }

  return remainingSeconds <= EXPIRING_SOON_SECONDS ? "expiring-soon" : "active";
}
