import { mkdtemp, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  initializeLocalStore,
  recordEmergencyActionRun,
  recordLocalProviderSyncRun,
  recordLocalReportRun,
  readLocalStore,
  saveLocalProviderCollection,
} from "./local-store.js";
import type { LocalBillingSnapshotInput, LocalCostEstimateInput, LocalEmergencyActionRunInput } from "./local-store.js";
import { INITIAL_SCHEMA_SQL, READ_MODEL_INDEX_SQL, REQUIRED_TABLES } from "./schema.js";
import { resolveSqliteBin, SQLITE_BIN_ENV_KEY } from "./sqlite-bin.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const requireNodeModule = createRequire(import.meta.url);

describe("local SQLite store", () => {
  it("resolves a configurable SQLite CLI path for Windows installs", () => {
    expect(resolveSqliteBin({ [SQLITE_BIN_ENV_KEY]: "  C:\\tools\\sqlite3.exe  " })).toBe("C:\\tools\\sqlite3.exe");
  });

  it("initializes a SQL-migration-backed local store without creating .env", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");

    const result = await initializeLocalStore({ dbPath });
    const tables = querySqlite<{ name: string }>(
      dbPath,
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;",
    ).map((row) => row.name);
    const migrations = querySqlite<{ id: string }>(dbPath, "SELECT id FROM schema_migrations ORDER BY id;");

    expect(result.appliedMigrationIds).toEqual([
      "0001_init",
      "0002_read_model_indexes",
      "0003_emergency_action_runs",
      "0004_provider_sync_runs",
    ]);
    expect(result.skippedMigrationIds).toEqual([]);
    expect(await fileExists(dbPath)).toBe(true);
    expect(tables).toEqual(expect.arrayContaining(["schema_migrations", ...REQUIRED_TABLES]));
    expect(migrations).toEqual([
      { id: "0001_init" },
      { id: "0002_read_model_indexes" },
      { id: "0003_emergency_action_runs" },
      { id: "0004_provider_sync_runs" },
    ]);
    expect(await fileExists(join(rootDir, ".env"))).toBe(false);
  });

  it("reads legacy local stores without emergency audit storage as empty audit runs", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, "legacy.sqlite");

    executeSqlite(dbPath, INITIAL_SCHEMA_SQL);
    executeSqlite(dbPath, READ_MODEL_INDEX_SQL);
    executeSqlite(
      dbPath,
      "INSERT INTO schema_migrations (id) VALUES ('0001_init'), ('0002_read_model_indexes');",
    );

    const store = await readLocalStore({ dbPath });

    expect(store.appliedMigrationIds).toEqual(["0001_init", "0002_read_model_indexes"]);
    expect(store.emergencyActionRuns).toEqual([]);
    expect(store.providerSyncRuns).toEqual([]);
  });

  it("persists normalized mock snapshots and report_runs without raw payload fields", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");

    await initializeLocalStore({ dbPath });
    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0",
      },
      collectedAt: FIXED_NOW,
      status: "ok",
      snapshots: {
        usage: [
          {
            provider: "mock",
            collectedAt: FIXED_NOW,
            service: "mock-api",
            metric: "requests",
            unit: "count",
            value: 1200,
          },
        ],
        billing: [],
        serviceHealth: [],
        costEstimates: [],
      },
      alerts: [],
    });

    await recordLocalReportRun({
      dbPath,
      createdAt: "2026-06-02T09:05:00.000Z",
      reportDate: "2026-06-02",
      language: "ko",
      deliveryTarget: "stdout",
      status: "rendered",
    });

    const providerRows = querySqlite<{ provider_key: string; display_name: string }>(
      dbPath,
      "SELECT provider_key, display_name FROM providers ORDER BY provider_key;",
    );
    const usageRows = querySqlite<{ service: string; metric: string; unit: string; value: number; metadata_json: string }>(
      dbPath,
      "SELECT service, metric, unit, value, metadata_json FROM usage_snapshots;",
    );
    const reportRuns = querySqlite<{
      report_date: string;
      language: string;
      delivery_target: string;
      status: string;
      metadata_json: string;
    }>(dbPath, "SELECT report_date, language, delivery_target, status, metadata_json FROM report_runs;");
    const persistedText = dumpPersistedProviderDataText(dbPath);

    expect(providerRows).toEqual([{ provider_key: "mock", display_name: "Mock Provider" }]);
    expect(usageRows).toEqual([
      {
        service: "mock-api",
        metric: "requests",
        unit: "count",
        value: 1200,
        metadata_json: "{}",
      },
    ]);
    expect(reportRuns).toEqual([
      {
        report_date: "2026-06-02",
        language: "ko",
        delivery_target: "stdout",
        status: "rendered",
        metadata_json: "{}",
      },
    ]);
    expect(
      querySqlite<{ count: number }>(dbPath, "SELECT count(*) AS count FROM billing_snapshots;")[0]?.count,
    ).toBe(0);
    expect(persistedText).not.toContain("sqlite-placeholder-v1");
    expect(persistedText).not.toMatch(/rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i);
  });

  it("records a first partial attempt without usable snapshots as an error", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");

    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0",
      },
      collectedAt: FIXED_NOW,
      status: "partial",
      snapshots: {
        usage: [],
        billing: [],
        serviceHealth: [],
        costEstimates: [],
      },
      alerts: [],
    });

    expect((await readLocalStore({ dbPath })).providerSyncRuns).toEqual([
      expect.objectContaining({
        providerKey: "mock",
        attemptedAt: FIXED_NOW,
        status: "error",
        snapshotCount: 0,
        errorCode: "SYNC_NO_USABLE_DATA",
        sanitizedMessage: "Provider sync returned no usable data.",
      }),
    ]);
  });

  it("persists sanitized sync-run history and retains the prior successful data timestamp", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");

    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0",
      },
      collectedAt: FIXED_NOW,
      status: "ok",
      snapshots: {
        usage: [
          {
            provider: "mock",
            collectedAt: FIXED_NOW,
            service: "mock-api",
            metric: "requests",
            unit: "count",
            value: 1200,
          },
        ],
        billing: [],
        serviceHealth: [],
        costEstimates: [],
      },
      alerts: [],
    });

    await recordLocalProviderSyncRun({
      dbPath,
      providerKey: "mock",
      attemptedAt: "2026-06-02T09:10:00.000Z",
      completedAt: "2026-06-02T09:10:01.000Z",
      status: "error",
      usageCount: 0,
      billingCount: 0,
      healthCount: 0,
      estimateCount: 0,
      alertCount: 1,
      errorCode: "SYNC_EXECUTION",
    });

    const store = await readLocalStore({ dbPath });

    expect(store.providerSyncRuns).toEqual([
      expect.objectContaining({
        providerKey: "mock",
        attemptedAt: FIXED_NOW,
        completedAt: FIXED_NOW,
        status: "ok",
        snapshotCount: 1,
        usageCount: 1,
        alertCount: 0,
        dataThrough: FIXED_NOW,
      }),
      expect.objectContaining({
        providerKey: "mock",
        attemptedAt: "2026-06-02T09:10:00.000Z",
        completedAt: "2026-06-02T09:10:01.000Z",
        status: "error",
        snapshotCount: 0,
        alertCount: 1,
        errorCode: "SYNC_EXECUTION",
        sanitizedMessage: "Provider sync could not be completed.",
      }),
    ]);
    expect(store.providerSyncRuns[1]).not.toHaveProperty("dataThrough");
    expect(dumpPersistedProviderDataText(dbPath)).not.toMatch(
      /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i,
    );

    await expect(recordLocalProviderSyncRun({
      dbPath,
      providerKey: "mock",
      attemptedAt: "2026-06-02T09:20:00.000Z",
      status: "ok",
      usageCount: -1,
      billingCount: 0,
      healthCount: 0,
      estimateCount: 0,
      alertCount: 0,
    })).rejects.toThrow("non-negative safe integers");

    await expect(recordLocalProviderSyncRun({
      dbPath,
      providerKey: "acct_private_identifier",
      attemptedAt: "2026-06-02T09:20:00.000Z",
      status: "error",
      usageCount: 0,
      billingCount: 0,
      healthCount: 0,
      estimateCount: 0,
      alertCount: 0,
      errorCode: "SYNC_EXECUTION",
    })).rejects.toThrow("Sensitive provider value");
  });

  it("clears stale provider-sync alerts after a successful provider collection", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");
    const provider = {
      key: "mock",
      displayName: "Mock Provider",
      connectorVersion: "0.1.0",
    };

    await saveLocalProviderCollection({
      dbPath,
      provider,
      collectedAt: FIXED_NOW,
      status: "error",
      snapshots: {
        usage: [],
        billing: [],
        serviceHealth: [],
        costEstimates: [],
      },
      alerts: [
        {
          provider: "mock",
          createdAt: FIXED_NOW,
          severity: "warning",
          category: "provider-sync",
          title: "Mock sync failed",
          message: "Mock connector failed before snapshots were collected.",
        },
      ],
    });
    expect((await readLocalStore({ dbPath })).alerts).toHaveLength(1);

    await saveLocalProviderCollection({
      dbPath,
      provider,
      collectedAt: "2026-06-02T09:10:00.000Z",
      status: "ok",
      snapshots: {
        usage: [
          {
            provider: "mock",
            collectedAt: "2026-06-02T09:10:00.000Z",
            service: "mock-api",
            metric: "requests",
            unit: "count",
            value: 1,
          },
        ],
        billing: [],
        serviceHealth: [],
        costEstimates: [],
      },
      alerts: [],
    });

    expect((await readLocalStore({ dbPath })).alerts).toEqual([]);
  });

  it("persists sanitized emergency action audit runs only", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");

    await recordEmergencyActionRun({
      dbPath,
      providerKey: "aws",
      actionKey: "future_write_requirements",
      mode: "dry_run",
      readiness: "missing_emergency_credential",
      requestedAt: FIXED_NOW,
      status: "dry_run",
      reasonCode: "provider_write_disabled",
      targetLabelRedacted: "redacted-target",
      targetHash: "sha256:abc123",
      resultSummary: "Dry-run blocked until emergency credential requirements are met.",
      localOnly: true,
      secretsReturned: false,
    });

    const store = await readLocalStore({ dbPath });

    expect(store.emergencyActionRuns).toEqual([
      expect.objectContaining({
        providerKey: "aws",
        actionKey: "future_write_requirements",
        mode: "dry_run",
        readiness: "missing_emergency_credential",
        status: "dry_run",
        targetLabelRedacted: "redacted-target",
        targetHash: "sha256:abc123",
        localOnly: true,
        secretsReturned: false,
      }),
    ]);
    expect(dumpPersistedProviderDataText(dbPath)).not.toMatch(/rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i);

    await expect(recordEmergencyActionRun({
      dbPath,
      providerKey: "aws",
      actionKey: "future_write_requirements",
      mode: "dry_run",
      readiness: "missing_emergency_credential",
      requestedAt: FIXED_NOW,
      status: "blocked",
      reasonCode: "unsafe_target",
      targetLabelRedacted: "acct_fake_emergency_test",
      resultSummary: "Rejected unsafe target label.",
      localOnly: true,
      secretsReturned: false,
    })).rejects.toThrow("Sensitive provider value");

    await expect(recordEmergencyActionRun({
      dbPath,
      providerKey: "aws",
      actionKey: "future_write_requirements",
      mode: "execute",
      readiness: "requires_confirmation",
      requestedAt: FIXED_NOW,
      executedAt: FIXED_NOW,
      status: "executed",
      reasonCode: "unsafe_execute",
      resultSummary: "Rejected provider write execution.",
      localOnly: true,
      secretsReturned: false,
    } as unknown as LocalEmergencyActionRunInput)).rejects.toThrow("disabled in this build");
  });

  it("enforces current-release emergency action storage constraints in SQLite", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");

    await initializeLocalStore({ dbPath });

    expect(() => executeSqlite(dbPath, emergencyActionInsertSql({
      executedAt: FIXED_NOW,
      localOnly: 1,
      mode: "dry_run",
      secretsReturned: 0,
      status: "dry_run",
    }))).toThrow();
    expect(() => executeSqlite(dbPath, emergencyActionInsertSql({
      executedAt: null,
      localOnly: 1,
      mode: "execute",
      secretsReturned: 0,
      status: "dry_run",
    }))).toThrow();
    expect(() => executeSqlite(dbPath, emergencyActionInsertSql({
      executedAt: null,
      localOnly: 1,
      mode: "dry_run",
      secretsReturned: 0,
      status: "executed",
    }))).toThrow();
    expect(() => executeSqlite(dbPath, emergencyActionInsertSql({
      executedAt: null,
      localOnly: 0,
      mode: "dry_run",
      secretsReturned: 0,
      status: "dry_run",
    }))).toThrow();
    expect(() => executeSqlite(dbPath, emergencyActionInsertSql({
      executedAt: null,
      localOnly: 1,
      mode: "dry_run",
      secretsReturned: 1,
      status: "dry_run",
    }))).toThrow();
  });

  it("does not inflate the read model when the same cost estimate is collected twice", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");
    const costEstimate: LocalCostEstimateInput = {
      provider: "mock",
      collectedAt: FIXED_NOW,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      estimatedAmountMinor: 1500,
      currency: "USD",
      confidence: "medium",
      providerAccountRef: "test-account-one",
    };

    const snapshots = {
      usage: [],
      billing: [],
      serviceHealth: [],
      costEstimates: [costEstimate],
    };

    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0",
      },
      collectedAt: FIXED_NOW,
      status: "ok",
      snapshots,
      alerts: [],
    });
    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0",
      },
      collectedAt: "2026-06-02T09:10:00.000Z",
      status: "ok",
      snapshots: {
        ...snapshots,
        costEstimates: [
          {
            ...costEstimate,
            collectedAt: "2026-06-02T09:10:00.000Z",
          },
        ],
      },
      alerts: [],
    });

    const store = await readLocalStore({ dbPath });
    const persistedCostEstimateCount = querySqlite<{ count: number }>(
      dbPath,
      "SELECT count(*) AS count FROM cost_estimates;",
    )[0]?.count;

    expect(persistedCostEstimateCount).toBe(2);
    expect(store.costEstimates).toEqual([
      expect.objectContaining({
        providerKey: "mock",
        collectedAt: "2026-06-02T09:10:00.000Z",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        estimatedAmountMinor: 1500,
        currency: "USD",
        confidence: "medium",
      }),
    ]);
    expect(store.costEstimates.reduce((total, estimate) => total + estimate.estimatedAmountMinor, 0)).toBe(1500);
  });

  it("does not inflate the read model when the same billing snapshot is collected twice", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");
    const billingSnapshot: LocalBillingSnapshotInput = {
      provider: "mock",
      collectedAt: FIXED_NOW,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      amountMinor: 900,
      currency: "USD",
      status: "confirmed",
      providerAccountRef: "test-account-one",
    };

    const snapshots = {
      usage: [],
      billing: [billingSnapshot],
      serviceHealth: [],
      costEstimates: [],
    };

    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0",
      },
      collectedAt: FIXED_NOW,
      status: "ok",
      snapshots,
      alerts: [],
    });
    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0",
      },
      collectedAt: "2026-06-02T09:10:00.000Z",
      status: "ok",
      snapshots: {
        ...snapshots,
        billing: [
          {
            ...billingSnapshot,
            collectedAt: "2026-06-02T09:10:00.000Z",
          },
        ],
      },
      alerts: [],
    });

    const store = await readLocalStore({ dbPath });
    const persistedBillingSnapshotCount = querySqlite<{ count: number }>(
      dbPath,
      "SELECT count(*) AS count FROM billing_snapshots;",
    )[0]?.count;

    expect(persistedBillingSnapshotCount).toBe(2);
    expect(store.billingSnapshots).toEqual([
      expect.objectContaining({
        providerKey: "mock",
        collectedAt: "2026-06-02T09:10:00.000Z",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        amountMinor: 900,
        currency: "USD",
        status: "confirmed",
      }),
    ]);
    expect(store.billingSnapshots.reduce((total, snapshot) => total + snapshot.amountMinor, 0)).toBe(900);
  });
});

function querySqlite<T>(dbPath: string, sql: string): T[] {
  const nodeSqlite = requireNodeModule("node:sqlite") as {
    DatabaseSync: new (path: string) => NodeSqliteDatabase;
  };
  const database = new nodeSqlite.DatabaseSync(dbPath);

  try {
    return database.prepare(sql).all() as T[];
  } finally {
    database.close();
  }
}

function executeSqlite(dbPath: string, sql: string): void {
  const nodeSqlite = requireNodeModule("node:sqlite") as {
    DatabaseSync: new (path: string) => NodeSqliteDatabase;
  };
  const database = new nodeSqlite.DatabaseSync(dbPath);

  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

function emergencyActionInsertSql(input: {
  executedAt: string | null;
  localOnly: 0 | 1;
  mode: string;
  secretsReturned: 0 | 1;
  status: string;
}): string {
  return `
    INSERT INTO emergency_action_runs (
      id, provider_key, action_key, mode, readiness, requested_at, confirmed_at, executed_at, status,
      reason_code, target_label_redacted, target_hash, result_summary, error_code, local_only, secrets_returned,
      metadata_json
    )
    VALUES (
      'test-${input.mode}-${input.status}-${input.localOnly}-${input.secretsReturned}-${input.executedAt === null ? "null" : "executed"}',
      'aws',
      'future_write_requirements',
      '${input.mode}',
      'missing_emergency_credential',
      '${FIXED_NOW}',
      NULL,
      ${input.executedAt === null ? "NULL" : `'${input.executedAt}'`},
      '${input.status}',
      'constraint_test',
      'redacted-target',
      NULL,
      'Constraint test.',
      NULL,
      ${input.localOnly},
      ${input.secretsReturned},
      '{}'
    );
  `;
}

function dumpPersistedProviderDataText(dbPath: string): string {
  const rows: SqliteValueRow[] = [
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT provider_key, display_name, connector_version FROM providers ORDER BY provider_key;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT account_label, account_ref FROM provider_accounts ORDER BY account_label, account_ref;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT service, metric, unit, metadata_json FROM usage_snapshots ORDER BY service, metric, unit;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT currency, status, metadata_json FROM billing_snapshots ORDER BY currency, status;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT service, region, status, message, metadata_json FROM service_health_snapshots ORDER BY service, status;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT currency, confidence, metadata_json FROM cost_estimates ORDER BY currency, confidence;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT severity, category, title, message, metadata_json FROM alerts ORDER BY severity, category, title;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT language, delivery_target, status, metadata_json FROM report_runs ORDER BY language, delivery_target, status;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT provider_key, action_key, mode, readiness, status, reason_code, target_label_redacted, target_hash, result_summary, metadata_json FROM emergency_action_runs ORDER BY requested_at, id;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT provider_key, attempted_at, completed_at, status, usage_count, billing_count, health_count, estimate_count, alert_count, error_code, error_message, data_through, metadata_json FROM provider_sync_runs ORDER BY attempted_at, id;",
    ),
  ];

  return rows
    .flatMap((row) => Object.values(row).filter((value): value is string => typeof value === "string"))
    .join("\n");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

interface NodeSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    all(): unknown[];
  };
  close(): void;
}

type SqliteValueRow = Record<string, string | number | null>;
