import { requireLocalSession } from "../../../../lib/local-security";
import {
  runOpenAiFirstSync,
  type OpenAiFirstSyncResult,
} from "../../../../lib/openai-first-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function POST(request: Request): Promise<Response> {
  try {
    requireLocalSession(request);
  } catch {
    return safeError("local_session_required", 403);
  }

  const input = await readInput(request);

  if (input === null) {
    return safeError("openai_first_sync_invalid_request", 400);
  }

  try {
    const result = await runOpenAiFirstSync(input);

    return Response.json(result, {
      status: statusFor(result),
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return safeError("openai_first_sync_failed", 500);
  }
}

async function readInput(request: Request): Promise<{ adminKey?: string } | null> {
  try {
    const body = await request.json() as unknown;

    if (!isRecord(body) || Object.keys(body).some((key) => key !== "adminKey")) {
      return null;
    }

    if (body.adminKey === undefined) {
      return {};
    }

    if (typeof body.adminKey !== "string") {
      return null;
    }

    const adminKey = body.adminKey.trim();

    return adminKey.length >= 8 && adminKey.length <= 4_096
      ? { adminKey }
      : null;
  } catch {
    return null;
  }
}

function statusFor(result: OpenAiFirstSyncResult): number {
  if (result.status === "ok" || result.status === "partial") {
    return 200;
  }

  return result.stage === "validation" ? 422 : 500;
}

function safeError(code: string, status: number): Response {
  return Response.json({
    code,
    localOnly: true,
    secretsReturned: false,
  }, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
