import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CollectedProviderSnapshots } from "../../../packages/core/src/index";
import { readLocalStore } from "../../../packages/db/src/index";
import { runOpenAiFirstSync } from "./openai-first-sync";

const NOW = new Date("2026-07-13T03:00:00.000Z");
const ADMIN_KEY = "fake-openai-admin-key-for-first-sync";

describe("OpenAI first sync orchestration", () => {
  it("validates, saves the env credential, then persists the same normalized collection", async () => {
    const collection = successfulCollection();
    const calls: string[] = [];
    const collect = vi.fn(async () => {
      calls.push("collect");
      return collection;
    });
    const saveEnvironment = vi.fn(async () => {
      calls.push("environment");
    });
    const saveCanonical = vi.fn(async () => {
      calls.push("canonical");
    });

    const result = await runOpenAiFirstSync({ adminKey: ADMIN_KEY }, {
      cwd: "C:/fake-local-root",
      env: { MONEYSIREN_DB_PATH: ".moneysiren/test.sqlite" },
      now: () => NOW,
      collect,
      saveEnvironment,
      saveCanonical,
    });

    expect(calls).toEqual(["collect", "environment", "canonical"]);
    expect(saveEnvironment).toHaveBeenCalledWith({ OPENAI_ADMIN_KEY: ADMIN_KEY });
    expect(saveCanonical).toHaveBeenCalledWith(expect.objectContaining({
      dbPath: expect.stringMatching(/[\\/]\.moneysiren[\\/]test\.sqlite$/),
      collectedAt: collection.collectedAt,
      status: "ok",
      snapshots: collection.snapshots,
      alerts: collection.alerts,
    }));
    expect(result).toMatchObject({
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
    });
    expect(JSON.stringify(result)).not.toContain(ADMIN_KEY);
  });

  it("does not save the credential or canonical data when validation fails", async () => {
    const saveEnvironment = vi.fn();
    const saveCanonical = vi.fn();
    const result = await runOpenAiFirstSync({ adminKey: ADMIN_KEY }, {
      now: () => NOW,
      collect: vi.fn(async () => failedCollection()),
      saveEnvironment,
      saveCanonical,
    });

    expect(result).toMatchObject({
      status: "error",
      stage: "validation",
      code: "openai_first_sync_validation_failed",
      credentialSaved: false,
      canonicalSynced: false,
    });
    expect(saveEnvironment).not.toHaveBeenCalled();
    expect(saveCanonical).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/sk-fake-secret|private\/path|provider payload/i);
  });

  it("bounds a stalled provider request and returns the fixed validation failure", async () => {
    const saveEnvironment = vi.fn();
    const saveCanonical = vi.fn();
    const result = await runOpenAiFirstSync({ adminKey: ADMIN_KEY }, {
      now: () => NOW,
      collectionTimeoutMs: 5,
      collect: vi.fn(async () => await new Promise<CollectedProviderSnapshots>(() => undefined)),
      saveEnvironment,
      saveCanonical,
    });

    expect(result).toMatchObject({
      status: "error",
      stage: "validation",
      code: "openai_first_sync_validation_failed",
    });
    expect(saveEnvironment).not.toHaveBeenCalled();
    expect(saveCanonical).not.toHaveBeenCalled();
  });

  it("does not write canonical data when environment persistence fails", async () => {
    const saveCanonical = vi.fn();
    const result = await runOpenAiFirstSync({ adminKey: ADMIN_KEY }, {
      now: () => NOW,
      collect: vi.fn(async () => successfulCollection()),
      saveEnvironment: vi.fn(async () => {
        throw new Error(`could not save ${ADMIN_KEY}`);
      }),
      saveCanonical,
    });

    expect(result).toMatchObject({
      status: "error",
      stage: "environment",
      code: "openai_first_sync_credential_save_failed",
      credentialSaved: false,
      canonicalSynced: false,
    });
    expect(saveCanonical).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(ADMIN_KEY);
  });

  it("returns an honest secret-free partial result when canonical persistence fails", async () => {
    const result = await runOpenAiFirstSync({ adminKey: ADMIN_KEY }, {
      now: () => NOW,
      collect: vi.fn(async () => successfulCollection()),
      saveEnvironment: vi.fn(async () => undefined),
      saveCanonical: vi.fn(async () => {
        throw new Error(`sqlite failed at C:/private/path with ${ADMIN_KEY}`);
      }),
    });

    expect(result).toMatchObject({
      status: "partial",
      stage: "canonical",
      code: "openai_first_sync_canonical_save_failed",
      credentialSaved: true,
      canonicalSynced: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/admin-key|private\/path|sqlite failed/i);
  });

  it("treats invalid local database configuration as partial after the credential is saved", async () => {
    const result = await runOpenAiFirstSync({ adminKey: ADMIN_KEY }, {
      env: { MONEYSIREN_DB_PATH: "   " },
      now: () => NOW,
      collect: vi.fn(async () => successfulCollection()),
      saveEnvironment: vi.fn(async () => undefined),
    });

    expect(result).toMatchObject({
      status: "partial",
      stage: "canonical",
      code: "openai_first_sync_canonical_save_failed",
      credentialSaved: true,
      canonicalSynced: false,
    });
  });

  it("retries canonical sync from the already-saved process environment without another env write", async () => {
    const saveEnvironment = vi.fn();
    const saveCanonical = vi.fn(async () => undefined);

    const result = await runOpenAiFirstSync({}, {
      env: { OPENAI_ADMIN_KEY: ADMIN_KEY },
      now: () => NOW,
      collect: vi.fn(async () => successfulCollection()),
      saveEnvironment,
      saveCanonical,
    });

    expect(result).toMatchObject({
      status: "ok",
      credentialSaved: true,
      canonicalSynced: true,
    });
    expect(saveEnvironment).not.toHaveBeenCalled();
    expect(saveCanonical).toHaveBeenCalledOnce();
  });

  it("persists the normalized successful collection through the real SQLite boundary", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-openai-first-sync-"));
    const dbPath = join(rootDir, "first-sync.sqlite");

    try {
      const result = await runOpenAiFirstSync({ adminKey: ADMIN_KEY }, {
        cwd: rootDir,
        env: { MONEYSIREN_DB_PATH: dbPath },
        now: () => NOW,
        collect: vi.fn(async () => successfulCollection()),
        saveEnvironment: vi.fn(async () => undefined),
      });
      const store = await readLocalStore({ dbPath });

      expect(result.status).toBe("ok");
      expect(store.providers).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "openai" }),
      ]));
      expect(store.usageSnapshots).toHaveLength(1);
      expect(store.billingSnapshots).toHaveLength(1);
      expect(store.costEstimates).toHaveLength(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects malformed keys before any external or persistence boundary", async () => {
    const collect = vi.fn();
    const saveEnvironment = vi.fn();
    const saveCanonical = vi.fn();

    const result = await runOpenAiFirstSync({ adminKey: " short " }, {
      now: () => NOW,
      collect,
      saveEnvironment,
      saveCanonical,
    });

    expect(result.code).toBe("openai_first_sync_invalid_request");
    expect(collect).not.toHaveBeenCalled();
    expect(saveEnvironment).not.toHaveBeenCalled();
    expect(saveCanonical).not.toHaveBeenCalled();
  });
});

function successfulCollection(): CollectedProviderSnapshots {
  return {
    provider: "openai",
    collectedAt: NOW.toISOString(),
    status: "ok",
    snapshots: {
      usage: [{
        provider: "openai",
        providerAccountRef: "local-account-ref",
        service: "OpenAI API",
        metric: "input_tokens",
        value: 10,
        unit: "tokens",
        collectedAt: NOW.toISOString(),
      }],
      billing: [{
        provider: "openai",
        providerAccountRef: "local-account-ref",
        amountMinor: 125,
        currency: "USD",
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-02T00:00:00.000Z",
        collectedAt: NOW.toISOString(),
        status: "final",
      }],
      serviceHealth: [],
      costEstimates: [{
        provider: "openai",
        providerAccountRef: "local-account-ref",
        estimatedAmountMinor: 250,
        currency: "USD",
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-31T23:59:59.999Z",
        confidence: "medium",
        collectedAt: NOW.toISOString(),
      }],
    },
    alerts: [],
  };
}

function failedCollection(): CollectedProviderSnapshots {
  return {
    ...successfulCollection(),
    status: "error",
    errors: ["sk-fake-secret provider payload failed at C:/private/path"],
  };
}
