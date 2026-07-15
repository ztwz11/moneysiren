import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLocalSecurityState,
  createLocalSession,
  localSessionCookie,
} from "../../../../lib/local-security";
import { runOpenAiFirstSync } from "../../../../lib/openai-first-sync";
import { POST } from "./route";

vi.mock("../../../../lib/openai-first-sync", () => ({
  runOpenAiFirstSync: vi.fn(),
}));

const runOpenAiFirstSyncMock = vi.mocked(runOpenAiFirstSync);
const ADMIN_KEY = "fake-openai-admin-key-for-route-test";

beforeEach(() => {
  clearLocalSecurityState();
  runOpenAiFirstSyncMock.mockReset();
});

describe("/api/local/openai-first-sync", () => {
  it("rejects requests without a local session and CSRF token", async () => {
    const response = await POST(localRequest({
      body: JSON.stringify({ adminKey: ADMIN_KEY }),
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(runOpenAiFirstSyncMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      code: "local_session_required",
      localOnly: true,
      secretsReturned: false,
    });
  });

  it("rejects malformed or expanded request bodies before orchestration", async () => {
    const response = await POST(authenticatedRequest({
      adminKey: ADMIN_KEY,
      sourcePath: "C:/private/path",
    }));

    expect(response.status).toBe(400);
    expect(runOpenAiFirstSyncMock).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("private/path");
  });

  it("returns a no-store secret-free success response", async () => {
    runOpenAiFirstSyncMock.mockResolvedValue(safeResult({
      status: "ok",
      stage: "complete",
      code: "openai_first_sync_complete",
      credentialSaved: true,
      canonicalSynced: true,
    }));

    const response = await POST(authenticatedRequest({ adminKey: ADMIN_KEY }));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(runOpenAiFirstSyncMock).toHaveBeenCalledWith({ adminKey: ADMIN_KEY });
    expect(payload).toMatchObject({
      status: "ok",
      credentialSaved: true,
      canonicalSynced: true,
      localOnly: true,
      secretsReturned: false,
    });
    expect(serialized).not.toContain(ADMIN_KEY);
    expect(serialized).not.toMatch(/authorization|rawPayload|rawResponse|providerPayload|billingProfile|private\/path/i);
  });

  it("allows an authenticated retry to use the already-saved environment credential", async () => {
    runOpenAiFirstSyncMock.mockResolvedValue(safeResult({
      status: "ok",
      stage: "complete",
      code: "openai_first_sync_complete",
      credentialSaved: true,
      canonicalSynced: true,
    }));

    const response = await POST(authenticatedRequest({}));

    expect(response.status).toBe(200);
    expect(runOpenAiFirstSyncMock).toHaveBeenCalledWith({});
  });

  it("preserves an honest partial result without exposing persistence errors", async () => {
    runOpenAiFirstSyncMock.mockResolvedValue(safeResult({
      status: "partial",
      stage: "canonical",
      code: "openai_first_sync_canonical_save_failed",
      credentialSaved: true,
      canonicalSynced: false,
    }));

    const response = await POST(authenticatedRequest({ adminKey: ADMIN_KEY }));
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).toContain("openai_first_sync_canonical_save_failed");
    expect(serialized).not.toContain(ADMIN_KEY);
  });

  it("maps unexpected exceptions to one fixed safe error", async () => {
    runOpenAiFirstSyncMock.mockRejectedValue(new Error(
      `provider failed with ${ADMIN_KEY} at C:/private/path`,
    ));

    const response = await POST(authenticatedRequest({ adminKey: ADMIN_KEY }));
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(serialized).toBe(JSON.stringify({
      code: "openai_first_sync_failed",
      localOnly: true,
      secretsReturned: false,
    }));
  });
});

function authenticatedRequest(body: unknown): Request {
  const session = createLocalSession();

  return localRequest({
    body: JSON.stringify(body),
    headers: {
      cookie: localSessionCookie(session).split(";", 1)[0] ?? "",
      "x-moneysiren-csrf": session.csrfToken,
    },
  });
}

function localRequest(init: RequestInit = {}): Request {
  return new Request("http://127.0.0.1:3000/api/local/openai-first-sync", {
    ...init,
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function safeResult(overrides: {
  status: "ok" | "error" | "partial";
  stage: "complete" | "validation" | "environment" | "canonical";
  code:
    | "openai_first_sync_complete"
    | "openai_first_sync_invalid_request"
    | "openai_first_sync_validation_failed"
    | "openai_first_sync_credential_save_failed"
    | "openai_first_sync_canonical_save_failed";
  credentialSaved: boolean;
  canonicalSynced: boolean;
}) {
  return {
    generatedAt: "2026-07-13T03:00:00.000Z",
    providerKey: "openai" as const,
    ...overrides,
    counts: {
      usage: 1,
      billing: 1,
      health: 0,
      estimates: 1,
      alerts: 0,
    },
    localOnly: true as const,
    secretsReturned: false as const,
  };
}
