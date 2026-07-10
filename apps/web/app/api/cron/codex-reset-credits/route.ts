import { timingSafeEqual } from "node:crypto";
import {
  fetchCodexResetCreditStatus,
  RESET_CREDIT_ACCURACY,
  RESET_CREDIT_SCHEMA_VERSION,
  RESET_CREDIT_SOURCE,
  toResetCreditError,
} from "../../../../lib/codex-reset-credits";
import { ResetCreditError } from "../../../../lib/codex-reset-credits/errors";
import type { ResetCreditStatus } from "../../../../lib/codex-reset-credits/types";
import { runResetCreditAlerts } from "../../../../lib/notifications/alert-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function POST(request: Request): Promise<Response> {
  try {
    requireCronSecret(request, process.env);
    const status = alertableResetCreditStatus(await fetchCodexResetCreditStatus());
    const result = await runResetCreditAlerts(status);

    return Response.json({
      ok: true,
      schemaVersion: RESET_CREDIT_SCHEMA_VERSION,
      source: RESET_CREDIT_SOURCE,
      accuracy: RESET_CREDIT_ACCURACY,
      checked: result.checked,
      notificationsSent: result.notificationsSent,
      skippedDuplicates: result.skippedDuplicates,
    }, {
      headers: NO_STORE_HEADERS,
    });
  } catch (caught) {
    const error = toResetCreditError(caught);

    return Response.json({
      ok: false,
      schemaVersion: RESET_CREDIT_SCHEMA_VERSION,
      error: {
        code: error.code,
        message: error.message,
      },
    }, {
      status: error.status,
      headers: NO_STORE_HEADERS,
    });
  }
}

export function alertableResetCreditStatus(status: ResetCreditStatus): ResetCreditStatus {
  return {
    ...status,
    credits: status.credits.filter((credit) =>
      credit.expiresAtUtc !== null && Number.isFinite(Date.parse(credit.expiresAtUtc))
    ),
  };
}

export function requireCronSecret(
  request: Request,
  env: Record<string, string | undefined>,
): void {
  const expected = trimToNull(env.CRON_SECRET);

  if (expected === null) {
    throw new ResetCreditError("CRON_SECRET_NOT_CONFIGURED", "CRON_SECRET must be set before running reset credit notifications.", 500);
  }

  const header = request.headers.get("authorization") ?? "";
  const actual = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!timingSafeStringEqual(actual, expected)) {
    throw new ResetCreditError("API_UNAUTHORIZED", "Valid CRON_SECRET bearer token is required.", 401);
  }
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}
