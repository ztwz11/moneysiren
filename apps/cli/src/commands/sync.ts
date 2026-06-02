import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { collectProviderSnapshots } from "../../../../packages/core/src/index.js";
import {
  createAwsCostExplorerConnector,
  createStaticCostExplorerClient,
  type AwsCostExplorerGetCostAndUsageOutput,
} from "../../../../packages/connectors/aws/src/index.js";
import { createMockProviderConnector } from "../../../../packages/connectors/mock/src/index.js";
import {
  createOpenAiUsageCostsConnector,
  createStaticOpenAiUsageCostsClient,
  type OpenAiCostsPage,
  type OpenAiUsageCostsPayload,
  type OpenAiUsagePage,
} from "../../../../packages/connectors/openai/src/index.js";
import {
  createStaticSupabaseUsageHealthClient,
  createSupabaseUsageHealthConnector,
  type SupabaseUsageHealthPayload,
} from "../../../../packages/connectors/supabase/src/index.js";
import {
  createCloudflareBillingUsageConnector,
  createStaticCloudflareBillingUsageClient,
  type CloudflareBillingUsagePayload,
} from "../../../../packages/connectors/cloudflare/src/index.js";
import { initializeLocalStore, saveLocalProviderCollection } from "../../../../packages/db/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { loadCliConfig, readFlag, resolveDbPath } from "./shared.js";

const AWS_COST_EXPLORER_FIXTURE_ENV_KEY = "STACKSPEND_AWS_COST_EXPLORER_FIXTURE";
const OPENAI_USAGE_FIXTURE_ENV_KEY = "STACKSPEND_OPENAI_USAGE_FIXTURE";
const OPENAI_COSTS_FIXTURE_ENV_KEY = "STACKSPEND_OPENAI_COSTS_FIXTURE";
const SUPABASE_FIXTURE_ENV_KEY = "STACKSPEND_SUPABASE_FIXTURE";
const CLOUDFLARE_FIXTURE_ENV_KEY = "STACKSPEND_CLOUDFLARE_FIXTURE";
const SYNC_USAGE = "Usage: stackspend sync --provider <mock|aws|openai|supabase|cloudflare>";

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

  if (providerFlag.value === "openai") {
    const usageFixturePath = readConfiguredEnvValue(context.env[OPENAI_USAGE_FIXTURE_ENV_KEY]);
    const costsFixturePath = readConfiguredEnvValue(context.env[OPENAI_COSTS_FIXTURE_ENV_KEY]);

    if (usageFixturePath === undefined && costsFixturePath === undefined && !config.providers.openai.configured) {
      context.stderr(
        `OpenAI sync requires OPENAI_ADMIN_KEY or fixture mode with ${OPENAI_USAGE_FIXTURE_ENV_KEY} ` +
          `and ${OPENAI_COSTS_FIXTURE_ENV_KEY}. Set fixture paths for the fixture-only M5 CLI path.`,
      );
      return 1;
    }

    if (usageFixturePath === undefined || costsFixturePath === undefined) {
      context.stderr(
        `OpenAI fixture sync requires both ${OPENAI_USAGE_FIXTURE_ENV_KEY} and ${OPENAI_COSTS_FIXTURE_ENV_KEY}. ` +
          `Live OpenAI Usage/Costs sync is not enabled in this fixture-only M5 CLI path.`,
      );
      return 1;
    }

    return syncOpenAiProvider(context, config.dbPath, usageFixturePath, costsFixturePath);
  }

  if (providerFlag.value === "supabase") {
    const fixturePath = readConfiguredEnvValue(context.env[SUPABASE_FIXTURE_ENV_KEY]);

    if (fixturePath === undefined && !config.providers.supabase.configured) {
      context.stderr(
        `Supabase sync requires SUPABASE_ACCESS_TOKEN or ${SUPABASE_FIXTURE_ENV_KEY}. ` +
          `Set ${SUPABASE_FIXTURE_ENV_KEY} for fixture mode.`,
      );
      return 1;
    }

    if (fixturePath === undefined) {
      context.stderr(
        `Supabase live Management API sync is not enabled in this fixture-only M6 CLI path. ` +
          `Set ${SUPABASE_FIXTURE_ENV_KEY} to a fake Supabase usage/health fixture file.`,
      );
      return 1;
    }

    return syncSupabaseProvider(context, config.dbPath, fixturePath);
  }

  if (providerFlag.value === "cloudflare") {
    const fixturePath = readConfiguredEnvValue(context.env[CLOUDFLARE_FIXTURE_ENV_KEY]);

    if (fixturePath === undefined && !config.providers.cloudflare.configured) {
      context.stderr(
        `Cloudflare sync requires CLOUDFLARE_API_TOKEN or ${CLOUDFLARE_FIXTURE_ENV_KEY}. ` +
          `Set ${CLOUDFLARE_FIXTURE_ENV_KEY} for fixture mode.`,
      );
      return 1;
    }

    if (fixturePath === undefined) {
      context.stderr(
        `Cloudflare live billing/usage sync is not enabled in this fixture-only M7 CLI path. ` +
          `Set ${CLOUDFLARE_FIXTURE_ENV_KEY} to a fake Cloudflare billing/usage fixture file.`,
      );
      return 1;
    }

    return syncCloudflareProvider(context, config.dbPath, fixturePath);
  }

  return syncMockProvider(context, config.dbPath);
}

type SupportedSyncProvider = "mock" | "aws" | "openai" | "supabase" | "cloudflare";

function isSupportedSyncProvider(provider: string): provider is SupportedSyncProvider {
  return provider === "mock" || provider === "aws" || provider === "openai" || provider === "supabase" ||
    provider === "cloudflare";
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

async function syncOpenAiProvider(
  context: CliExecutionContext,
  configuredDbPath: string,
  usageFixturePath: string,
  costsFixturePath: string,
): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createOpenAiUsageCostsConnector({
    client: createStaticOpenAiUsageCostsClient(
      await loadOpenAiUsageCostsFixture(context.cwd, usageFixturePath, costsFixturePath),
    ),
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
      "Synced OpenAI usage and costs snapshots:",
      `usage=${collection.snapshots.usage.length}`,
      `billing=${collection.snapshots.billing.length}`,
      `health=${collection.snapshots.serviceHealth.length}`,
      `estimates=${collection.snapshots.costEstimates.length}`,
      `alerts=${collection.alerts.length}`,
    ].join(" "),
  );

  return 0;
}

async function loadOpenAiUsageCostsFixture(
  cwd: string,
  usageFixturePath: string,
  costsFixturePath: string,
): Promise<OpenAiUsageCostsPayload> {
  const [usage, costs] = await Promise.all([
    loadOpenAiFixtureSection(cwd, usageFixturePath, "usage"),
    loadOpenAiFixtureSection(cwd, costsFixturePath, "costs"),
  ]);

  return {
    usage,
    costs,
  };
}

async function loadOpenAiFixtureSection<Section extends keyof OpenAiUsageCostsPayload>(
  cwd: string,
  fixturePath: string,
  section: Section,
): Promise<OpenAiUsageCostsPayload[Section]> {
  const resolvedPath = isAbsolute(fixturePath) ? fixturePath : join(cwd, fixturePath);
  const parsed = JSON.parse(await readFile(resolvedPath, "utf8")) as OpenAiUsageCostsPayload | OpenAiUsagePage | OpenAiCostsPage;

  if (isRecord(parsed) && section in parsed) {
    return parsed[section] as OpenAiUsageCostsPayload[Section];
  }

  return parsed as OpenAiUsageCostsPayload[Section];
}

async function syncSupabaseProvider(
  context: CliExecutionContext,
  configuredDbPath: string,
  fixturePath: string,
): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createSupabaseUsageHealthConnector({
    client: createStaticSupabaseUsageHealthClient(await loadSupabaseFixture(context.cwd, fixturePath)),
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
      "Synced Supabase usage and health snapshots:",
      `usage=${collection.snapshots.usage.length}`,
      `billing=${collection.snapshots.billing.length}`,
      `health=${collection.snapshots.serviceHealth.length}`,
      `estimates=${collection.snapshots.costEstimates.length}`,
      `alerts=${collection.alerts.length}`,
    ].join(" "),
  );

  return 0;
}

async function loadSupabaseFixture(cwd: string, fixturePath: string): Promise<SupabaseUsageHealthPayload> {
  const resolvedPath = isAbsolute(fixturePath) ? fixturePath : join(cwd, fixturePath);

  return JSON.parse(await readFile(resolvedPath, "utf8")) as SupabaseUsageHealthPayload;
}

async function syncCloudflareProvider(
  context: CliExecutionContext,
  configuredDbPath: string,
  fixturePath: string,
): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createCloudflareBillingUsageConnector({
    client: createStaticCloudflareBillingUsageClient(await loadCloudflareFixture(context.cwd, fixturePath)),
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
      "Synced Cloudflare billing and usage snapshots:",
      `usage=${collection.snapshots.usage.length}`,
      `billing=${collection.snapshots.billing.length}`,
      `health=${collection.snapshots.serviceHealth.length}`,
      `estimates=${collection.snapshots.costEstimates.length}`,
      `alerts=${collection.alerts.length}`,
    ].join(" "),
  );

  return 0;
}

async function loadCloudflareFixture(cwd: string, fixturePath: string): Promise<CloudflareBillingUsagePayload> {
  const resolvedPath = isAbsolute(fixturePath) ? fixturePath : join(cwd, fixturePath);

  return JSON.parse(await readFile(resolvedPath, "utf8")) as CloudflareBillingUsagePayload;
}

function readConfiguredEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}
