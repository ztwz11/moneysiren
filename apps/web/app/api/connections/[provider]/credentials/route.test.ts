import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearLocalSecurityState } from "../../../../../lib/local-security";
import { POST as createSession } from "../../../auth/session/route";
import { DELETE, POST } from "./route";

const ORIGINAL_ENV = {
  backend: process.env.MONEYSIREN_CREDENTIAL_BACKEND,
  passphrase: process.env.MONEYSIREN_CREDENTIAL_VAULT_PASSPHRASE,
  vaultPath: process.env.MONEYSIREN_CREDENTIAL_VAULT_PATH,
  openai: process.env.OPENAI_ADMIN_KEY,
  credentialWrites: process.env.MONEYSIREN_ENABLE_LOCAL_CREDENTIAL_WRITES,
};
const originalFetch = globalThis.fetch;

beforeEach(async () => {
  clearLocalSecurityState();
  const dir = await mkdtemp(join(tmpdir(), "moneysiren-credential-route-"));
  process.env.MONEYSIREN_CREDENTIAL_BACKEND = "vault";
  process.env.MONEYSIREN_CREDENTIAL_VAULT_PASSPHRASE = "fake local passphrase";
  process.env.MONEYSIREN_CREDENTIAL_VAULT_PATH = join(dir, "credentials-vault.json");
  delete process.env.MONEYSIREN_ENABLE_LOCAL_CREDENTIAL_WRITES;
  delete process.env.OPENAI_ADMIN_KEY;
  globalThis.fetch = (async () => Response.json({
    data: [],
  })) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("MONEYSIREN_CREDENTIAL_BACKEND", ORIGINAL_ENV.backend);
  restoreEnv("MONEYSIREN_CREDENTIAL_VAULT_PASSPHRASE", ORIGINAL_ENV.passphrase);
  restoreEnv("MONEYSIREN_CREDENTIAL_VAULT_PATH", ORIGINAL_ENV.vaultPath);
  restoreEnv("OPENAI_ADMIN_KEY", ORIGINAL_ENV.openai);
  restoreEnv("MONEYSIREN_ENABLE_LOCAL_CREDENTIAL_WRITES", ORIGINAL_ENV.credentialWrites);
});

describe("provider credential routes", () => {
  it("rejects local credential writes by default for the v0.1 env-only secret model", async () => {
    const session = await createLocalSessionHeaders();
    const response = await POST(new Request("http://127.0.0.1:3000/api/connections/openai/credentials", {
      method: "POST",
      headers: {
        ...session,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      }),
    }), {
      params: Promise.resolve({
        provider: "openai",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("environment variables only"),
    });
  });

  it("stores and deletes a read-only credential only when experimental local writes are enabled", async () => {
    process.env.MONEYSIREN_ENABLE_LOCAL_CREDENTIAL_WRITES = "1";
    const session = await createLocalSessionHeaders();
    const response = await POST(new Request("http://127.0.0.1:3000/api/connections/openai/credentials", {
      method: "POST",
      headers: {
        ...session,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      }),
    }), {
      params: Promise.resolve({
        provider: "openai",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.provider).toMatchObject({
      providerKey: "openai",
      connectionState: "credential_store_configured",
      credentialSource: "credential_store",
      readOnlyTestState: "read_only_ready",
    });
    expect(payload.connectionId).toEqual(expect.any(String));
    expect(payload.provider.connections).toEqual([
      expect.objectContaining({
        connectionId: payload.connectionId,
        label: "OpenAI",
        readOnlyTestState: "read_only_ready",
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");

    const deleted = await DELETE(new Request(
      `http://127.0.0.1:3000/api/connections/openai/credentials?connectionId=${payload.connectionId}`,
      {
      method: "DELETE",
      headers: session,
      },
    ), {
      params: Promise.resolve({
        provider: "openai",
      }),
    });
    const deletedPayload = await deleted.json();

    expect(deleted.status).toBe(200);
    expect(deletedPayload.provider).toMatchObject({
      providerKey: "openai",
      connectionState: "not_configured",
    });
  }, 120000);

  it("rejects credential mutation without CSRF", async () => {
    const response = await POST(new Request("http://127.0.0.1:3000/api/connections/openai/credentials", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      }),
    }), {
      params: Promise.resolve({
        provider: "openai",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("CSRF"),
    });
  });

  it("does not store raw AWS access keys through MoneySiren", async () => {
    process.env.MONEYSIREN_ENABLE_LOCAL_CREDENTIAL_WRITES = "1";
    const session = await createLocalSessionHeaders();
    const response = await POST(new Request("http://127.0.0.1:3000/api/connections/aws/credentials", {
      method: "POST",
      headers: {
        ...session,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secret: "FAKE_AWS_SECRET_FOR_TESTS",
      }),
    }), {
      params: Promise.resolve({
        provider: "aws",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("AWS raw access keys"),
    });
  });

  it("rejects roadmap provider credential writes even when experimental writes are enabled", async () => {
    process.env.MONEYSIREN_ENABLE_LOCAL_CREDENTIAL_WRITES = "1";
    const session = await createLocalSessionHeaders();
    globalThis.fetch = (async () => {
      throw new Error("Roadmap provider credentials must not call live validation.");
    }) as typeof fetch;
    const response = await POST(new Request("http://127.0.0.1:3000/api/connections/vercel/credentials", {
      method: "POST",
      headers: {
        ...session,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        label: "Vercel personal",
        secret: "FAKE_VERCEL_TOKEN_FOR_TESTS",
      }),
    }), {
      params: Promise.resolve({
        provider: "vercel",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: expect.stringContaining("not connectable"),
    });
    expect(JSON.stringify(payload)).not.toContain("FAKE_VERCEL_TOKEN_FOR_TESTS");
  }, 120000);
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
