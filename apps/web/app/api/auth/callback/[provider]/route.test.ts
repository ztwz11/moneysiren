import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearLocalSecurityState,
  createLocalSession,
  createOAuthTransaction,
} from "../../../../../lib/local-security";
import { GET } from "./route";

const originalFetch = globalThis.fetch;
const ORIGINAL_ENV = {
  backend: process.env.STACKSPEND_CREDENTIAL_BACKEND,
  passphrase: process.env.STACKSPEND_CREDENTIAL_VAULT_PASSPHRASE,
  vaultPath: process.env.STACKSPEND_CREDENTIAL_VAULT_PATH,
  clientId: process.env.SUPABASE_OAUTH_CLIENT_ID,
  clientSecret: process.env.SUPABASE_OAUTH_CLIENT_SECRET,
  tokenUrl: process.env.SUPABASE_OAUTH_TOKEN_URL,
};

beforeEach(() => {
  clearLocalSecurityState();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("STACKSPEND_CREDENTIAL_BACKEND", ORIGINAL_ENV.backend);
  restoreEnv("STACKSPEND_CREDENTIAL_VAULT_PASSPHRASE", ORIGINAL_ENV.passphrase);
  restoreEnv("STACKSPEND_CREDENTIAL_VAULT_PATH", ORIGINAL_ENV.vaultPath);
  restoreEnv("SUPABASE_OAUTH_CLIENT_ID", ORIGINAL_ENV.clientId);
  restoreEnv("SUPABASE_OAUTH_CLIENT_SECRET", ORIGINAL_ENV.clientSecret);
  restoreEnv("SUPABASE_OAUTH_TOKEN_URL", ORIGINAL_ENV.tokenUrl);
});

describe("GET /api/auth/callback/[provider]", () => {
  it("accepts only a matching localhost OAuth transaction", async () => {
    const session = createLocalSession();
    const transaction = createOAuthTransaction({
      provider: "supabase",
      session,
      request: new Request("http://127.0.0.1:3000/api/auth/start/supabase", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
        },
      }),
    });
    const response = await GET(new Request(
      `http://127.0.0.1:3000/api/auth/callback/supabase?state=${transaction.state}&code=FAKE_CODE`,
      {
        headers: {
          host: "127.0.0.1:3000",
        },
      },
    ), {
      params: Promise.resolve({
        provider: "supabase",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      provider: "supabase",
      status: "oauth_callback_received",
      credentialStored: false,
      secretsReturned: false,
    });
  });

  it("exchanges configured Supabase OAuth callbacks and stores only validated credential status", async () => {
    const dir = await mkdtemp(join(tmpdir(), "stackspend-oauth-callback-"));
    process.env.STACKSPEND_CREDENTIAL_BACKEND = "vault";
    process.env.STACKSPEND_CREDENTIAL_VAULT_PASSPHRASE = "fake local passphrase";
    process.env.STACKSPEND_CREDENTIAL_VAULT_PATH = join(dir, "credentials-vault.json");
    process.env.SUPABASE_OAUTH_CLIENT_ID = "fake-client-id";
    process.env.SUPABASE_OAUTH_CLIENT_SECRET = "fake-client-secret";
    process.env.SUPABASE_OAUTH_TOKEN_URL = "http://127.0.0.1:3000/fake-token";
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("fake-token")) {
        return Response.json({
          access_token: "FAKE_SUPABASE_OAUTH_TOKEN_FOR_TESTS",
          expires_in: 3600,
        });
      }

      return Response.json([]);
    }) as typeof fetch;

    const session = createLocalSession();
    const transaction = createOAuthTransaction({
      provider: "supabase",
      session,
      request: new Request("http://127.0.0.1:3000/api/auth/start/supabase", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
        },
      }),
    });
    const response = await GET(new Request(
      `http://127.0.0.1:3000/api/auth/callback/supabase?state=${transaction.state}&code=FAKE_CODE`,
      {
        headers: {
          host: "127.0.0.1:3000",
        },
      },
    ), {
      params: Promise.resolve({
        provider: "supabase",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      provider: "supabase",
      credentialStored: true,
      secretsReturned: false,
    });
    expect(JSON.stringify(payload)).not.toContain("FAKE_SUPABASE_OAUTH_TOKEN_FOR_TESTS");
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
