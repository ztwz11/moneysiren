import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalSecurityState } from "../../../../lib/local-security";
import { setProviderEnvGlobally } from "../../../../lib/local-tools";
import { POST as createSession } from "../../auth/session/route";
import { POST } from "./route";

vi.mock("../../../../lib/local-tools", () => ({
  setProviderEnvGlobally: vi.fn(),
}));

const setProviderEnvGloballyMock = vi.mocked(setProviderEnvGlobally);

beforeEach(() => {
  clearLocalSecurityState();
  setProviderEnvGloballyMock.mockReset();
});

describe("provider environment route", () => {
  it("persists provider env entries through a local CSRF-protected request", async () => {
    setProviderEnvGloballyMock.mockResolvedValue({
      generatedAt: "2026-06-19T00:00:00.000Z",
      localOnly: true,
      secretsReturned: false,
      keys: ["OPENAI_ADMIN_KEY"],
      target: "windows_user_environment",
      activeForCurrentProcess: true,
      restartHint: "New terminals inherit the saved provider environment variables.",
    });

    const response = await POST(new Request("http://127.0.0.1:3000/api/local-tools/provider-env", {
      method: "POST",
      headers: {
        ...await createLocalSessionHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        entries: {
          OPENAI_ADMIN_KEY: "sk-admin-secret-value",
        },
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(setProviderEnvGloballyMock).toHaveBeenCalledWith({
      OPENAI_ADMIN_KEY: "sk-admin-secret-value",
    });
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      keys: ["OPENAI_ADMIN_KEY"],
    });
    expect(JSON.stringify(payload)).not.toContain("sk-admin-secret-value");
  });

  it("rejects provider env persistence without CSRF", async () => {
    const response = await POST(new Request("http://127.0.0.1:3000/api/local-tools/provider-env", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        entries: {
          OPENAI_ADMIN_KEY: "sk-admin-secret-value",
        },
      }),
    }));

    expect(response.status).toBe(400);
    expect(setProviderEnvGloballyMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("CSRF"),
    });
  });

  it("rejects non-string provider env values", async () => {
    const response = await POST(new Request("http://127.0.0.1:3000/api/local-tools/provider-env", {
      method: "POST",
      headers: {
        ...await createLocalSessionHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        entries: {
          OPENAI_ADMIN_KEY: 123,
        },
      }),
    }));

    expect(response.status).toBe(400);
    expect(setProviderEnvGloballyMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("must be a string"),
    });
  });
});

async function createLocalSessionHeaders(): Promise<Record<string, string>> {
  const response = await createSession(new Request("http://127.0.0.1:3000/api/auth/session", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
    },
  }));
  const payload = await response.json() as { csrfToken: string };

  return {
    host: "127.0.0.1:3000",
    origin: "http://127.0.0.1:3000",
    cookie: response.headers.get("set-cookie") ?? "",
    "x-moneysiren-csrf": payload.csrfToken,
  };
}
