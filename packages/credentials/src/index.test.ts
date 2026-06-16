import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  createEncryptedVaultCredentialStore,
  createMemoryCredentialStore,
  createOsKeychainCredentialStore,
  deleteCredential,
  getCredential,
  getCredentialStatus,
  setCredential,
} from "./index.js";

const FIXED_NOW = new Date("2026-06-08T00:00:00.000Z");

describe("credential store abstraction", () => {
  it("supports the required get/set/delete/test interface without exposing secrets in status", async () => {
    const store = createMemoryCredentialStore({
      now: () => FIXED_NOW,
    });

    await setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    }, { store });

    await expect(getCredential("openai", "read-only", { store })).resolves.toMatchObject({
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    });
    await expect(getCredentialStatus("openai", "read-only", { store })).resolves.toMatchObject({
      state: "credential_store_configured",
      backend: "memory",
      storeState: "ready",
      authMethod: "api_key",
    });
    expect(JSON.stringify(await getCredentialStatus("openai", "read-only", { store }))).not.toContain(
      "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
    );

    await deleteCredential("openai", "read-only", { store });
    await expect(getCredential("openai", "read-only", { store })).resolves.toBeNull();
  });

  it("stores fallback vault secrets encrypted on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "moneysiren-credentials-"));
    const vaultPath = join(dir, "credentials-vault.json");
    const store = createEncryptedVaultCredentialStore({
      vaultPath,
      passphrase: "fake local passphrase",
      now: () => FIXED_NOW,
    });

    await store.setCredential("cloudflare", "read-only", {
      secret: "FAKE_CLOUDFLARE_TOKEN_FOR_TESTS",
      authMethod: "api_token",
      metadata: {
        accountIds: "fake-account-a,fake-account-b",
      },
    });

    const vaultFile = await readFile(vaultPath, "utf8");
    expect(vaultFile).not.toContain("FAKE_CLOUDFLARE_TOKEN_FOR_TESTS");
    expect(vaultFile).not.toContain("fake-account-a");
    await expect(store.getCredential("cloudflare", "read-only")).resolves.toMatchObject({
      secret: "FAKE_CLOUDFLARE_TOKEN_FOR_TESTS",
      metadata: {
        accountIds: "fake-account-a,fake-account-b",
      },
    });
  });

  it("does not delete existing vault credentials while testing store writability", async () => {
    const dir = await mkdtemp(join(tmpdir(), "moneysiren-credentials-"));
    const vaultPath = join(dir, "credentials-vault.json");
    const store = createEncryptedVaultCredentialStore({
      vaultPath,
      passphrase: "fake local passphrase",
      now: () => FIXED_NOW,
    });
    const existing = await store.setCredential("openai", "read-only", {
      connectionId: "conn_existing",
      label: "Existing",
      secret: "FAKE_OPENAI_EXISTING_ADMIN_KEY",
      authMethod: "api_key",
    });

    await expect(store.testCredentialStore()).resolves.toMatchObject({
      state: "ready",
      writable: true,
    });
    await expect(store.getCredential("openai", "read-only", existing.connectionId)).resolves.toMatchObject({
      secret: "FAKE_OPENAI_EXISTING_ADMIN_KEY",
    });
  });

  it("stores multiple credentials per provider scope and deletes one connection at a time", async () => {
    const store = createMemoryCredentialStore({
      now: () => FIXED_NOW,
    });
    const first = await store.setCredential("openai", "read-only", {
      connectionId: "conn_first",
      label: "Personal",
      secret: "FAKE_OPENAI_PERSONAL_ADMIN_KEY",
      authMethod: "api_key",
    });
    const second = await store.setCredential("openai", "read-only", {
      connectionId: "conn_second",
      label: "Work",
      secret: "FAKE_OPENAI_WORK_ADMIN_KEY",
      authMethod: "api_key",
    });

    await expect(store.listCredentials("openai", "read-only")).resolves.toMatchObject([
      {
        connectionId: first.connectionId,
        label: "Personal",
      },
      {
        connectionId: second.connectionId,
        label: "Work",
      },
    ]);
    await expect(store.getCredential("openai", "read-only", second.connectionId)).resolves.toMatchObject({
      secret: "FAKE_OPENAI_WORK_ADMIN_KEY",
    });
    await expect(store.listCredentialStatuses("openai", "read-only")).resolves.toEqual([
      expect.objectContaining({
        connectionId: first.connectionId,
        label: "Personal",
      }),
      expect.objectContaining({
        connectionId: second.connectionId,
        label: "Work",
      }),
    ]);

    await store.deleteCredential("openai", "read-only", first.connectionId);

    await expect(store.listCredentials("openai", "read-only")).resolves.toEqual([
      expect.objectContaining({
        connectionId: second.connectionId,
      }),
    ]);
  });

  it("reports an existing encrypted vault as locked when no passphrase is loaded", async () => {
    const dir = await mkdtemp(join(tmpdir(), "moneysiren-credentials-"));
    const vaultPath = join(dir, "credentials-vault.json");
    const unlocked = createEncryptedVaultCredentialStore({
      vaultPath,
      passphrase: "fake local passphrase",
      now: () => FIXED_NOW,
    });

    await unlocked.setCredential("supabase", "read-only", {
      secret: "FAKE_SUPABASE_PAT_FOR_TESTS",
      authMethod: "pat",
    });

    const locked = createEncryptedVaultCredentialStore({
      vaultPath,
      now: () => FIXED_NOW,
    });

    await expect(locked.getCredentialStatus("supabase", "read-only")).resolves.toMatchObject({
      state: "locked",
      storeState: "locked",
    });
    await expect(locked.getCredential("supabase", "read-only")).rejects.toThrow("locked");
  });

  it("supports an injectable OS keychain-compatible backend", async () => {
    const entries = new Map<string, string>();
    const store = createOsKeychainCredentialStore({
      serviceName: "MoneySirenTests",
      now: () => FIXED_NOW,
      async loadKeyring() {
        return {
          Entry: class {
            private readonly key: string;

            constructor(service: string, account: string) {
              this.key = `${service}:${account}`;
            }

            getPassword(): string | null {
              return entries.get(this.key) ?? null;
            }

            setPassword(password: string): void {
              entries.set(this.key, password);
            }

            deletePassword(): void {
              entries.delete(this.key);
            }
          },
        };
      },
    });

    await store.setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "oauth2",
      expiresAt: "2026-06-09T00:00:00.000Z",
    });

    await expect(store.getCredentialStatus("openai", "read-only")).resolves.toMatchObject({
      state: "oauth_connected",
      backend: "os_keychain",
      storeState: "ready",
    });
    await expect(store.testCredentialStore()).resolves.toMatchObject({
      state: "ready",
      writable: true,
    });
  });
});
