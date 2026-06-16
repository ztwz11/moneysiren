import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalSecurityState } from "../../../../../lib/local-security";
import { setAwsProfileGlobally } from "../../../../../lib/local-tools";
import { POST as createSession } from "../../../auth/session/route";
import { POST } from "./route";

vi.mock("../../../../../lib/local-tools", () => ({
  setAwsProfileGlobally: vi.fn(),
}));

const setAwsProfileGloballyMock = vi.mocked(setAwsProfileGlobally);

beforeEach(() => {
  clearLocalSecurityState();
  setAwsProfileGloballyMock.mockReset();
});

describe("AWS local profile route", () => {
  it("persists AWS_PROFILE through a local CSRF-protected request", async () => {
    setAwsProfileGloballyMock.mockResolvedValue({
      generatedAt: "2026-06-09T00:00:00.000Z",
      localOnly: true,
      secretsReturned: false,
      profileName: "moneysiren-readonly",
      target: "windows_user_environment",
      activeForCurrentProcess: true,
      restartHint: "New terminals inherit the saved AWS_PROFILE.",
    });

    const response = await POST(new Request("http://127.0.0.1:3000/api/local-tools/aws/profile", {
      method: "POST",
      headers: {
        ...await createLocalSessionHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        profileName: "moneysiren-readonly",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(setAwsProfileGloballyMock).toHaveBeenCalledWith("moneysiren-readonly");
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      profileName: "moneysiren-readonly",
      target: "windows_user_environment",
    });
    expect(JSON.stringify(payload)).not.toContain("AWS_SECRET_ACCESS_KEY");
  });

  it("persists AWS_PROFILE when route-local session memory is not shared", async () => {
    setAwsProfileGloballyMock.mockResolvedValue({
      generatedAt: "2026-06-09T00:00:00.000Z",
      localOnly: true,
      secretsReturned: false,
      profileName: "moneysiren-readonly",
      target: "windows_user_environment",
      activeForCurrentProcess: true,
      restartHint: "New terminals inherit the saved AWS_PROFILE.",
    });
    const session = await createLocalSessionHeaders();
    clearLocalSecurityState();

    const response = await POST(new Request("http://127.0.0.1:3000/api/local-tools/aws/profile", {
      method: "POST",
      headers: {
        ...session,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        profileName: "moneysiren-readonly",
      }),
    }));

    expect(response.status).toBe(200);
    expect(setAwsProfileGloballyMock).toHaveBeenCalledWith("moneysiren-readonly");
  });

  it("rejects AWS_PROFILE persistence without CSRF", async () => {
    const response = await POST(new Request("http://127.0.0.1:3000/api/local-tools/aws/profile", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        profileName: "moneysiren-readonly",
      }),
    }));

    expect(response.status).toBe(400);
    expect(setAwsProfileGloballyMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("CSRF"),
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
