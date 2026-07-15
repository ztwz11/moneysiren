import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenAiFirstSyncResult } from "./openai-first-sync";
import { connectAndSyncOpenAi, startLocalDesktopHud } from "./local-client";

const ADMIN_KEY = "fake-openai-admin-key-for-client-test";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local client OpenAI first sync", () => {
  it("creates a local session and posts the key with its CSRF token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "fake-csrf-token" }))
      .mockResolvedValueOnce(Response.json(safeResult()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await connectAndSyncOpenAi(ADMIN_KEY);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/session", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/local/openai-first-sync", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({ adminKey: ADMIN_KEY }),
      headers: expect.objectContaining({
        "X-MoneySiren-CSRF": "fake-csrf-token",
      }),
    }));
    expect(result.status).toBe("ok");
  });

  it("accepts a structured partial result so the UI can distinguish saved credentials", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "fake-csrf-token" }))
      .mockResolvedValueOnce(Response.json(safeResult({
        status: "partial",
        stage: "canonical",
        code: "openai_first_sync_canonical_save_failed",
        credentialSaved: true,
        canonicalSynced: false,
      })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(connectAndSyncOpenAi(ADMIN_KEY)).resolves.toMatchObject({
      status: "partial",
      credentialSaved: true,
      canonicalSynced: false,
    });
  });

  it("posts an empty object when retrying with the already-saved credential", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "fake-csrf-token" }))
      .mockResolvedValueOnce(Response.json(safeResult()));
    vi.stubGlobal("fetch", fetchMock);

    await connectAndSyncOpenAi();

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/local/openai-first-sync", expect.objectContaining({
      body: "{}",
    }));
  });

  it("rejects unstructured server errors without reflecting their body", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "fake-csrf-token" }))
      .mockResolvedValueOnce(Response.json({
        message: `provider returned ${ADMIN_KEY} from C:/private/path`,
      }, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(connectAndSyncOpenAi(ADMIN_KEY)).rejects.toThrow(
      "OpenAI first sync failed with status 500.",
    );
  });
});

describe("local client desktop HUD", () => {
  it("uses a local session and CSRF token to request the HUD runtime", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "fake-hud-csrf-token" }))
      .mockResolvedValueOnce(Response.json({ status: "starting" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(startLocalDesktopHud("/hud?locale=ko")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/local/desktop-runtime", expect.objectContaining({
      body: JSON.stringify({ path: "/hud?locale=ko" }),
      credentials: "same-origin",
      headers: expect.objectContaining({
        "X-MoneySiren-CSRF": "fake-hud-csrf-token",
      }),
      method: "POST",
    }));
  });
});

function safeResult(overrides: Partial<OpenAiFirstSyncResult> = {}): OpenAiFirstSyncResult {
  return {
    ...baseResult(),
    ...overrides,
  };
}

function baseResult(): OpenAiFirstSyncResult {
  return {
    generatedAt: "2026-07-13T03:00:00.000Z",
    providerKey: "openai",
    status: "ok",
    stage: "complete",
    code: "openai_first_sync_complete",
    credentialSaved: true,
    canonicalSynced: true,
    counts: {
      usage: 1,
      billing: 1,
      health: 0,
      estimates: 1,
      alerts: 0,
    },
    localOnly: true,
    secretsReturned: false,
  };
}
