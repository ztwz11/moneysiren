import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearLocalSecurityState } from "../../../lib/local-security";
import { POST as createSession } from "../auth/session/route";
import { GET, PUT } from "./route";

const ORIGINAL_PREFS_PATH = process.env.MONEYSIREN_NOTIFICATION_PREFS_PATH;

beforeEach(async () => {
  clearLocalSecurityState();
  const dir = await mkdtemp(join(tmpdir(), "moneysiren-notification-prefs-"));
  process.env.MONEYSIREN_NOTIFICATION_PREFS_PATH = join(dir, "notification-preferences.json");
});

afterEach(() => {
  clearLocalSecurityState();
  restoreEnv("MONEYSIREN_NOTIFICATION_PREFS_PATH", ORIGINAL_PREFS_PATH);
});

describe("notification preference route", () => {
  it("returns local-safe default preferences", async () => {
    const response = await GET(localRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      preferences: {
        enabled: true,
        digestEnabled: true,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("FAKE_SECRET");
  });

  it("rejects preference mutation without a local CSRF session", async () => {
    const response = await PUT(localRequest({
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        selectedWidgets: ["today_live_cost"],
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("CSRF"),
    });
  });

  it("stores normalized local preferences with a local session", async () => {
    const headers = await createLocalSessionHeaders();
    const response = await PUT(localRequest({
      method: "PUT",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        enabled: true,
        digestEnabled: true,
        digestInterval: "six-hours",
        quietHours: {
          start: "21:00",
          end: "07:00",
        },
        selectedWidgets: ["today_live_cost"],
        thresholdRules: [
          {
            widgetKey: "today_live_cost",
            operator: "gte",
            value: 15,
            cooldownMinutes: 45,
          },
        ],
        desktopEnabled: true,
        dashboard: {
          localCliMetricKeys: ["last_request_tokens", "unknown", "total_tokens", "last_request_tokens"],
          widgetLayouts: {
            today: [
              { widgetKey: "today_rail", visible: false, size: "full" },
              { widgetKey: "today_main", visible: true, size: "wide" },
            ],
          },
          budget: {
            monthlyBudgetMinor: 150000,
            currency: "usd",
            warningPercent: 75,
            criticalPercent: 95,
          },
        },
        hud: {
          alwaysOnTop: false,
          backgroundColor: "#101820",
          fontColor: "#f5f7fb",
          fontScale: 0.9,
          opacity: 0,
          padding: 12,
          rowHeight: 54,
          selectedWidgets: ["today_live_cost"],
        },
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      preferences: {
        digestInterval: "six-hours",
        selectedWidgets: ["today_live_cost"],
        desktopEnabled: true,
        dashboard: {
          localCliMetricKeys: ["last_request_tokens", "total_tokens"],
          widgetLayouts: {
            today: [
              { widgetKey: "today_rail", visible: false, size: "full" },
              { widgetKey: "today_main", visible: true, size: "wide" },
            ],
          },
          budget: {
            monthlyBudgetMinor: 150000,
            currency: "USD",
            warningPercent: 75,
            criticalPercent: 95,
          },
        },
        hud: {
          alwaysOnTop: false,
          backgroundColor: "#101820",
          fontColor: "#f5f7fb",
          fontScale: 0.9,
          opacity: 0,
          padding: 12,
          rowHeight: 54,
          selectedWidgets: ["today_live_cost"],
        },
      },
    });

    const reread = await GET(localRequest());
    await expect(reread.json()).resolves.toMatchObject({
      preferences: {
        quietHours: {
          start: "21:00",
          end: "07:00",
        },
        thresholdRules: [
          expect.objectContaining({
            widgetKey: "today_live_cost",
            value: 15,
          }),
        ],
      },
    });
  });
});

function localRequest(init: RequestInit = {}): Request {
  return new Request("http://127.0.0.1:3000/api/notification-preferences", {
    ...init,
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      ...init.headers,
    },
  });
}

async function createLocalSessionHeaders(): Promise<Record<string, string>> {
  const response = await createSession(new Request("http://127.0.0.1:3000/api/auth/session", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
    },
  }));
  const payload = await response.json();

  return {
    cookie: response.headers.get("set-cookie") ?? "",
    "x-moneysiren-csrf": payload.csrfToken,
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
