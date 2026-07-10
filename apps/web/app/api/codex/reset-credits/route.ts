import { timingSafeEqual } from "node:crypto";
import {
  errorStatus,
  fetchCodexResetCreditStatus,
  RESET_CREDIT_ACCURACY,
  RESET_CREDIT_SCHEMA_VERSION,
  RESET_CREDIT_SOURCE,
  RESET_CREDIT_TIME_ZONE,
  toResetCreditError,
} from "../../../../lib/codex-reset-credits";
import { ResetCreditError } from "../../../../lib/codex-reset-credits/errors";
import type { ResetCreditApiResponse } from "../../../../lib/codex-reset-credits/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function GET(request: Request): Promise<Response> {
  try {
    requireResetCreditApiKey(request, process.env);
    const data = await fetchCodexResetCreditStatus();

    return Response.json({
      ok: true,
      schemaVersion: RESET_CREDIT_SCHEMA_VERSION,
      data,
      meta: {
        schemaVersion: RESET_CREDIT_SCHEMA_VERSION,
        timeZone: RESET_CREDIT_TIME_ZONE,
        source: RESET_CREDIT_SOURCE,
        accuracy: RESET_CREDIT_ACCURACY,
      },
    } satisfies ResetCreditApiResponse, {
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
    } satisfies ResetCreditApiResponse, {
      status: error.status || errorStatus(error.code),
      headers: NO_STORE_HEADERS,
    });
  }
}

export function requireResetCreditApiKey(
  request: Request,
  env: Record<string, string | undefined>,
): void {
  const expected = trimToNull(env.RESET_CREDIT_API_KEY);

  if (expected === null) {
    return;
  }

  const header = request.headers.get("authorization") ?? "";
  const actual = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!timingSafeStringEqual(actual, expected)) {
    throw new ResetCreditError("API_UNAUTHORIZED", "Reset credit API key is required.", 401);
  }
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}
