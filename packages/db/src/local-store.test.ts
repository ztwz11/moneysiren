import { mkdtemp, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  initializeLocalStore,
  recordLocalReportRun,
  readLocalStore,
  saveLocalProviderCollection,
} from "./local-store.js";
import type { LocalBillingSnapshotInput, LocalCostEstimateInput } from "./local-store.js";
import { REQUIRED_TABLES } from "./schema.js";
import { resolveSqliteBin, SQLITE_BIN_ENV_KEY } from "./sqlite-bin.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const requireNodeModule = createRequire(import.meta.url);

describe("local SQLite store", () => {
  it("resolves a configurable SQLite CLI path for Windows installs", () => {
    expect(resolveSqliteBin({ [SQLITE_BIN_ENV_KEY]: "  C:\\tools\\sqlite3.exe  " })).toBe("C:\\tools\\sqlite3.exe");
  });

  it("initializes a SQL-migration-backed local store without creating .env", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "stackspend-db-"));
    const dbPath = join(rootDir, ".stackspend", "stackspend.sqlite");

    const result = await initializeLocalStore({ dbPath });
    const tables = querySqlite<{ name: string }>(
      dbPath,
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;",
    ).map((row) => row.name);
    const migrations = querySqlite<{ id: string }>(dbPath, "SELECT id FROM schema_migrations ORDER BY id;");

    expect(result.appliedMigrationIds).toEqual(["0001_init", "0002_read_model_indexes"]);
    expect(result.skippedMigrationIds).toEqual([]);
    expect(await fileExists(dbPath)).toBe(true);
    expect(tables).toEqual(expect.arrayContaining(["schema_migrations", ...REQUIRED_TABLES]));
    expect(migrations).toEqual([{ id: "0001_init" }, { id: "0002_read_model_indexes" }]);
    expect(await fileExists(join(rootDir, ".env"))).toBe(false);
  });

  it("persists normalized mock snapshots and report_runs without raw payload fields", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "stackspend-db-"));
    const dbPath = join(rootDir, ".stackspend", "stackspend.sqlite");

    await initializeLocalStore({ dbPath });
    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0-alpha.0",
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

  it("clears stale provider-sync alerts after a successful provider collection", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "stackspend-db-"));
    const dbPath = join(rootDir, ".stackspend", "stackspend.sqlite");
    const provider = {
      key: "mock",
      displayName: "Mock Provider",
      connectorVersion: "0.1.0-alpha.0",
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

  it("does not inflate the read model when the same cost estimate is collected twice", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "stackspend-db-"));
    const dbPath = join(rootDir, ".stackspend", "stackspend.sqlite");
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
        connectorVersion: "0.1.0-alpha.0",
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
        connectorVersion: "0.1.0-alpha.0",
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
    const rootDir = await mkdtemp(join(tmpdir(), "stackspend-db-"));
    const dbPath = join(rootDir, ".stackspend", "stackspend.sqlite");
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
        connectorVersion: "0.1.0-alpha.0",
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
        connectorVersion: "0.1.0-alpha.0",
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
  prepare(sql: string): {
    all(): unknown[];
  };
  close(): void;
}

type SqliteValueRow = Record<string, string | number | null>;
