import {
  parseNotificationPreferences,
  writeNotificationPreferencesFile,
} from "../../../../../packages/view-model/src/index";
import { isLocalRequest, requireLocalSession } from "../../../lib/local-security";
import { readWebNotificationPreferencesState } from "../../../lib/local-notification-model";

export async function GET(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) {
    return Response.json({
      error: "Request must originate from localhost.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 400,
    });
  }

  const preferencesState = await readWebNotificationPreferencesState();

  return Response.json({
    generatedAt: new Date().toISOString(),
    localOnly: true,
    preferencesStored: preferencesState.preferencesStored,
    secretsReturned: false,
    preferences: preferencesState.preferences,
  });
}

export async function PUT(request: Request): Promise<Response> {
  try {
    requireLocalSession(request);
    const preferences = parseNotificationPreferences(await request.json());

    return Response.json({
      generatedAt: new Date().toISOString(),
      localOnly: true,
      preferencesStored: true,
      secretsReturned: false,
      preferences: await writeNotificationPreferencesFile(preferences, {
        cwd: process.cwd(),
        env: process.env,
      }),
    });
  } catch (caught) {
    return Response.json({
      error: caught instanceof Error ? caught.message : "Notification preferences were not saved.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 400,
    });
  }
}
