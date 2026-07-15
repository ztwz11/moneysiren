import {
  EMERGENCY_ACTION_RUNS_SQL,
  INITIAL_SCHEMA_SQL,
  LOCAL_AI_USAGE_DAILY_SQL,
  READ_MODEL_INDEX_SQL,
} from "./schema.js";

export interface Migration {
  id: string;
  sql: string;
}

export interface MigrationExecutor {
  getAppliedMigrationIds(): Promise<readonly string[]>;
  execute(sql: string): Promise<void>;
  recordMigration(id: string): Promise<void>;
}

export interface MigrationRunResult {
  appliedMigrationIds: readonly string[];
  skippedMigrationIds: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: "0001_init",
    sql: INITIAL_SCHEMA_SQL,
  },
  {
    id: "0002_read_model_indexes",
    sql: READ_MODEL_INDEX_SQL,
  },
  {
    id: "0003_emergency_action_runs",
    sql: EMERGENCY_ACTION_RUNS_SQL,
  },
  {
    id: "0004_local_ai_usage_daily",
    sql: LOCAL_AI_USAGE_DAILY_SQL,
  },
];

export function getPendingMigrations(
  appliedMigrationIds: readonly string[],
  migrations: readonly Migration[] = MIGRATIONS,
): readonly Migration[] {
  const applied = new Set(appliedMigrationIds);
  return migrations.filter((migration) => !applied.has(migration.id));
}

export async function runMigrations(
  executor: MigrationExecutor,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<MigrationRunResult> {
  const appliedMigrationIds = await executor.getAppliedMigrationIds();
  const applied = new Set(appliedMigrationIds);
  const pendingMigrations = getPendingMigrations(appliedMigrationIds, migrations);
  const newlyAppliedMigrationIds: string[] = [];

  for (const migration of pendingMigrations) {
    await executor.execute(migration.sql);
    await executor.recordMigration(migration.id);
    newlyAppliedMigrationIds.push(migration.id);
    applied.add(migration.id);
  }

  return {
    appliedMigrationIds: newlyAppliedMigrationIds,
    skippedMigrationIds: migrations
      .filter((migration) => !newlyAppliedMigrationIds.includes(migration.id))
      .filter((migration) => applied.has(migration.id))
      .map((migration) => migration.id),
  };
}
