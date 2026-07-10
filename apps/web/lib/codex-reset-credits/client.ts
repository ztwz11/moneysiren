import "server-only";

import { readCodexAppServerMeasurements } from "../local-ai/codex/app-server-client";
import type { CodexOfficialAccountMeasurements } from "../local-ai/codex/app-server-transport";
import type { CodexUnavailableReason } from "../local-ai/codex/types";
import { ResetCreditError } from "./errors";
import { normalizeResetCreditStatus } from "./normalize";
import type { ResetCreditStatus } from "./types";

export interface FetchCodexResetCreditsOptions {
  /** @deprecated Kept for one-release call-site compatibility. Never inspected. */
  env?: Record<string, string | undefined>;
  now?: () => Date;
  cacheTtlMs?: number;
  /** Injectable normalized official read for tests. Raw RPC envelopes are forbidden. */
  readMeasurements?: () => Promise<CodexOfficialAccountMeasurements>;
}

/**
 * @deprecated Use readCodexAppServerMeasurements for new code.
 *
 * Compatibility adapter for the existing reset-credit route and alert flow.
 * Authentication stays inside the installed Codex process. This function never
 * reads auth files, constructs authorization headers, or calls ChatGPT HTTP.
 */
export async function fetchCodexResetCreditStatus(
  options: FetchCodexResetCreditsOptions = {},
): Promise<ResetCreditStatus> {
  const now = options.now ?? (() => new Date());
  let measurements: CodexOfficialAccountMeasurements;

  try {
    measurements = options.readMeasurements === undefined
      ? await readCodexAppServerMeasurements(
          options.cacheTtlMs === undefined ? {} : { cacheTtlMs: options.cacheTtlMs },
        )
      : await options.readMeasurements();
  } catch {
    throw new ResetCreditError(
      "UPSTREAM_UNAVAILABLE",
      "Codex App Server에서 초기화권 정보를 조회하지 못했습니다.",
      502,
    );
  }

  if (measurements.rateLimits.availability === "unavailable") {
    throw resetCreditErrorFromUnavailableReason(measurements.rateLimits.reason);
  }

  return normalizeResetCreditStatus(measurements.rateLimits, now());
}

function resetCreditErrorFromUnavailableReason(
  reason: CodexUnavailableReason,
): ResetCreditError {
  switch (reason) {
    case "not-authenticated":
      return new ResetCreditError(
        "UPSTREAM_UNAUTHORIZED",
        "Codex 로그인이 필요합니다. 터미널에서 `codex login`을 실행한 후 다시 시도하세요.",
        401,
      );
    case "unsupported-auth-mode":
      return new ResetCreditError(
        "UPSTREAM_FORBIDDEN",
        "현재 Codex 인증 방식은 App Server 계정 조회를 지원하지 않습니다.",
        403,
      );
    case "timeout":
      return new ResetCreditError(
        "UPSTREAM_TIMEOUT",
        "Codex App Server 응답 시간이 초과됐습니다.",
        504,
      );
    case "malformed-response":
    case "oversized-response":
    case "unsupported-method":
      return new ResetCreditError(
        "UPSTREAM_INVALID_RESPONSE",
        "설치된 Codex App Server에서 지원되는 초기화권 응답을 받지 못했습니다.",
        502,
      );
    case "not-installed":
      return new ResetCreditError(
        "UPSTREAM_UNAVAILABLE",
        "Codex CLI가 설치되어 있지 않거나 실행 경로에서 찾을 수 없습니다.",
        503,
      );
    case "no-data":
    case "unknown":
      return new ResetCreditError(
        "UPSTREAM_UNAVAILABLE",
        "Codex App Server에서 사용할 수 있는 초기화권 정보를 받지 못했습니다.",
        502,
      );
  }
}
