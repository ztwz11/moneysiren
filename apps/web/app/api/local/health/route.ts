import { isLocalRequest } from "../../../../lib/local-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) {
    return Response.json({
      error: "Request must originate from localhost.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json({
    generatedAt: new Date().toISOString(),
    localOnly: true,
    secretsReturned: false,
    status: "ok",
    loopbackOnly: true,
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
