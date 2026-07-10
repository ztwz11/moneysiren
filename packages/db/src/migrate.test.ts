import { describe, expect, it } from "vitest";
import {
  EMERGENCY_ACTION_RUNS_SQL,
  INITIAL_SCHEMA_SQL,
  PROVIDER_SYNC_RUNS_SQL,
  READ_MODEL_INDEX_SQL,
  REQUIRED_TABLES,
} from "./schema.js";
import { getPendingMigrations, runMigrations } from "./migrate.js";

describe("initial SQLite schema", () => {
  it("declares the required v0.1 tables without raw provider payload storage", () => {
    for (const tableName of REQUIRED_TABLES.filter(
      (tableName) => !["emergency_action_runs", "provider_sync_runs"].includes(tableName),
    )) {
      expect(INITIAL_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
    }

    expect(INITIAL_SCHEMA_SQL).not.toMatch(/\braw_?payload\b/i);
    expect(INITIAL_SCHEMA_SQL).not.toMatch(/\braw_?response\b/i);
    expect(INITIAL_SCHEMA_SQL).not.toMatch(/\bbilling_profile\b/i);
  });

  it("declares read-model indexes for latest logical snapshot reads", () => {
    expect(READ_MODEL_INDEX_SQL).toContain("idx_billing_snapshots_latest_logical");
    expect(READ_MODEL_INDEX_SQL).toContain("idx_cost_estimates_latest_logical");
  });

  it("declares sanitized provider sync-run storage separately", () => {
    expect(PROVIDER_SYNC_RUNS_SQL).toContain("CREATE TABLE IF NOT EXISTS provider_sync_runs");
    expect(PROVIDER_SYNC_RUNS_SQL).toContain("status TEXT NOT NULL CHECK (status IN (\'ok\', \'partial\', \'error\'))");
    expect(PROVIDER_SYNC_RUNS_SQL).toContain("usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0)");
    expect(PROVIDER_SYNC_RUNS_SQL).toContain("alert_count INTEGER NOT NULL DEFAULT 0 CHECK (alert_count >= 0)");
    expect(PROVIDER_SYNC_RUNS_SQL).toContain("error_code TEXT");
    expect(PROVIDER_SYNC_RUNS_SQL).toContain("data_through TEXT");
    expect(PROVIDER_SYNC_RUNS_SQL).not.toMatch(/\braw_?payload\b/i);
    expect(PROVIDER_SYNC_RUNS_SQL).not.toMatch(/\braw_?response\b/i);
  });

  it("declares sanitized emergency action audit storage separately", () => {
    expect(EMERGENCY_ACTION_RUNS_SQL).toContain("CREATE TABLE IF NOT EXISTS emergency_action_runs");
    expect(EMERGENCY_ACTION_RUNS_SQL).toContain("mode TEXT NOT NULL CHECK (mode IN ('requirements_only', 'manual', 'dry_run'))");
    expect(EMERGENCY_ACTION_RUNS_SQL).toContain("executed_at TEXT CHECK (executed_at IS NULL)");
    expect(EMERGENCY_ACTION_RUNS_SQL).toContain("status TEXT NOT NULL CHECK (status IN ('viewed', 'dry_run', 'blocked', 'error'))");
    expect(EMERGENCY_ACTION_RUNS_SQL).toContain("local_only INTEGER NOT NULL DEFAULT 1 CHECK (local_only = 1)");
    expect(EMERGENCY_ACTION_RUNS_SQL).toContain("secrets_returned INTEGER NOT NULL DEFAULT 0");
    expect(EMERGENCY_ACTION_RUNS_SQL).toContain("secrets_returned INTEGER NOT NULL DEFAULT 0 CHECK (secrets_returned = 0)");
    expect(EMERGENCY_ACTION_RUNS_SQL).not.toMatch(/\braw_?payload\b/i);
    expect(EMERGENCY_ACTION_RUNS_SQL).not.toMatch(/\braw_?response\b/i);
  });
});

describe("migration runner", () => {
  it("returns only unapplied migrations in order", () => {
    expect(getPendingMigrations([]).map((migration) => migration.id)).toEqual([
      "0001_init",
      "0002_read_model_indexes",
      "0003_emergency_action_runs",
      "0004_provider_sync_runs",
    ]);
    expect(getPendingMigrations(["0001_init"]).map((migration) => migration.id)).toEqual([
      "0002_read_model_indexes",
      "0003_emergency_action_runs",
      "0004_provider_sync_runs",
    ]);
    expect(getPendingMigrations(["0001_init", "0002_read_model_indexes"]).map((migration) => migration.id)).toEqual([
      "0003_emergency_action_runs",
      "0004_provider_sync_runs",
    ]);
    expect(getPendingMigrations([
      "0001_init",
      "0002_read_model_indexes",
      "0003_emergency_action_runs",
    ]).map((migration) => migration.id)).toEqual(["0004_provider_sync_runs"]);
  });

  it("runs pending migrations once and skips already-applied migrations", async () => {
    const executedSql: string[] = [];
    const recordedIds: string[] = [];

    await runMigrations({
      async getAppliedMigrationIds() {
        return recordedIds;
      },
      async execute(sql) {
        executedSql.push(sql);
      },
      async recordMigration(id) {
        recordedIds.push(id);
      },
    });

    expect(executedSql).toHaveLength(4);
    expect(executedSql[0]).toContain("CREATE TABLE IF NOT EXISTS providers");
    expect(executedSql[1]).toContain("idx_billing_snapshots_latest_logical");
    expect(executedSql[2]).toContain("CREATE TABLE IF NOT EXISTS emergency_action_runs");
    expect(executedSql[3]).toContain("CREATE TABLE IF NOT EXISTS provider_sync_runs");
    expect(recordedIds).toEqual([
      "0001_init",
      "0002_read_model_indexes",
      "0003_emergency_action_runs",
      "0004_provider_sync_runs",
    ]);

    executedSql.length = 0;

    await runMigrations({
      async getAppliedMigrationIds() {
        return recordedIds;
      },
      async execute(sql) {
        executedSql.push(sql);
      },
      async recordMigration(id) {
        recordedIds.push(id);
      },
    });

    expect(executedSql).toEqual([]);
    expect(recordedIds).toEqual([
      "0001_init",
      "0002_read_model_indexes",
      "0003_emergency_action_runs",
      "0004_provider_sync_runs",
    ]);
  });
});
