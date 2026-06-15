import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { collectProviderSnapshots } from "../../../../packages/core/src/index.js";
import {
  createAwsCostExplorerConnector,
  createAwsSdkCostExplorerClient,
  createStaticCostExplorerClient,
  type AwsCostExplorerClientAdapter,
  type AwsCostExplorerGetCostAndUsageOutput,
} from "../../../../packages/connectors/aws/src/index.js";
import { createMockProviderConnector } from "../../../../packages/connectors/mock/src/index.js";
import {
  createOpenAiUsageCostsClient,
  createOpenAiUsageCostsConnector,
  createStaticOpenAiUsageCostsClient,
  type OpenAiUsageCostsClient,
  type OpenAiCostsPage,
  type OpenAiUsageCostsPayload,
  type OpenAiUsagePage,
} from "../../../../packages/connectors/openai/src/index.js";
import {
  createSupabaseManagementClient,
  type SupabaseManagementClient,
  createStaticSupabaseUsageHealthClient,
  createSupabaseUsageHealthConnector,
  type SupabaseUsageHealthPayload,
} from "../../../../packages/connectors/supabase/src/index.js";
import {
  createCloudflareBillingUsageClient,
  createCloudflareBillingUsageConnector,
  createStaticCloudflareBillingUsageClient,
  type CloudflareBillingUsageClient,
  type CloudflareBillingUsagePayload,
} from "../../../../packages/connectors/cloudflare/src/index.js";
import { initializeLocalStore, saveLocalProviderCollection } from "../../../../packages/db/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { loadCliConfig, readFlag, resolveDbPath } from "./shared.js";

const AWS_COST_EXPLORER_FIXTURE_ENV_KEY = "STACKSPEND_AWS_COST_EXPLORER_FIXTURE";
const AWS_REGION_ENV_KEY = "STACKSPEND_AWS_REGION";
const OPENAI_USAGE_FIXTURE_ENV_KEY = "STACKSPEND_OPENAI_USAGE_FIXTURE";
const OPENAI_COSTS_FIXTURE_ENV_KEY = "STACKSPEND_OPENAI_COSTS_FIXTURE";
const SUPABASE_FIXTURE_ENV_KEY = "STACKSPEND_SUPABASE_FIXTURE";
const CLOUDFLARE_FIXTURE_ENV_KEY = "STACKSPEND_CLOUDFLARE_FIXTURE";
const CLOUDFLARE_ACCOUNT_IDS_ENV_KEY = "CLOUDFLARE_ACCOUNT_IDS";
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

    if (fixturePath !== undefined) {
      return syncAwsProvider(
        context,
        config.dbPath,
        createStaticCostExplorerClient(await loadAwsFixture(context.cwd, fixturePath)),
      );
    }

    if (!isAwsLiveConfigured(context.env) && context.liveClients?.awsCostExplorer === undefined) {
      context.stderr(
        `AWS sync requires AWS_PROFILE, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, or ${AWS_COST_EXPLORER_FIXTURE_ENV_KEY}. ` +
          `Set ${AWS_COST_EXPLORER_FIXTURE_ENV_KEY} for fixture mode.`,
      );
      return 1;
    }

    return syncAwsProvider(
      context,
      config.dbPath,
      context.liveClients?.awsCostExplorer ?? createAwsSdkCostExplorerClient(
        awsSdkOptionsFromEnv(context.env),
      ),
    );
  }

  if (providerFlag.value === "openai") {
    const usageFixturePath = readConfiguredEnvValue(context.env[OPENAI_USAGE_FIXTURE_ENV_KEY]);
    const costsFixturePath = readConfiguredEnvValue(context.env[OPENAI_COSTS_FIXTURE_ENV_KEY]);

    if (usageFixturePath !== undefined || costsFixturePath !== undefined) {
      if (usageFixturePath === undefined || costsFixturePath === undefined) {
        context.stderr(
          `OpenAI fixture sync requires both ${OPENAI_USAGE_FIXTURE_ENV_KEY} and ${OPENAI_COSTS_FIXTURE_ENV_KEY}.`,
        );
        return 1;
      }

      return syncOpenAiProvider(
        context,
        config.dbPath,
        createStaticOpenAiUsageCostsClient(
          await loadOpenAiUsageCostsFixture(context.cwd, usageFixturePath, costsFixturePath),
        ),
      );
    }

    if (!config.providers.openai.configured && context.liveClients?.openaiUsageCosts === undefined) {
      context.stderr(
        `OpenAI sync requires OPENAI_ADMIN_KEY or fixture mode with ${OPENAI_USAGE_FIXTURE_ENV_KEY} ` +
          `and ${OPENAI_COSTS_FIXTURE_ENV_KEY}.`,
      );
      return 1;
    }

    return syncOpenAiProvider(
      context,
      config.dbPath,
      context.liveClients?.openaiUsageCosts ?? createOpenAiUsageCostsClient({
        adminKey: requireConfiguredEnvValue(context.env.OPENAI_ADMIN_KEY, "OPENAI_ADMIN_KEY"),
      }),
    );
  }

  if (providerFlag.value === "supabase") {
    const fixturePath = readConfiguredEnvValue(context.env[SUPABASE_FIXTURE_ENV_KEY]);

    if (fixturePath !== undefined) {
      return syncSupabaseProvider(
        context,
        config.dbPath,
        createStaticSupabaseUsageHealthClient(await loadSupabaseFixture(context.cwd, fixturePath)),
      );
    }

    if (!config.providers.supabase.configured && context.liveClients?.supabaseUsageHealth === undefined) {
      context.stderr(
        `Supabase sync requires SUPABASE_ACCESS_TOKEN or ${SUPABASE_FIXTURE_ENV_KEY}. ` +
          `Set ${SUPABASE_FIXTURE_ENV_KEY} for fixture mode.`,
      );
      return 1;
    }

    return syncSupabaseProvider(
      context,
      config.dbPath,
      context.liveClients?.supabaseUsageHealth ?? createSupabaseManagementClient({
        accessToken: requireConfiguredEnvValue(context.env.SUPABASE_ACCESS_TOKEN, "SUPABASE_ACCESS_TOKEN"),
      }),
    );
  }

  if (providerFlag.value === "cloudflare") {
    const fixturePath = readConfiguredEnvValue(context.env[CLOUDFLARE_FIXTURE_ENV_KEY]);

    if (fixturePath !== undefined) {
      return syncCloudflareProvider(
        context,
        config.dbPath,
        createStaticCloudflareBillingUsageClient(await loadCloudflareFixture(context.cwd, fixturePath)),
      );
    }

    if (!config.providers.cloudflare.configured && context.liveClients?.cloudflareBillingUsage === undefined) {
      context.stderr(
        `Cloudflare sync requires CLOUDFLARE_API_TOKEN and ${CLOUDFLARE_ACCOUNT_IDS_ENV_KEY}, or ${CLOUDFLARE_FIXTURE_ENV_KEY}. ` +
          `Set ${CLOUDFLARE_FIXTURE_ENV_KEY} for fixture mode.`,
      );
      return 1;
    }

    return syncCloudflareProvider(
      context,
      config.dbPath,
      context.liveClients?.cloudflareBillingUsage ?? createCloudflareBillingUsageClient({
        apiToken: requireConfiguredEnvValue(context.env.CLOUDFLARE_API_TOKEN, "CLOUDFLARE_API_TOKEN"),
        accountIds: readCloudflareAccountIds(context.env[CLOUDFLARE_ACCOUNT_IDS_ENV_KEY]),
      }),
    );
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
  costExplorerClient: AwsCostExplorerClientAdapter,
): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createAwsCostExplorerConnector({
    costExplorerClient,
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

  if (collection.status === "error") {
    context.stderr(collection.errors?.[0] ?? collection.alerts[0]?.message ?? "AWS Cost Explorer sync failed.");
    return 1;
  }

  return 0;
}

async function loadAwsFixture(cwd: string, fixturePath: string): Promise<AwsCostExplorerGetCostAndUsageOutput> {
  const resolvedPath = isAbsolute(fixturePath) ? fixturePath : join(cwd, fixturePath);

  return JSON.parse(await readFile(resolvedPath, "utf8")) as AwsCostExplorerGetCostAndUsageOutput;
}

async function syncOpenAiProvider(
  context: CliExecutionContext,
  configuredDbPath: string,
  client: OpenAiUsageCostsClient,
): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createOpenAiUsageCostsConnector({
    client,
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
  client: SupabaseManagementClient,
): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createSupabaseUsageHealthConnector({
    client,
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
  client: CloudflareBillingUsageClient,
): Promise<number> {
  const dbPath = resolveDbPath(context.cwd, configuredDbPath);
  await initializeLocalStore({ dbPath });

  const connector = createCloudflareBillingUsageConnector({
    client,
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

function requireConfiguredEnvValue(value: string | undefined, envKey: string): string {
  const trimmed = readConfiguredEnvValue(value);

  if (trimmed === undefined) {
    throw new Error(`${envKey} must be configured for live sync.`);
  }

  return trimmed;
}

function isAwsLiveConfigured(env: Record<string, string | undefined>): boolean {
  return readConfiguredEnvValue(env.AWS_PROFILE) !== undefined ||
    (
      readConfiguredEnvValue(env.AWS_ACCESS_KEY_ID) !== undefined &&
      readConfiguredEnvValue(env.AWS_SECRET_ACCESS_KEY) !== undefined
    );
}

function awsSdkOptionsFromEnv(env: Record<string, string | undefined>): { region?: string } {
  const region = readConfiguredEnvValue(env[AWS_REGION_ENV_KEY]);

  return region === undefined ? {} : { region };
}

function readCloudflareAccountIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((accountId) => accountId.trim())
    .filter((accountId) => accountId.length > 0);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}
