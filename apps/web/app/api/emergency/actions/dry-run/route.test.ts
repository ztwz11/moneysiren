import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { readLocalStore } from "../../../../../../../packages/db/src/index";
import { clearLocalSecurityState } from "../../../../../lib/local-security";
import { POST as createSession } from "../../../auth/session/route";
import { POST } from "./route";

const originalDbPath = process.env.MONEYSIREN_DB_PATH;

beforeEach(() => {
  clearLocalSecurityState();
  if (originalDbPath === undefined) {
    delete process.env.MONEYSIREN_DB_PATH;
  } else {
    process.env.MONEYSIREN_DB_PATH = originalDbPath;
  }
});

describe("POST /api/emergency/actions/dry-run", () => {
  it("requires a local session and CSRF token", async () => {
    const response = await POST(localRequest({
      body: JSON.stringify({ providerKey: "aws" }),
      method: "POST",
    }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    });
  });

  it("returns dry-run readiness without enabling execution", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-emergency-route-"));
    const dbPath = join(rootDir, "moneysiren.sqlite");
    process.env.MONEYSIREN_DB_PATH = dbPath;

    const response = await POST(localRequest({
      body: JSON.stringify({
        providerKey: "aws",
        connectionState: "read_only_ready",
        readOnlyTestState: "read_only_ready",
        canonicalFreshness: "fresh",
        liveFreshness: "live",
        healthStatus: "ok",
        riskLevel: "critical",
      }),
      headers: await createLocalSessionHeaders(),
      method: "POST",
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
      mode: "dry_run",
      executeEnabled: false,
      providerKey: "aws",
    });
    expect(payload.plan.candidates.every((candidate: { executeEnabled: boolean }) =>
      candidate.executeEnabled === false
    )).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");

    await expect(readLocalStore({ dbPath })).resolves.toMatchObject({
      emergencyActionRuns: [
        expect.objectContaining({
          providerKey: "aws",
          mode: "dry_run",
          status: "dry_run",
          localOnly: true,
          secretsReturned: false,
        }),
      ],
    });
  });

  it("rejects unsupported providers", async () => {
    const response = await POST(localRequest({
      body: JSON.stringify({ providerKey: "unknown-provider" }),
      headers: await createLocalSessionHeaders(),
      method: "POST",
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    });
  });
});

function localRequest(init: RequestInit = {}): Request {
  return new Request("http://127.0.0.1:3000/api/emergency/actions/dry-run", {
    ...init,
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
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
