import { readDashboardSnapshot } from "../../../lib/dashboard-data.js";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const snapshot = await readDashboardSnapshot();

    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: "Dashboard data unavailable.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
