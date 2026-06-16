import { createAwsCostExplorerConnector, createAwsSdkCostExplorerClient } from "../../../packages/connectors/aws/src/index";
import {
  createOpenAiUsageCostsClient,
  createOpenAiUsageCostsConnector,
} from "../../../packages/connectors/openai/src/index";
import {
  createSupabaseManagementClient,
  createSupabaseUsageHealthConnector,
} from "../../../packages/connectors/supabase/src/index";
import {
  createCloudflareBillingUsageClient,
  createCloudflareBillingUsageConnector,
} from "../../../packages/connectors/cloudflare/src/index";
import {
  createDefaultCredentialStore,
  type StoredCredential,
  type CredentialStore,
} from "../../../packages/credentials/src/index";
import { redactSensitiveString } from "../../../packages/security/src/index";
import {
  readConnectionsStatus,
  type ConnectionState,
  type ConnectionsStatusPayload,
  type ProviderCredentialConnectionStatus,
  type ProviderConnectionStatus,
} from "./connection-status";
import {
  findAvailableProvider,
  type LiveGranularity,
  type ProviderKey,
} from "./provider-catalog";
import { readLocalAiCliStatus, type LocalAiCliProviderKey, type LocalAiCliProviderStatus } from "./local-tools";

export type LiveTodayFreshness = "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";
export type LiveTodayConfidence = "high" | "medium" | "low" | "none";
export type LiveTodayCollectionStatus = "ok" | "partial" | "error";

export interface LiveTodayProviderSnapshot {
  providerKey: ProviderKey;
  connectionId?: string;
  connectionLabel?: string;
  checkedAt: string | null;
  expiresAt: string | null;
  ttlSeconds: number;
  freshness: LiveTodayFreshness;
  liveGranularity: LiveGranularity;
  confidence: LiveTodayConfidence;
  provisional: true;
  todayLiveAmountMinor: number | null;
  currency: string;
  included: boolean;
  status: LiveTodayCollectionStatus | "not_checked";
  usageSummary?: LiveTodayUsageSummary;
  message?: string;
}

export interface LiveTodaySnapshot {
  generatedAt: string;
  ttlSeconds: number;
  cacheState: "empty" | "fresh" | "stale";
  providers: readonly LiveTodayProviderSnapshot[];
}

export interface LiveTodayProviderCollection {
  providerKey: ProviderKey;
  connectionId?: string;
  connectionLabel?: string;
  status: LiveTodayCollectionStatus;
  checkedAt: string;
  todayLiveAmountMinor: number | null;
  currency: string;
  included: boolean;
  confidence: LiveTodayConfidence;
  usageSummary?: LiveTodayUsageSummary;
  message?: string;
}

export interface LiveTodayUsageSummary {
  kind: "llm_subscription";
  period: "current_month";
  metrics: readonly LiveTodayUsageMetric[];
  topServices: readonly string[];
}

export interface LiveTodayUsageMetric {
  key: "input_tokens" | "output_tokens" | "cache_tokens" | "model_requests" | "sessions" | "turns" | "tool_calls" | "log_files" | "context_tokens" | "context_percent" | "last_request_tokens" | "total_tokens" | "reasoning_tokens" | "five_hour_limit_percent" | "weekly_limit_percent" | "five_hour_tokens" | "weekly_tokens" | "five_hour_remaining_tokens" | "weekly_remaining_tokens";
  value: number;
  unit: "tokens" | "requests" | "sessions" | "turns" | "calls" | "files" | "percent" | "usd";
  resetAt?: string;
}

export type LiveTodayProviderCollector = (
  context: LiveTodayCollectionContext,
) => Promise<LiveTodayProviderCollection>;

export interface LiveTodayCollectionContext {
  providerKey: ProviderKey;
  connection: ProviderConnectionStatus;
  credentialConnection?: ProviderCredentialConnectionStatus;
  env: Record<string, string | undefined>;
  credentialStore: CredentialStore;
  now: Date;
  timezone: string;
}

export interface LiveTodayOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  timezone?: string;
  ttlSeconds?: number;
  connections?: ConnectionsStatusPayload;
  credentialStore?: CredentialStore;
  collectors?: Partial<Record<ProviderKey, LiveTodayProviderCollector>>;
}

const DEFAULT_TTL_SECONDS = 60;
const AWS_REGION_ENV_KEY = "MONEYSIREN_AWS_REGION";
const CLOUDFLARE_ACCOUNT_IDS_ENV_KEY = "CLOUDFLARE_ACCOUNT_IDS";
const ENV_CONNECTION_ID = "env";
const cache = new Map<string, CachedLiveTodayProvider>();

interface CachedLiveTodayProvider extends LiveTodayProviderCollection {
  expiresAt: string;
}

export async function readLiveTodaySnapshot(options: LiveTodayOptions = {}): Promise<LiveTodaySnapshot> {
  const context = await createLiveTodayContext(options);
  const providers = await Promise.all(liveTargetsFromConnections(context.connections).map(async (target) => {
    const cached = cache.get(liveCacheKey(target));

    if (cached === undefined) {
      if (isLocalAiCliProviderKey(target.providerKey)) {
        const collected = await collectAndCacheLiveTodayTarget(context, target);

        return snapshotFromCachedProvider(target, collected, context.now, context.ttlSeconds);
      }

      return notCheckedSnapshot(target, context.ttlSeconds);
    }

    return snapshotFromCachedProvider(target, cached, context.now, context.ttlSeconds);
  }));

  return {
    generatedAt: context.now.toISOString(),
    ttlSeconds: context.ttlSeconds,
    cacheState: summarizeCacheState(providers),
    providers,
  };
}

export async function refreshLiveToday(options: LiveTodayOptions = {}): Promise<LiveTodaySnapshot> {
  const context = await createLiveTodayContext(options);

  await Promise.all(
    liveTargetsFromConnections(context.connections).map((target) => collectAndCacheLiveTodayTarget(context, target)),
  );

  return readLiveTodaySnapshot({
    ...options,
    connections: context.connections,
    credentialStore: context.credentialStore,
    now: () => context.now,
  });
}

async function collectAndCacheLiveTodayTarget(
  context: RequiredLiveTodayContext,
  target: LiveTodayConnectionTarget,
): Promise<CachedLiveTodayProvider> {
  const providerKey = target.providerKey;
  const checkedAt = context.now.toISOString();
  const preflight = preflightProvider(target);

  if (preflight !== null) {
    const collected: CachedLiveTodayProvider = {
      providerKey,
      ...(target.connectionId === undefined ? {} : { connectionId: target.connectionId }),
      ...(target.connectionLabel === undefined ? {} : { connectionLabel: target.connectionLabel }),
      status: "partial",
      checkedAt,
      expiresAt: expiresAt(context.now, context.ttlSeconds),
      todayLiveAmountMinor: null,
      currency: "USD",
      included: false,
      confidence: "none",
      message: preflight,
    };
    cache.set(liveCacheKey(target), collected);

    return collected;
  }

  const collector = context.collectors[providerKey] ?? createDefaultLiveTodayCollector(providerKey);

  try {
    const collected = await collector({
      providerKey,
      connection: target.connection,
      ...(target.credentialConnection === undefined ? {} : { credentialConnection: target.credentialConnection }),
      env: context.env,
      credentialStore: context.credentialStore,
      now: context.now,
      timezone: context.timezone,
    });
    const cached: CachedLiveTodayProvider = {
      ...collected,
      ...(target.connectionId === undefined ? {} : { connectionId: target.connectionId }),
      ...(target.connectionLabel === undefined ? {} : { connectionLabel: target.connectionLabel }),
      expiresAt: expiresAt(context.now, context.ttlSeconds),
    };
    cache.set(liveCacheKey(target), cached);

    return cached;
  } catch (error) {
    const cached: CachedLiveTodayProvider = {
      providerKey,
      ...(target.connectionId === undefined ? {} : { connectionId: target.connectionId }),
      ...(target.connectionLabel === undefined ? {} : { connectionLabel: target.connectionLabel }),
      status: "error",
      checkedAt,
      expiresAt: expiresAt(context.now, context.ttlSeconds),
      todayLiveAmountMinor: null,
      currency: "USD",
      included: false,
      confidence: "none",
      message: safeErrorMessage(error),
    };
    cache.set(liveCacheKey(target), cached);

    return cached;
  }
}

export function clearLiveTodayCache(): void {
  cache.clear();
}

async function createLiveTodayContext(options: LiveTodayOptions): Promise<RequiredLiveTodayContext> {
  const env = options.env ?? process.env;
  const now = options.now?.() ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const credentialStore = options.credentialStore ?? createDefaultCredentialStore({
    env,
    now: () => now,
  });
  const connections = options.connections ?? await readConnectionsStatus({
    env,
    credentialStore,
    now: () => now,
  });

  return {
    env,
    now,
    ttlSeconds,
    timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    connections,
    credentialStore,
    collectors: options.collectors ?? {},
  };
}

interface RequiredLiveTodayContext {
  env: Record<string, string | undefined>;
  now: Date;
  ttlSeconds: number;
  timezone: string;
  connections: ConnectionsStatusPayload;
  credentialStore: CredentialStore;
  collectors: Partial<Record<ProviderKey, LiveTodayProviderCollector>>;
}

interface LiveTodayConnectionTarget {
  providerKey: ProviderKey;
  connection: ProviderConnectionStatus;
  credentialConnection?: ProviderCredentialConnectionStatus;
  connectionId?: string;
  connectionLabel?: string;
  connectionState: ConnectionState;
}

function liveTargetsFromConnections(connections: ConnectionsStatusPayload): LiveTodayConnectionTarget[] {
  return connections.providers.flatMap((connection) => {
    const targets: LiveTodayConnectionTarget[] = [];

    if (connection.connectionState === "env_configured") {
      targets.push({
        providerKey: connection.providerKey,
        connection,
        connectionId: ENV_CONNECTION_ID,
        connectionLabel: "Environment",
        connectionState: "env_configured",
      });
    }

    for (const credentialConnection of connection.connections) {
      targets.push({
        providerKey: connection.providerKey,
        connection,
        credentialConnection,
        connectionId: credentialConnection.connectionId,
        connectionLabel: credentialConnection.label,
        connectionState: credentialConnection.connectionState,
      });
    }

    if (targets.length === 0) {
      targets.push({
        providerKey: connection.providerKey,
        connection,
        connectionState: connection.connectionState,
      });
    }

    return targets;
  });
}

function liveCacheKey(target: LiveTodayConnectionTarget): string {
  return `${target.providerKey}:${target.connectionId ?? "provider"}`;
}

function preflightProvider(target: LiveTodayConnectionTarget): string | null {
  if (target.connectionState === "not_configured") {
    return "Provider credentials are not configured.";
  }

  if (target.connectionState === "locked") {
    return "Credential store is locked.";
  }

  if (target.connectionState === "expired" || target.connectionState === "invalid") {
    return "Provider credentials are not valid for live checks.";
  }

  if (findAvailableProvider(target.providerKey)?.liveGranularity === "unavailable") {
    return "Provider does not support live today checks.";
  }

  return null;
}

function notCheckedSnapshot(
  target: LiveTodayConnectionTarget,
  ttlSeconds: number,
): LiveTodayProviderSnapshot {
  const granularity = findAvailableProvider(target.providerKey)?.liveGranularity ?? "unavailable";

  return {
    providerKey: target.providerKey,
    ...(target.connectionId === undefined ? {} : { connectionId: target.connectionId }),
    ...(target.connectionLabel === undefined ? {} : { connectionLabel: target.connectionLabel }),
    checkedAt: null,
    expiresAt: null,
    ttlSeconds,
    freshness: freshnessWithoutCache(target.connectionState, granularity),
    liveGranularity: granularity,
    confidence: "none",
    provisional: true,
    todayLiveAmountMinor: null,
    currency: "USD",
    included: false,
    status: "not_checked",
  };
}

function snapshotFromCachedProvider(
  target: LiveTodayConnectionTarget,
  cached: CachedLiveTodayProvider,
  now: Date,
  ttlSeconds: number,
): LiveTodayProviderSnapshot {
  const granularity = findAvailableProvider(target.providerKey)?.liveGranularity ?? "unavailable";
  const expired = new Date(cached.expiresAt).getTime() <= now.getTime();
  const freshness = cached.status === "partial" && cached.confidence === "none" && cached.todayLiveAmountMinor === null
    ? freshnessWithoutCache(target.connectionState, granularity)
    : cached.status === "error"
    ? "error"
    : expired
      ? "stale"
      : "live";

  return {
    providerKey: target.providerKey,
    ...(target.connectionId === undefined ? {} : { connectionId: target.connectionId }),
    ...(target.connectionLabel === undefined ? {} : { connectionLabel: target.connectionLabel }),
    checkedAt: cached.checkedAt,
    expiresAt: cached.expiresAt,
    ttlSeconds,
    freshness,
    liveGranularity: granularity,
    confidence: expired || cached.status === "error" ? "none" : cached.confidence,
    provisional: true,
    todayLiveAmountMinor: cached.todayLiveAmountMinor,
    currency: cached.currency,
    included: !expired && cached.status !== "error" && cached.included,
    status: cached.status,
    ...(cached.usageSummary === undefined ? {} : { usageSummary: cached.usageSummary }),
    ...(cached.message === undefined ? {} : { message: cached.message }),
  };
}

function freshnessWithoutCache(
  connectionState: ConnectionState,
  granularity: LiveGranularity,
): LiveTodayFreshness {
  if (connectionState === "locked") {
    return "locked";
  }

  if (connectionState === "not_configured") {
    return "not_configured";
  }

  if (connectionState === "expired" || connectionState === "invalid") {
    return "error";
  }

  if (granularity === "unavailable") {
    return "unavailable";
  }

  return "stale";
}

function summarizeCacheState(providers: readonly LiveTodayProviderSnapshot[]): LiveTodaySnapshot["cacheState"] {
  if (providers.every((provider) => provider.checkedAt === null)) {
    return "empty";
  }

  if (providers.some((provider) => provider.freshness === "live")) {
    return "fresh";
  }

  return "stale";
}

function isLocalAiCliProviderKey(providerKey: ProviderKey): providerKey is LocalAiCliProviderKey {
  return providerKey === "codex-cli" || providerKey === "claude-cli";
}

function createDefaultLiveTodayCollector(providerKey: ProviderKey): LiveTodayProviderCollector {
  if (providerKey === "aws") {
    return collectAwsLiveToday;
  }

  if (providerKey === "openai") {
    return collectOpenAiLiveToday;
  }

  if (providerKey === "supabase") {
    return collectSupabaseLiveToday;
  }

  if (providerKey === "cloudflare") {
    return collectCloudflareLiveToday;
  }

  if (providerKey === "codex-cli" || providerKey === "claude-cli") {
    return collectLocalAiCliLiveToday;
  }

  throw new Error(`Live today collector is not implemented for ${providerKey}.`);
}

async function collectAwsLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const connector = createAwsCostExplorerConnector({
    costExplorerClient: createAwsSdkCostExplorerClient(awsSdkOptionsFromEnv(context.env)),
  });
  const collection = await connector.collect({
    now: () => context.now,
  });
  const estimate = summarizeAmount(collection.snapshots.costEstimates);

  return {
    providerKey: "aws",
    status: collection.status,
    checkedAt: collection.collectedAt,
    todayLiveAmountMinor: estimate.amountMinor,
    currency: estimate.currency,
    included: false,
    confidence: "medium",
    message: "AWS Cost Explorer exposes the current billing period, not exact current-day cost.",
  };
}

async function collectOpenAiLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const credential = await resolveProviderSecret(context, "openai");
  const connector = createOpenAiUsageCostsConnector({
    client: createOpenAiUsageCostsClient({
      adminKey: credential.secret,
    }),
  });
  const collection = await connector.collect({
    now: () => context.now,
  });
  const today = dateKeyInTimezone(context.now, context.timezone);
  const todayEstimate = summarizeAmount(
    collection.snapshots.costEstimates.filter((estimate) => estimate.periodStart === today),
  );
  const usageSummary = summarizeOpenAiCurrentUsage(collection.snapshots.usage);

  return {
    providerKey: "openai",
    status: collection.status,
    checkedAt: collection.collectedAt,
    todayLiveAmountMinor: todayEstimate.amountMinor,
    currency: todayEstimate.currency,
    included: todayEstimate.amountMinor !== null,
    confidence: todayEstimate.amountMinor === null ? "none" : "medium",
    ...(usageSummary === undefined ? {} : { usageSummary }),
    message: "OpenAI daily cost bucket is provisional until provider finalization.",
  };
}

async function collectSupabaseLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const credential = await resolveProviderSecret(context, "supabase");
  const connector = createSupabaseUsageHealthConnector({
    client: createSupabaseManagementClient({
      accessToken: credential.secret,
    }),
  });
  const collection = await connector.collect({
    now: () => context.now,
  });

  return {
    providerKey: "supabase",
    status: collection.status,
    checkedAt: collection.collectedAt,
    todayLiveAmountMinor: null,
    currency: "USD",
    included: false,
    confidence: collection.status === "error" ? "none" : "low",
    message: "Supabase live checks expose usage and health, not reliable current-day cost.",
  };
}

async function collectCloudflareLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const credential = await resolveProviderSecret(context, "cloudflare");
  const accountIds = readCloudflareAccountIds(context.env[CLOUDFLARE_ACCOUNT_IDS_ENV_KEY] ?? credential.metadata.accountIds);
  const connector = createCloudflareBillingUsageConnector({
    client: createCloudflareBillingUsageClient({
      apiToken: credential.secret,
      accountIds,
    }),
  });
  const collection = await connector.collect({
    now: () => context.now,
  });
  const estimate = summarizeAmount(collection.snapshots.costEstimates);

  return {
    providerKey: "cloudflare",
    status: collection.status,
    checkedAt: collection.collectedAt,
    todayLiveAmountMinor: estimate.amountMinor,
    currency: estimate.currency,
    included: false,
    confidence: collection.status === "error" ? "none" : "low",
    message: "Cloudflare exposes billing-period or month-to-date surfaces; exact current-day cost is excluded.",
  };
}

async function collectLocalAiCliLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const providerKey = context.providerKey as LocalAiCliProviderKey;
  const status = await readLocalAiCliStatus({
    env: context.env,
    now: () => context.now,
  });
  const provider = status.providers.find((item) => item.providerKey === providerKey);

  if (provider === undefined) {
    throw new Error("Local AI CLI provider is not available.");
  }

  const usageSummary = summarizeLocalAiCliUsage(provider);
  const hasUsage = usageSummary !== null;

  return {
    providerKey,
    status: hasUsage ? "ok" : "partial",
    checkedAt: status.generatedAt,
    todayLiveAmountMinor: null,
    currency: "USD",
    included: false,
    confidence: hasUsage ? "low" : "none",
    ...(hasUsage
      ? {
          usageSummary,
        }
      : {}),
    message: provider.usage.message,
  };
}

export function summarizeLocalAiCliUsage(provider: LocalAiCliProviderStatus): LiveTodayUsageSummary | null {
  const metrics = localCliUsageMetrics(provider);

  if (metrics.length === 0) {
    return null;
  }

  return {
    kind: "llm_subscription",
    period: "current_month",
    metrics,
    topServices: provider.usage.topModels.length === 0
      ? [provider.displayName]
      : provider.usage.topModels,
  };
}

function localCliUsageMetrics(provider: LocalAiCliProviderStatus): LiveTodayUsageMetric[] {
  const metrics: LiveTodayUsageMetric[] = [];
  const statusLine = provider.usage.statusLine;

  if (statusLine.fiveHourLimitPercent !== null && statusLine.fiveHourLimitPercent >= 0) {
    metrics.push({ key: "five_hour_limit_percent", value: statusLine.fiveHourLimitPercent, unit: "percent" });
  }

  if (statusLine.weeklyLimitPercent !== null && statusLine.weeklyLimitPercent >= 0) {
    metrics.push({ key: "weekly_limit_percent", value: statusLine.weeklyLimitPercent, unit: "percent" });
  }

  if (statusLine.fiveHourUsedTokens !== null && statusLine.fiveHourUsedTokens > 0) {
    metrics.push({ key: "five_hour_tokens", value: statusLine.fiveHourUsedTokens, unit: "tokens" });
  }

  if (statusLine.fiveHourRemainingTokens !== null) {
    metrics.push({
      key: "five_hour_remaining_tokens",
      value: statusLine.fiveHourRemainingTokens,
      unit: "tokens",
      ...(statusLine.fiveHourResetAt === null ? {} : { resetAt: statusLine.fiveHourResetAt }),
    });
  }

  if (statusLine.weeklyUsedTokens !== null && statusLine.weeklyUsedTokens > 0) {
    metrics.push({ key: "weekly_tokens", value: statusLine.weeklyUsedTokens, unit: "tokens" });
  }

  if (statusLine.weeklyRemainingTokens !== null) {
    metrics.push({
      key: "weekly_remaining_tokens",
      value: statusLine.weeklyRemainingTokens,
      unit: "tokens",
      ...(statusLine.weeklyResetAt === null ? {} : { resetAt: statusLine.weeklyResetAt }),
    });
  }

  if (statusLine.contextWindowTokens !== null && statusLine.contextWindowTokens > 0) {
    metrics.push({ key: "context_tokens", value: statusLine.contextWindowTokens, unit: "tokens" });
  }

  if (statusLine.contextWindowPercent !== null && statusLine.contextWindowPercent > 0) {
    metrics.push({ key: "context_percent", value: statusLine.contextWindowPercent, unit: "percent" });
  }

  if (statusLine.lastTotalTokens !== null && statusLine.lastTotalTokens > 0) {
    metrics.push({ key: "last_request_tokens", value: statusLine.lastTotalTokens, unit: "tokens" });
  }

  if (statusLine.totalTokens !== null && statusLine.totalTokens > 0) {
    metrics.push({ key: "total_tokens", value: statusLine.totalTokens, unit: "tokens" });
  }

  if (statusLine.totalReasoningTokens !== null && statusLine.totalReasoningTokens > 0) {
    metrics.push({ key: "reasoning_tokens", value: statusLine.totalReasoningTokens, unit: "tokens" });
  } else if (provider.usage.reasoningOutputTokens !== null && provider.usage.reasoningOutputTokens > 0) {
    metrics.push({ key: "reasoning_tokens", value: provider.usage.reasoningOutputTokens, unit: "tokens" });
  }

  if (provider.usage.sessionCount > 0) {
    metrics.push({ key: "sessions", value: provider.usage.sessionCount, unit: "sessions" });
  }

  if (provider.usage.turnCount > 0) {
    metrics.push({ key: "turns", value: provider.usage.turnCount, unit: "turns" });
  }

  if (provider.usage.toolCallCount > 0) {
    metrics.push({ key: "tool_calls", value: provider.usage.toolCallCount, unit: "calls" });
  }

  if (provider.usage.inputTokens !== null && provider.usage.inputTokens > 0) {
    metrics.push({ key: "input_tokens", value: provider.usage.inputTokens, unit: "tokens" });
  }

  if (provider.usage.outputTokens !== null && provider.usage.outputTokens > 0) {
    metrics.push({ key: "output_tokens", value: provider.usage.outputTokens, unit: "tokens" });
  }

  if (provider.usage.cacheTokens !== null && provider.usage.cacheTokens > 0) {
    metrics.push({ key: "cache_tokens", value: provider.usage.cacheTokens, unit: "tokens" });
  }

  if (provider.usage.logFileCount > 0) {
    metrics.push({ key: "log_files", value: provider.usage.logFileCount, unit: "files" });
  }

  return metrics;
}

async function resolveProviderSecret(
  context: LiveTodayCollectionContext,
  providerKey: Exclude<ProviderKey, "aws">,
): Promise<{ secret: string; metadata: Readonly<Record<string, string>> }> {
  if (context.credentialConnection !== undefined) {
    return credentialSecretOrThrow(await context.credentialStore.getCredential(
      providerKey,
      "read-only",
      context.credentialConnection.connectionId,
    ));
  }

  if (providerKey === "openai" && isConfigured(context.env.OPENAI_ADMIN_KEY)) {
    return {
      secret: context.env.OPENAI_ADMIN_KEY.trim(),
      metadata: {},
    };
  }

  if (providerKey === "supabase" && isConfigured(context.env.SUPABASE_ACCESS_TOKEN)) {
    return {
      secret: context.env.SUPABASE_ACCESS_TOKEN.trim(),
      metadata: {},
    };
  }

  if (providerKey === "cloudflare" && isConfigured(context.env.CLOUDFLARE_API_TOKEN)) {
    return {
      secret: context.env.CLOUDFLARE_API_TOKEN.trim(),
      metadata: {},
    };
  }

  const credential = await context.credentialStore.getCredential(providerKey, "read-only");

  return credentialSecretOrThrow(credential);
}

function credentialSecretOrThrow(
  credential: StoredCredential | null,
): { secret: string; metadata: Readonly<Record<string, string>> } {
  if (credential === null) {
    throw new Error("Provider credential is not configured.");
  }

  return {
    secret: credential.secret,
    metadata: credential.metadata,
  };
}

function summarizeAmount(
  estimates: readonly {
    estimatedAmountMinor: number;
    currency: string;
  }[],
): { amountMinor: number | null; currency: string } {
  if (estimates.length === 0) {
    return {
      amountMinor: null,
      currency: "USD",
    };
  }

  const currencies = new Set(estimates.map((estimate) => estimate.currency));

  if (currencies.size !== 1) {
    return {
      amountMinor: null,
      currency: "MIXED",
    };
  }

  return {
    amountMinor: estimates.reduce((total, estimate) => total + estimate.estimatedAmountMinor, 0),
    currency: [...currencies][0] ?? "USD",
  };
}

function summarizeOpenAiCurrentUsage(
  usage: readonly {
    service: string;
    metric: "input_tokens" | "output_tokens" | "model_requests";
    value: number;
  }[],
): LiveTodayUsageSummary | undefined {
  if (usage.length === 0) {
    return undefined;
  }

  const inputTokens = sumUsageMetric(usage, "input_tokens");
  const outputTokens = sumUsageMetric(usage, "output_tokens");
  const modelRequests = sumUsageMetric(usage, "model_requests");
  const metricCandidates: LiveTodayUsageMetric[] = [
    { key: "input_tokens", value: inputTokens, unit: "tokens" },
    { key: "output_tokens", value: outputTokens, unit: "tokens" },
    { key: "model_requests", value: modelRequests, unit: "requests" },
  ];
  const metrics = metricCandidates.filter((metric) => metric.value > 0);

  if (metrics.length === 0) {
    return undefined;
  }

  return {
    kind: "llm_subscription",
    period: "current_month",
    metrics,
    topServices: summarizeTopUsageServices(usage),
  };
}

function sumUsageMetric(
  usage: readonly {
    metric: "input_tokens" | "output_tokens" | "model_requests";
    value: number;
  }[],
  metric: "input_tokens" | "output_tokens" | "model_requests",
): number {
  return usage
    .filter((item) => item.metric === metric)
    .reduce((total, item) => total + item.value, 0);
}

function summarizeTopUsageServices(
  usage: readonly {
    service: string;
    value: number;
  }[],
): string[] {
  const totals = new Map<string, number>();

  for (const item of usage) {
    totals.set(item.service, (totals.get(item.service) ?? 0) + item.value);
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([service]) => service);
}

function awsSdkOptionsFromEnv(env: Record<string, string | undefined>): { region?: string } {
  const region = env[AWS_REGION_ENV_KEY]?.trim();

  return region === undefined || region.length === 0 ? {} : { region };
}

function readCloudflareAccountIds(value: string | undefined): string[] {
  const accountIds = (value ?? "")
    .split(",")
    .map((accountId) => accountId.trim())
    .filter((accountId) => accountId.length > 0);

  if (accountIds.length === 0) {
    throw new Error("Cloudflare account IDs are required for live checks.");
  }

  return accountIds;
}

function dateKeyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return [
    parts.find((part) => part.type === "year")?.value ?? "1970",
    parts.find((part) => part.type === "month")?.value ?? "01",
    parts.find((part) => part.type === "day")?.value ?? "01",
  ].join("-");
}

function expiresAt(now: Date, ttlSeconds: number): string {
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}

function isConfigured(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return "Live provider check failed.";
  }

  const redacted = redactSensitiveString(error.message.trim());

  return redacted.length <= 240 ? redacted : `${redacted.slice(0, 237)}...`;
}
