import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEncryptedVaultCredentialStore, createMemoryCredentialStore } from "../../../packages/credentials/src/index";
import { readConnectionsStatus, summarizeConnectionState } from "./connection-status";

const EMPTY_LOCAL_AI_CLI_STATUS = {
  generatedAt: "2026-06-08T00:00:00.000Z",
  localOnly: true,
  secretsReturned: false,
  providers: [],
} as const;

describe("connection status", () => {
  it("summarizes env and credential-store status without returning secret values", async () => {
    const store = createMemoryCredentialStore({
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });
    await store.setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    });

    const payload = await readConnectionsStatus({
      env: {
        AWS_PROFILE: "fake-profile",
      },
      credentialStore: store,
      localAiCliStatus: EMPTY_LOCAL_AI_CLI_STATUS,
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    });
    expect(payload.providers.find((provider) => provider.providerKey === "aws")).toMatchObject({
      connectionState: "env_configured",
      credentialSource: "env",
      readOnlyTestState: "env_configured",
    });
    expect(payload.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      connectionState: "credential_store_configured",
      credentialSource: "credential_store",
      readOnlyTestState: "credential_store_configured",
      connections: [
        expect.objectContaining({
          label: "Default",
          connectionState: "credential_store_configured",
        }),
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");
    expect(JSON.stringify(payload)).not.toContain("fake-profile");
  });

  it("reports a locked vault without exposing credential material", async () => {
    const dir = await mkdtemp(join(tmpdir(), "stackspend-web-connections-"));
    const vaultPath = join(dir, "locked-vault.json");
    const unlocked = createEncryptedVaultCredentialStore({
      passphrase: "fake passphrase",
      vaultPath,
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });
    await unlocked.setCredential("supabase", "read-only", {
      secret: "FAKE_SUPABASE_PAT_FOR_TESTS",
      authMethod: "pat",
    });
    const locked = createEncryptedVaultCredentialStore({
      vaultPath,
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    const payload = await readConnectionsStatus({
      credentialStore: locked,
      localAiCliStatus: EMPTY_LOCAL_AI_CLI_STATUS,
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(payload.providers.find((provider) => provider.providerKey === "supabase")).toMatchObject({
      connectionState: "locked",
      credentialSource: "locked",
      credentialStore: {
        storeState: "locked",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("FAKE_SUPABASE_PAT_FOR_TESTS");
  });

  it("keeps connection precedence explicit", () => {
    expect(summarizeConnectionState(true, {
      provider: "openai",
      scope: "read-only",
      backend: "memory",
      storeState: "ready",
      state: "credential_store_configured",
    })).toBe("env_configured");
  });

  it("treats installed local AI CLIs as read-only local connections", async () => {
    const payload = await readConnectionsStatus({
      credentialStore: createMemoryCredentialStore({
        now: () => new Date("2026-06-08T00:00:00.000Z"),
      }),
      localAiCliStatus: {
        generatedAt: "2026-06-08T00:00:00.000Z",
        localOnly: true,
        secretsReturned: false,
        providers: [
          {
            providerKey: "codex-cli",
            displayName: "Codex CLI",
            command: "codex",
            cli: {
              state: "installed",
              version: "1.2.3",
              detail: "codex 1.2.3",
            },
            usage: {
              source: "codex_sessions",
              period: "current_month",
              sessionCount: 1,
              turnCount: 2,
              toolCallCount: 3,
              inputTokens: null,
              outputTokens: null,
              cacheTokens: null,
              totalTokens: null,
              reasoningOutputTokens: null,
              logFileCount: 1,
              parsedUsageRecordCount: 2,
              searchedPathHint: "~\\.codex\\sessions",
              latestActivityAt: "2026-06-08T00:00:00.000Z",
              topModels: [],
              providerKind: "codex",
              statusLine: emptyStatusLineUsage(),
              message: "fake",
            },
          },
          {
            providerKey: "claude-cli",
            displayName: "Claude CLI",
            command: "claude",
            cli: {
              state: "missing",
              version: null,
              detail: null,
            },
            usage: {
              source: "claude_projects",
              period: "current_month",
              sessionCount: 0,
              turnCount: 0,
              toolCallCount: 0,
              inputTokens: null,
              outputTokens: null,
              cacheTokens: null,
              totalTokens: null,
              reasoningOutputTokens: null,
              logFileCount: 0,
              parsedUsageRecordCount: 0,
              searchedPathHint: "~\\.claude\\projects",
              latestActivityAt: null,
              topModels: [],
              providerKind: "claude",
              statusLine: emptyStatusLineUsage(),
              message: "fake",
            },
          },
        ],
      },
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(payload.providers.find((provider) => provider.providerKey === "codex-cli")).toMatchObject({
      connectionState: "env_configured",
      credentialSource: "env",
      readOnlyTestState: "read_only_ready",
      configuredEnvKeys: ["codex command", "codex_sessions"],
      missingEnvKeys: [],
    });
    expect(payload.providers.find((provider) => provider.providerKey === "claude-cli")).toMatchObject({
      connectionState: "not_configured",
    });
  });
});

function emptyStatusLineUsage() {
  return {
    contextWindowTokens: null,
    contextWindowLimit: null,
    contextWindowPercent: null,
    fiveHourUsedTokens: null,
    fiveHourLimitTokens: null,
    fiveHourLimitPercent: null,
    fiveHourRemainingTokens: null,
    fiveHourResetAt: null,
    weeklyUsedTokens: null,
    weeklyLimitTokens: null,
    weeklyLimitPercent: null,
    weeklyRemainingTokens: null,
    weeklyResetAt: null,
    lastInputTokens: null,
    lastOutputTokens: null,
    lastCacheTokens: null,
    lastReasoningTokens: null,
    lastTotalTokens: null,
    totalInputTokens: null,
    totalOutputTokens: null,
    totalCacheTokens: null,
    totalReasoningTokens: null,
    totalTokens: null,
  };
}
