import { requireLocalSession } from "../../../../../lib/local-security";

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
    return Response.json({
      error: "Local session and CSRF token are required.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 403,
      headers: NO_STORE_HEADERS,
    });
  }

  scheduleShutdown();

  return Response.json({
    generatedAt: new Date().toISOString(),
    localOnly: true,
    secretsReturned: false,
    status: "stopping",
    message: "MoneySiren local web runtime is stopping.",
  }, {
    headers: NO_STORE_HEADERS,
  });
}

function scheduleShutdown(): void {
  setTimeout(() => {
    process.exit(0);
  }, 150).unref();
}
