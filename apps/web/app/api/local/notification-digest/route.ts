import { isLocalRequest } from "../../../../lib/local-security";
import { readWebLocalNotificationDigest } from "../../../../lib/local-notification-model";

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

  try {
    return Response.json(await readWebLocalNotificationDigest(), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({
      error: "Notification digest unavailable.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
