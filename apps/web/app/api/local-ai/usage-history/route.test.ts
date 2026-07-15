import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearLocalSecurityState,
  createLocalSession,
  localSessionCookie,
} from "../../../../lib/local-security";
import { GET, POST } from "./route";

const ENV_KEYS = [
  "MONEYSIREN_DB_PATH",
  "MONEYSIREN_CODEX_SESSIONS_DIR",
  "CLAUDE_CONFIG_DIR",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  clearLocalSecurityState();

  for (const key of ENV_KEYS) {
    const original = originalEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

describe("/api/local-ai/usage-history", () => {
  it("returns an empty safe GET response without creating a missing database", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-local-history-get-"));
    const dbPath = join(rootDir, "missing.sqlite");
    process.env.MONEYSIREN_DB_PATH = dbPath;

    const response = await GET(localRequest());
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(payload).toMatchObject({
      rows: [],
      localOnly: true,
      secretsReturned: false,
    });
    await expect(access(dbPath)).rejects.toThrow();
    expect(serialized).not.toContain(rootDir);
    expect(serialized).not.toMatch(
      /prompt|command|auth|rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i,
    );
  });

  it("rejects POST without a local session and CSRF token", async () => {
    const response = await POST(localRequest({ method: "POST" }));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      localOnly: true,
      secretsReturned: false,
    });
  });

  it("returns only safe aggregate fields after an authenticated local sync", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-local-history-post-"));
    process.env.MONEYSIREN_DB_PATH = join(rootDir, "history.sqlite");
    process.env.MONEYSIREN_CODEX_SESSIONS_DIR = join(rootDir, "FAKE_PROMPT_MUST_NOT_LEAK", "sessions");
    process.env.CLAUDE_CONFIG_DIR = join(rootDir, "FAKE_AUTH_PATH_MUST_NOT_LEAK");
    const session = createLocalSession();
    const cookie = localSessionCookie(session).split(";", 1)[0] ?? "";
    const response = await POST(localRequest({
      method: "POST",
      headers: {
        cookie,
        "x-moneysiren-csrf": session.csrfToken,
      },
    }));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(payload).toMatchObject({
      rows: [],
      localOnly: true,
      secretsReturned: false,
    });
    expect(serialized).not.toContain(rootDir);
    expect(serialized).not.toContain("FAKE_PROMPT_MUST_NOT_LEAK");
    expect(serialized).not.toContain("FAKE_AUTH_PATH_MUST_NOT_LEAK");
    expect(serialized).not.toMatch(/prompt|command|auth|rawPayload|rawResponse|providerPayload/i);
  });
});

function localRequest(init: RequestInit = {}): Request {
  return new Request("http://127.0.0.1:3000/api/local-ai/usage-history", {
    ...init,
    headers: {
      host: "127.0.0.1:3000",
      ...(init.headers ?? {}),
    },
  });
}
