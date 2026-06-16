import { runMigrations, type MigrationExecutor, type MigrationRunResult } from "./migrate.js";

export interface MoneySirenDbClient {
  dbPath: string;
  migrate(): Promise<MigrationRunResult>;
}

export interface MoneySirenDbClientOptions {
  dbPath: string;
  executor: MigrationExecutor;
}

export function createMoneySirenDbClient(options: MoneySirenDbClientOptions): MoneySirenDbClient {
  const dbPath = options.dbPath.trim();

  if (dbPath.length === 0) {
    throw new Error("dbPath must not be blank.");
  }

  return {
    dbPath,
    migrate() {
      return runMigrations(options.executor);
    },
  };
}
