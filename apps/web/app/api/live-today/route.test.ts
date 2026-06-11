import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearLiveTodayCache } from "../../../lib/live-today";
import { GET } from "./route";

const originalCredentialBackend = process.env.STACKSPEND_CREDENTIAL_BACKEND;
const originalOpenAiAdminKey = process.env.OPENAI_ADMIN_KEY;
const originalCodexSessionsDir = process.env.STACKSPEND_CODEX_SESSIONS_DIR;
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

afterEach(() => {
  if (originalCredentialBackend === undefined) {
    delete process.env.STACKSPEND_CREDENTIAL_BACKEND;
  } else {
    process.env.STACKSPEND_CREDENTIAL_BACKEND = originalCredentialBackend;
  }

  if (originalOpenAiAdminKey === undefined) {
    delete process.env.OPENAI_ADMIN_KEY;
  } else {
    process.env.OPENAI_ADMIN_KEY = originalOpenAiAdminKey;
  }

  if (originalCodexSessionsDir === undefined) {
    delete process.env.STACKSPEND_CODEX_SESSIONS_DIR;
  } else {
    process.env.STACKSPEND_CODEX_SESSIONS_DIR = originalCodexSessionsDir;
  }

  if (originalClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR;
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
  }
});

describe("GET /api/live-today", () => {
  it("returns a provisional cache without provider secrets", async () => {
    const localCliRoot = await mkdtemp(join(tmpdir(), "stackspend-route-cli-"));

    clearLiveTodayCache();
    process.env.STACKSPEND_CREDENTIAL_BACKEND = "vault";
    process.env.OPENAI_ADMIN_KEY = "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS";
    process.env.STACKSPEND_CODEX_SESSIONS_DIR = join(localCliRoot, "codex-sessions");
    process.env.CLAUDE_CONFIG_DIR = join(localCliRoot, "claude");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.ttlSeconds).toBe(60);
    expect(["empty", "fresh", "stale"]).toContain(payload.cacheState);
    expect(JSON.stringify(payload)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");
  });
});
