import type { ResetCreditErrorCode } from "./types";

export class ResetCreditError extends Error {
  readonly code: ResetCreditErrorCode;
  readonly status: number;

  constructor(code: ResetCreditErrorCode, message: string, status = 500) {
    super(message);
    this.name = "ResetCreditError";
    this.code = code;
    this.status = status;
  }
}

export function isResetCreditError(value: unknown): value is ResetCreditError {
  return value instanceof ResetCreditError;
}

export function toResetCreditError(value: unknown): ResetCreditError {
  if (isResetCreditError(value)) {
    return value;
  }

  return new ResetCreditError(
    "UPSTREAM_UNAVAILABLE",
    "Codex App Server에서 초기화권 정보를 조회하지 못했습니다.",
    502,
  );
}

export function errorStatus(code: ResetCreditErrorCode): number {
  switch (code) {
    case "API_UNAUTHORIZED":
    case "UPSTREAM_UNAUTHORIZED":
      return 401;
    case "UPSTREAM_FORBIDDEN":
      return 403;
    case "UPSTREAM_RATE_LIMITED":
      return 429;
    case "UPSTREAM_TIMEOUT":
      return 504;
    case "CRON_SECRET_NOT_CONFIGURED":
      return 500;
    default:
      return 502;
  }
}
