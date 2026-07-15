import type { LocalAiUsageGranularity } from "../../../../../../packages/db/src/index";
import {
  readStoredLocalAiUsageHistory,
  syncLocalAiUsageHistory,
} from "../../../../lib/local-ai-history";
import type { LocalAiUsageHistoryProviderKey } from "../../../../lib/local-tools";
import { isLocalRequest, requireLocalSession } from "../../../../lib/local-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function GET(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) {
    return errorResponse("Local AI usage history is local-only.", 403);
  }

  const options = parseHistoryQuery(request);

  if (options === null) {
    return errorResponse("Local AI usage history query is invalid.", 400);
  }

  try {
    return Response.json(await readStoredLocalAiUsageHistory(options), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return errorResponse("Local AI usage history is unavailable.", 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireLocalSession(request);
  } catch {
    return errorResponse("Local session and CSRF token are required.", 403);
  }

  const options = parseHistoryQuery(request);

  if (options === null) {
    return errorResponse("Local AI usage history query is invalid.", 400);
  }

  try {
    return Response.json(await syncLocalAiUsageHistory(options), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return errorResponse("Local AI usage history sync failed.", 500);
  }
}

interface HistoryQuery {
  from?: string;
  to?: string;
  granularity?: LocalAiUsageGranularity;
  providerKeys?: readonly LocalAiUsageHistoryProviderKey[];
  timezone?: string;
}

function parseHistoryQuery(request: Request): HistoryQuery | null {
  const url = new URL(request.url);
  const from = readOptionalQueryValue(url, "from");
  const to = readOptionalQueryValue(url, "to");
  const timezone = readOptionalQueryValue(url, "timezone");
  const granularityValue = readOptionalQueryValue(url, "granularity");
  const providerValue = readOptionalQueryValue(url, "provider");

  if (
    from === null ||
    to === null ||
    timezone === null ||
    granularityValue === null ||
    providerValue === null
  ) {
    return null;
  }

  const granularity = granularityValue === undefined
    ? undefined
    : parseGranularity(granularityValue);
  const providerKeys = providerValue === undefined
    ? undefined
    : parseProviderKeys(providerValue);

  if (granularity === null || providerKeys === null) {
    return null;
  }

  return {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(timezone === undefined ? {} : { timezone }),
    ...(granularity === undefined ? {} : { granularity }),
    ...(providerKeys === undefined ? {} : { providerKeys }),
  };
}

function readOptionalQueryValue(url: URL, key: string): string | undefined | null {
  const values = url.searchParams.getAll(key);

  if (values.length === 0) {
    return undefined;
  }

  if (values.length !== 1 || values[0] === undefined || values[0].trim().length === 0) {
    return null;
  }

  return values[0].trim();
}

function parseGranularity(value: string): LocalAiUsageGranularity | null {
  return value === "day" || value === "week" || value === "month" ? value : null;
}

function parseProviderKeys(value: string): readonly LocalAiUsageHistoryProviderKey[] | null {
  if (value === "all") {
    return ["codex-cli", "claude-cli"];
  }

  return value === "codex-cli" || value === "claude-cli" ? [value] : null;
}

function errorResponse(error: string, status: number): Response {
  return Response.json({
    error,
    localOnly: true,
    secretsReturned: false,
  }, {
    status,
    headers: NO_STORE_HEADERS,
  });
}
