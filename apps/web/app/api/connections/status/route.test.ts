import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalOpenAiAdminKey = process.env.OPENAI_ADMIN_KEY;
const originalCredentialBackend = process.env.MONEYSIREN_CREDENTIAL_BACKEND;
const originalCodexSessionsDir = process.env.MONEYSIREN_CODEX_SESSIONS_DIR;
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

afterEach(() => {
  if (originalOpenAiAdminKey === undefined) {
    delete process.env.OPENAI_ADMIN_KEY;
  } else {
    process.env.OPENAI_ADMIN_KEY = originalOpenAiAdminKey;
  }

  if (originalCredentialBackend === undefined) {
    delete process.env.MONEYSIREN_CREDENTIAL_BACKEND;
  } else {
    process.env.MONEYSIREN_CREDENTIAL_BACKEND = originalCredentialBackend;
  }

  if (originalCodexSessionsDir === undefined) {
    delete process.env.MONEYSIREN_CODEX_SESSIONS_DIR;
  } else {
    process.env.MONEYSIREN_CODEX_SESSIONS_DIR = originalCodexSessionsDir;
  }

  if (originalClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR;
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
  }
});

describe("GET /api/connections/status", () => {
  it("returns connection states without secret values", async () => {
    const localCliRoot = await mkdtemp(join(tmpdir(), "moneysiren-route-cli-"));

    process.env.OPENAI_ADMIN_KEY = "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS";
    process.env.MONEYSIREN_CREDENTIAL_BACKEND = "vault";
    process.env.MONEYSIREN_CODEX_SESSIONS_DIR = join(localCliRoot, "codex-sessions");
    process.env.CLAUDE_CONFIG_DIR = join(localCliRoot, "claude");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.providers.find((provider: { providerKey: string }) => provider.providerKey === "openai"))
      .toMatchObject({
        connectionState: "env_configured",
        readOnlyTestState: "env_configured",
      });
    expect(JSON.stringify(payload)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    });
  });
});
