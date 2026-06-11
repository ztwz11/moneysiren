import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearLocalSecurityState } from "../../../../../lib/local-security";
import { POST as createSession } from "../../session/route";
import { POST } from "./route";

const originalCredentialWrites = process.env.STACKSPEND_ENABLE_LOCAL_CREDENTIAL_WRITES;

beforeEach(() => {
  clearLocalSecurityState();
  delete process.env.STACKSPEND_ENABLE_LOCAL_CREDENTIAL_WRITES;
});

afterEach(() => {
  if (originalCredentialWrites === undefined) {
    delete process.env.STACKSPEND_ENABLE_LOCAL_CREDENTIAL_WRITES;
    return;
  }

  process.env.STACKSPEND_ENABLE_LOCAL_CREDENTIAL_WRITES = originalCredentialWrites;
});

describe("POST /api/auth/start/[provider]", () => {
  it("rejects OAuth starts by default for the v0.1 env-only secret model", async () => {
    const session = await createLocalSessionHeaders();
    const response = await POST(new Request("http://127.0.0.1:3000/api/auth/start/supabase", {
      method: "POST",
      headers: session,
    }), {
      params: Promise.resolve({
        provider: "supabase",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      provider: "supabase",
      oauthConfigured: false,
      error: expect.stringContaining("environment variables only"),
    });
    expect(JSON.stringify(payload)).not.toContain("codeVerifier");
  });

  it("creates server-held OAuth state, nonce, and PKCE only when experimental local writes are enabled", async () => {
    process.env.STACKSPEND_ENABLE_LOCAL_CREDENTIAL_WRITES = "1";
    const session = await createLocalSessionHeaders();
    const response = await POST(new Request("http://127.0.0.1:3000/api/auth/start/supabase", {
      method: "POST",
      headers: session,
    }), {
      params: Promise.resolve({
        provider: "supabase",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      provider: "supabase",
      callbackUrl: "http://127.0.0.1:3000/api/auth/callback/supabase",
      pkce: "server_held",
      nonce: "server_held",
      oauthConfigured: false,
    });
    expect(payload.state).toEqual(expect.any(String));
    expect(JSON.stringify(payload)).not.toContain("codeVerifier");
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
  const payload = await response.json();

  return {
    host: "127.0.0.1:3000",
    origin: "http://127.0.0.1:3000",
    cookie: response.headers.get("set-cookie") ?? "",
    "x-stackspend-csrf": payload.csrfToken,
  };
}
