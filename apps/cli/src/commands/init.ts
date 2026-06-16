import { initializeLocalStore } from "../../../../packages/db/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { loadCliConfig, resolveDbPath } from "./shared.js";

export async function runInitCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.length > 0) {
    context.stderr("Usage: moneysiren init");
    return 1;
  }

  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);
  const result = await initializeLocalStore({ dbPath });
  const migrationSummary =
    result.appliedMigrationIds.length > 0
      ? `applied migrations: ${result.appliedMigrationIds.join(", ")}`
      : `migrations already applied: ${result.skippedMigrationIds.join(", ")}`;

  context.stdout(`Initialized MoneySiren local storage at ${config.dbPath}`);
  context.stdout(migrationSummary);
  return 0;
}
