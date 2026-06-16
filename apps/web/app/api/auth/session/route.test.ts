import { describe, expect, it, beforeEach } from "vitest";
import { clearLocalSecurityState } from "../../../../lib/local-security";
import { POST } from "./route";

beforeEach(() => {
  clearLocalSecurityState();
});

describe("POST /api/auth/session", () => {
  it("creates an opaque local session and returns CSRF separately", async () => {
    const response = await POST(new Request("http://127.0.0.1:3000/api/auth/session", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
      },
    }));
    const payload = await response.json();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(payload.csrfToken).toEqual(expect.any(String));
    expect(cookie).toContain("moneysiren_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain(payload.csrfToken);
  });
});
