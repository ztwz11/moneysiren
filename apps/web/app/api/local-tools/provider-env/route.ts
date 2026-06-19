import { requireLocalSession } from "../../../../lib/local-security";
import { setProviderEnvGlobally } from "../../../../lib/local-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    requireLocalSession(request);
    const body = await request.json() as Record<string, unknown>;
    const entries = readEntries(body.entries);
    const result = await setProviderEnvGlobally(entries);

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (caught) {
    return Response.json(
      {
        error: caught instanceof Error ? caught.message : "Provider environment variables were not saved.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

function readEntries(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provider environment entries are required.");
  }

  const entries: Record<string, string> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      throw new Error(`Provider environment value must be a string for ${key}.`);
    }

    entries[key] = entryValue;
  }

  return entries;
}
