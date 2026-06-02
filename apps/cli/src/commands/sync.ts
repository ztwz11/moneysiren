import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { collectProviderSnapshots } from "../../../../packages/core/src/index.js";
import {
  createAwsCostExplorerConnector,
  createStaticCostExplorerClient,
  type AwsCostExplorerGetCostAndUsageOutput,
} from "../../../../packages/connectors/aws/src/index.js";
import { createMockProviderConnector } from "../../../../packages/connectors/mock/src/index.js";
import { initializeLocalStore, saveLocalProviderCollection } from "../../../../packages/db/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { loadCliConfig, readFlag, resolveDbPath } from "./shared.js";

const AWS_COST_EXPLORER_FIXTURE_ENV_KEY = "STACKSPEND_AWS_COST_EXPLORER_FIXTURE";
const SYNC_USAGE = "Usage: stackspend sync --provider <mock|aws>";

export async function runSyncCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const providerFlag = readFlag(args, "--provider");

  if (
    providerFlag.remainingArgs.length > 0 ||
    providerFlag.value === undefined ||
    !isSupportedSyncProvider(providerFlag.value)
  ) {
    context.stderr(SYNC_USAGE);
    return 1;
  }

  const config = loadCliConfig(context.env);

  if (providerFlag.value === "aws") {
    const fixturePath = readConfiguredEnvValue(context.env[AWS_COST_EXPLORER_FIXTURE_ENV_KEY]);

    if (fixturePath === undefined && !config.providers.aws.configured) {
      context.stderr(
        `AWS sync requires AWS_PROFILE or ${AWS_COST_EXPLORER_FIXTURE_ENV_KEY}. ` +
          `Set ${AWS_COST_EXPLORER_FIXTURE_ENV_KEY} for fixture mode.`,
      );
      return 1;
    }

    if (fixturePath === undefined) {
      context.stderr(
        `AWS live Cost Explorer sync is not enabled in this fixture-only M4 CLI path. ` +
          `Set ${AWS_COST_EXPLORER_FIXTURE_ENV_KEY} to a fake Cost Explorer fixture file.`,
      );
      return 1;
    }

    return syncAwsProvider(context, config.dbPath, fixturePath);
  }

  return syncMockProvider(context, config.dbPath);
}

type SupportedSyncProvider = "mock" | "aws";

function isSupportedSyncProvider(provider: string): provider is SupportedSyncProvider {
  return provider === "mock" || provider === "aws";
}

async function syncMockProvider(context: CliExecutionContext, configuredDbPath: string): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createMockProviderConnector();
  const collection = await collectProviderSnapshots(connector, {
    now: context.now,
  });

  await saveLocalProviderCollection({
    dbPath,
    provider: {
      key: connector.kind,
      displayName: connector.displayName,
      connectorVersion: "0.1.0-alpha.0",
    },
    collectedAt: collection.collectedAt,
    status: collection.status,
    snapshots: collection.snapshots,
    alerts: collection.alerts,
  });

  context.stdout(
    [
      "Synced mock provider snapshots:",
      `usage=${collection.snapshots.usage.length}`,
      `billing=${collection.snapshots.billing.length}`,
      `health=${collection.snapshots.serviceHealth.length}`,
      `estimates=${collection.snapshots.costEstimates.length}`,
      `alerts=${collection.alerts.length}`,
    ].join(" "),
  );

  return 0;
}

async function syncAwsProvider(
  context: CliExecutionContext,
  configuredDbPath: string,
  fixturePath: string,
): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createAwsCostExplorerConnector({
    costExplorerClient: createStaticCostExplorerClient(await loadAwsFixture(context.cwd, fixturePath)),
  });
  const collection = await collectProviderSnapshots(connector, {
    now: context.now,
  });

  await saveLocalProviderCollection({
    dbPath,
    provider: {
      key: connector.kind,
      displayName: connector.displayName,
      connectorVersion: "0.1.0-alpha.0",
    },
    collectedAt: collection.collectedAt,
    status: collection.status,
    snapshots: collection.snapshots,
    alerts: collection.alerts,
  });

  context.stdout(
    [
      "Synced AWS Cost Explorer snapshots:",
      `usage=${collection.snapshots.usage.length}`,
      `billing=${collection.snapshots.billing.length}`,
      `health=${collection.snapshots.serviceHealth.length}`,
      `estimates=${collection.snapshots.costEstimates.length}`,
      `alerts=${collection.alerts.length}`,
    ].join(" "),
  );

  return 0;
}

async function loadAwsFixture(cwd: string, fixturePath: string): Promise<AwsCostExplorerGetCostAndUsageOutput> {
  const resolvedPath = isAbsolute(fixturePath) ? fixturePath : join(cwd, fixturePath);

  return JSON.parse(await readFile(resolvedPath, "utf8")) as AwsCostExplorerGetCostAndUsageOutput;
}

function readConfiguredEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}
