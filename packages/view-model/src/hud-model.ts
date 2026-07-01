import {
  type AggregateSyncStatus,
  type ItemSyncView,
  type RiskSeverity,
  summarizeAggregateSync,
  syncViewFromFreshness,
} from "./sync-state.js";
import {
  type UsageProgressView,
  usageProgressFromTokens,
  usageProgressFromUsedPercent,
  usageProgressSeverity,
} from "./usage-progress.js";
import type { NotificationDigest, NotificationDigestItem, TodayLiveMetric, TodayLiveProviderView, TodayLiveView } from "./view-model.js";
import type { NotificationWidgetKey } from "./notification-preferences-model.js";

export type CreditAccuracy = "exact" | "estimated" | "bounded" | "unknown";

export interface CreditItemView {
  itemKey: string;
  expiresAt: string | null;
  estimatedEarliestAt: string | null;
  estimatedLatestAt: string | null;
  accuracy: CreditAccuracy;
  status: "active" | "expiring_soon" | "expired" | "unknown";
}

export interface CreditPoolView {
  kind: "credit_pool";
  id: string;
  providerKey: "codex-app" | "codex-cli";
  variant: "count" | "expiry";
  availableCount: number | null;
  totalEarnedCount: number | null;
  credits: readonly CreditItemView[];
  unresolvedCount: number;
  nearestExpiryAt: string | null;
  accuracy: CreditAccuracy;
  sync: ItemSyncView;
  riskSeverity: RiskSeverity;
  target: {
    type: "service";
    providerKey: "codex-app" | "codex-cli";
  };
}

export interface QuotaItemView {
  kind: "quota";
  id: string;
  providerKey: string;
  window: "five_hour" | "weekly" | "context" | "budget";
  progress: UsageProgressView;
  resetAt: string | null;
  sync: ItemSyncView;
  riskSeverity: RiskSeverity;
  target: {
    type: "service" | "dashboard";
    providerKey?: string;
    routeKey?: string;
  };
}

export interface WidgetItemView {
  kind: "widget";
  id: string;
  widgetKey: NotificationWidgetKey;
  label: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  providerKey: string | null;
  sync: ItemSyncView;
  riskSeverity: RiskSeverity;
  target: {
    type: "path";
    path: string;
  };
}

export type HudItemView = QuotaItemView | CreditPoolView | WidgetItemView;

export interface HudViewModel {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  dataRevision: string;
  sync: {
    status: AggregateSyncStatus;
    freshCount: number;
    staleCount: number;
    errorCount: number;
    neutralCount: number;
    lastSuccessAt: string | null;
  };
  risk: {
    severity: RiskSeverity;
    warningCount: number;
    criticalCount: number;
  };
  items: readonly HudItemView[];
}

export const CODEX_APP_PROVIDER_KEY = "codex-app";
export const CODEX_CLI_PROVIDER_KEY = "codex-cli";

const CODEX_PROVIDER_KEYS = [CODEX_APP_PROVIDER_KEY, CODEX_CLI_PROVIDER_KEY] as const;
const CODEX_DISPLAY_NAME = "Codex";
const CLI_HUD_WIDGET_KEYS = new Set<NotificationWidgetKey>([
  "claude_five_hour_percent",
  "claude_weekly_percent",
  "codex_five_hour_percent",
  "codex_weekly_percent",
  "codex_reset_credit_count",
  "codex_reset_credit_expiry",
]);
const CREDIT_WARNING_MS = 7 * 24 * 60 * 60 * 1000;
const CREDIT_CRITICAL_MS = 24 * 60 * 60 * 1000;

export interface BuildHudViewModelOptions {
  digest?: NotificationDigest;
}

export function buildHudViewModel(
  todayLive: TodayLiveView,
  options: BuildHudViewModelOptions = {},
): HudViewModel {
  const providers = mergeCodexProvidersForHud(todayLive.providers);
  const providerItems = providers.flatMap((provider) => hudItemsForProvider(provider, todayLive.generatedAt));
  const widgetItems = options.digest === undefined ? [] : hudItemsForDigest(options.digest);
  const items = [...providerItems, ...widgetItems];
  const sync = summarizeAggregateSync(items.map((item) => item.sync));
  const warningCount = items.filter((item) => item.riskSeverity === "warning").length;
  const criticalCount = items.filter((item) => item.riskSeverity === "critical").length;

  return {
    generatedAt: todayLive.generatedAt,
    localOnly: true,
    secretsReturned: false,
    dataRevision: dataRevisionFor(todayLive),
    sync,
    risk: {
      severity: criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "info",
      warningCount,
      criticalCount,
    },
    items,
  };
}

function mergeCodexProvidersForHud(providers: readonly TodayLiveProviderView[]): TodayLiveProviderView[] {
  const codexProviders = providers.filter((provider) => isCodexProviderKey(provider.providerKey));
  const hasApp = codexProviders.some((provider) => provider.providerKey === CODEX_APP_PROVIDER_KEY);
  const hasCli = codexProviders.some((provider) => provider.providerKey === CODEX_CLI_PROVIDER_KEY);

  if (!hasApp || !hasCli) {
    return [...providers];
  }

  const merged = mergeCodexProviderViews(codexProviders);
  let inserted = false;

  return providers.flatMap((provider) => {
    if (!isCodexProviderKey(provider.providerKey)) {
      return [provider];
    }

    if (inserted) {
      return [];
    }

    inserted = true;
    return [merged];
  });
}

function mergeCodexProviderViews(providers: readonly TodayLiveProviderView[]): TodayLiveProviderView {
  const ordered = orderedCodexProviders(providers);
  const preferred = ordered.find((provider) =>
    provider.providerKey === CODEX_APP_PROVIDER_KEY && provider.metrics.length > 0
  ) ?? ordered.find((provider) => provider.providerKey === CODEX_APP_PROVIDER_KEY) ?? ordered[0]!;
  const includedProviders = ordered.filter((provider) => provider.included && provider.todayLiveAmountMinor !== null);
  const currency = singleCurrency(includedProviders.map((provider) => provider.currency)) ??
    singleCurrency(ordered.map((provider) => provider.currency)) ??
    preferred.currency;
  const canInclude = includedProviders.length > 0 && includedProviders.every((provider) => provider.currency === currency);
  const ttlSeconds = minFinite(ordered.map((provider) => provider.ttlSeconds)) ?? preferred.ttlSeconds;
  const revision = maxFinite(ordered.map((provider) => provider.revision ?? Number.NaN));
  const message = uniqueTexts(ordered.map((provider) => provider.message)).join(" / ");

  return {
    ...preferred,
    displayName: CODEX_DISPLAY_NAME,
    checkedAt: latestIso(ordered.map((provider) => provider.checkedAt)),
    expiresAt: latestIso(ordered.map((provider) => provider.expiresAt ?? null)),
    lastAttemptAt: latestIso(ordered.map((provider) => provider.lastAttemptAt ?? null)),
    lastSuccessAt: latestIso(ordered.map((provider) => provider.lastSuccessAt ?? null)),
    freshUntil: latestIso(ordered.map((provider) => provider.freshUntil ?? null)),
    staleUntil: latestIso(ordered.map((provider) => provider.staleUntil ?? null)),
    lastRefreshFailed: ordered.some((provider) => provider.lastRefreshFailed === true),
    ...(ttlSeconds === undefined ? {} : { ttlSeconds }),
    ...(revision === null ? {} : { revision }),
    ...(message.length === 0 ? {} : { message }),
    freshness: summarizeMergedFreshness(ordered.map((provider) => provider.freshness)),
    confidence: summarizeMergedConfidence(ordered.map((provider) => provider.confidence)),
    todayLiveAmountMinor: canInclude ? sum(includedProviders.map((provider) => provider.todayLiveAmountMinor ?? 0)) : null,
    currency,
    included: canInclude,
    metrics: mergeCodexMetrics(ordered),
  };
}

function orderedCodexProviders(providers: readonly TodayLiveProviderView[]): TodayLiveProviderView[] {
  return [
    ...providers.filter((provider) => provider.providerKey === CODEX_APP_PROVIDER_KEY),
    ...providers.filter((provider) => provider.providerKey === CODEX_CLI_PROVIDER_KEY),
  ];
}

function mergeCodexMetrics(providers: readonly TodayLiveProviderView[]): TodayLiveMetric[] {
  const metrics: TodayLiveMetric[] = [];
  const selectedMetricKeys = new Set<string>();
  const selectedCreditMetricKeys = new Set<string>();

  for (const provider of providers) {
    for (const metric of provider.metrics) {
      if (metric.key === "usage_reset_credit" || metric.key === "usage_reset_credit_estimate") {
        const metricKey = creditMetricIdentity(metric);

        if (!selectedCreditMetricKeys.has(metricKey)) {
          selectedCreditMetricKeys.add(metricKey);
          metrics.push(metric);
        }

        continue;
      }

      if (!selectedMetricKeys.has(metric.key)) {
        selectedMetricKeys.add(metric.key);
        metrics.push(metric);
      }
    }
  }

  return metrics;
}

function creditMetricIdentity(metric: TodayLiveMetric): string {
  return [
    metric.key,
    metric.itemKey ?? "",
    metric.resetAt ?? "",
    metric.resetAtLatest ?? "",
    metric.source ?? "",
    metric.value,
  ].join(":");
}

export function filterHudViewModelByWidgets(
  model: HudViewModel,
  selectedWidgets: readonly NotificationWidgetKey[],
): HudViewModel {
  const itemsByWidget = new Map<NotificationWidgetKey, HudItemView[]>();

  for (const item of model.items) {
    for (const widgetKey of hudWidgetKeysForItem(item)) {
      itemsByWidget.set(widgetKey, [...(itemsByWidget.get(widgetKey) ?? []), item]);
    }
  }

  const items = selectedWidgets.flatMap((widgetKey) => itemsByWidget.get(widgetKey) ?? []);
  const sync = summarizeAggregateSync(items.map((item) => item.sync));
  const warningCount = items.filter((item) => item.riskSeverity === "warning").length;
  const criticalCount = items.filter((item) => item.riskSeverity === "critical").length;

  return {
    ...model,
    dataRevision: `${model.dataRevision}#widgets:${selectedWidgets.join(",")}`,
    sync,
    risk: {
      severity: criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "info",
      warningCount,
      criticalCount,
    },
    items,
  };
}

export function buildCreditPoolFromProvider(
  provider: TodayLiveProviderView,
  generatedAt: string,
): CreditPoolView | null {
  return buildCreditPoolsFromProvider(provider, generatedAt)[0] ?? null;
}

export function buildCreditPoolsFromProvider(
  provider: TodayLiveProviderView,
  generatedAt: string,
): CreditPoolView[] {
  if (!isCodexProviderKey(provider.providerKey)) {
    return [];
  }

  const metrics = provider.metrics;
  const explicitCount = firstMetric(metrics, "usage_reset_credits")?.value ?? null;
  const exactMetrics = metrics.filter((metric) => metric.key === "usage_reset_credit");
  const estimatedMetrics = metrics.filter((metric) => metric.key === "usage_reset_credit_estimate");
  const selectedMetrics = exactMetrics.length > 0 ? exactMetrics : estimatedMetrics;
  const credits = selectedMetrics
    .map((metric, index) => creditItemFromMetric(metric, index, generatedAt))
    .sort(compareCreditItems);
  const activeCreditCount = credits.filter((credit) => credit.status !== "expired").length;
  const availableCount = normalizeCount(explicitCount) ?? activeCreditCount;
  const unresolvedCount = Math.max(0, availableCount - credits.length);

  if (availableCount === 0 && credits.length === 0) {
    return [];
  }

  const nearestExpiryAt = credits
    .map((credit) => credit.expiresAt ?? credit.estimatedEarliestAt)
    .filter((value): value is string => value !== null)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;
  const accuracy = summarizeCreditAccuracy(credits, selectedMetrics.length > 0 ? selectedMetrics : metrics);
  const sync = syncViewForProvider(provider, generatedAt);
  const invalidKnownCount = explicitCount !== null && activeCreditCount > explicitCount;

  const basePool = {
    kind: "credit_pool",
    providerKey: provider.providerKey,
    availableCount,
    totalEarnedCount: firstMetric(metrics, "usage_reset_credit_total_earned")?.value ?? null,
    credits,
    unresolvedCount,
    nearestExpiryAt,
    accuracy,
    sync: invalidKnownCount
      ? {
          ...sync,
          state: "error",
          error: {
            code: "invalid_data",
            retryable: false,
            userActionRequired: false,
            message: "Reset credit count is lower than the known active credit list.",
          },
          lastRefreshFailed: true,
        }
      : sync,
    riskSeverity: riskFromNearestExpiry(nearestExpiryAt, generatedAt),
    target: {
      type: "service",
      providerKey: provider.providerKey,
    },
  } satisfies Omit<CreditPoolView, "id" | "variant">;

  return [
    {
      ...basePool,
      id: `${provider.providerKey}:credit-pool:count`,
      variant: "count",
    },
    {
      ...basePool,
      id: `${provider.providerKey}:credit-pool:expiry`,
      variant: "expiry",
    },
  ];
}

function hudItemsForProvider(provider: TodayLiveProviderView, generatedAt: string): HudItemView[] {
  const quotaItems = [
    quotaItemForProvider(provider, generatedAt, "five_hour", "five_hour_limit_percent", "five_hour_tokens", "five_hour_remaining_tokens"),
    quotaItemForProvider(provider, generatedAt, "weekly", "weekly_limit_percent", "weekly_tokens", "weekly_remaining_tokens"),
    quotaItemForProvider(provider, generatedAt, "context", "context_percent", "context_tokens", null),
  ].filter((item): item is QuotaItemView => item !== null);
  const creditPools = buildCreditPoolsFromProvider(provider, generatedAt);

  return [...quotaItems, ...creditPools];
}

function quotaItemForProvider(
  provider: TodayLiveProviderView,
  generatedAt: string,
  window: QuotaItemView["window"],
  percentMetricKey: string,
  usedTokensMetricKey: string,
  remainingTokensMetricKey: string | null,
): QuotaItemView | null {
  const usedPercentMetric = firstMetric(provider.metrics, percentMetricKey);
  const usedTokensMetric = firstMetric(provider.metrics, usedTokensMetricKey);
  const remainingTokensMetric = remainingTokensMetricKey === null ? undefined : firstMetric(provider.metrics, remainingTokensMetricKey);
  const progress = usedPercentMetric === undefined
    ? remainingTokensMetric === undefined
      ? null
      : usageProgressFromTokens(usedTokensMetric?.value ?? null, remainingTokensMetric.value)
    : usageProgressFromUsedPercent(usedPercentMetric.value);

  if (progress === null || progress.usedPercent === null) {
    return null;
  }

  const resetAt = remainingTokensMetric?.resetAt ?? usedPercentMetric?.resetAt ?? null;
  const riskSeverity = usageProgressSeverity(progress);

  return {
    kind: "quota",
    id: `${provider.providerKey}:${window}`,
    providerKey: provider.providerKey,
    window,
    progress,
    resetAt,
    sync: syncViewForProvider(provider, generatedAt),
    riskSeverity,
    target: {
      type: "service",
      providerKey: provider.providerKey,
    },
  };
}

function hudWidgetKeysForItem(item: HudItemView): NotificationWidgetKey[] {
  if (item.kind === "widget") {
    return [item.widgetKey];
  }

  if (item.kind === "credit_pool") {
    return item.variant === "count"
      ? ["codex_reset_credit_count"]
      : ["codex_reset_credit_expiry"];
  }

  if (item.window === "five_hour") {
    if (item.providerKey.startsWith("codex-")) {
      return ["codex_five_hour_percent"];
    }

    if (item.providerKey.startsWith("claude-")) {
      return ["claude_five_hour_percent"];
    }
  }

  if (item.window === "weekly") {
    if (item.providerKey.startsWith("codex-")) {
      return ["codex_weekly_percent"];
    }

    if (item.providerKey.startsWith("claude-")) {
      return ["claude_weekly_percent"];
    }
  }

  return [];
}

function hudItemsForDigest(digest: NotificationDigest): WidgetItemView[] {
  return digest.items
    .filter((item) => !CLI_HUD_WIDGET_KEYS.has(item.widgetKey))
    .map((item) => hudItemForDigestItem(item, digest.generatedAt));
}

function hudItemForDigestItem(item: NotificationDigestItem, generatedAt: string): WidgetItemView {
  const freshness = item.freshness ?? "live";

  return {
    kind: "widget",
    id: `widget:${item.widgetKey}`,
    widgetKey: item.widgetKey,
    label: item.label,
    value: item.value,
    numericValue: item.numericValue ?? null,
    unit: item.unit ?? null,
    providerKey: item.providerKey ?? null,
    sync: syncViewFromFreshness({
      freshness,
      checkedAt: null,
      generatedAt,
      source: item.providerKey ?? item.widgetKey,
    }),
    riskSeverity: item.severity,
    target: {
      type: "path",
      path: item.clickPath ?? "/ko/dashboard/overview",
    },
  };
}

function creditItemFromMetric(metric: TodayLiveMetric, index: number, generatedAt: string): CreditItemView {
  const accuracy = normalizeCreditAccuracy(metric.accuracy, metric.key);
  const expiresAt = metric.key === "usage_reset_credit" ? metric.resetAt ?? null : null;
  const estimatedEarliestAt = metric.key === "usage_reset_credit_estimate" ? metric.resetAt ?? null : null;
  const estimatedLatestAt = metric.resetAtLatest ?? null;
  const riskTime = expiresAt ?? estimatedEarliestAt;

  return {
    itemKey: metric.itemKey ?? `${metric.key}:${index + 1}`,
    expiresAt,
    estimatedEarliestAt,
    estimatedLatestAt,
    accuracy,
    status: creditStatus(riskTime, generatedAt),
  };
}

function syncViewForProvider(provider: TodayLiveProviderView, generatedAt: string): ItemSyncView {
  return syncViewFromFreshness({
    freshness: provider.freshness,
    checkedAt: provider.checkedAt,
    generatedAt,
    source: provider.providerKey,
    ...(provider.ttlSeconds === undefined ? {} : { ttlSeconds: provider.ttlSeconds }),
    ...(provider.message === undefined ? {} : { message: provider.message }),
    ...(provider.lastAttemptAt === undefined ? {} : { lastAttemptAt: provider.lastAttemptAt }),
    ...(provider.lastSuccessAt === undefined ? {} : { lastSuccessAt: provider.lastSuccessAt }),
    ...(provider.freshUntil === undefined ? {} : { freshUntil: provider.freshUntil }),
    ...(provider.staleUntil === undefined ? {} : { staleUntil: provider.staleUntil }),
    ...(provider.lastRefreshFailed === undefined ? {} : { lastRefreshFailed: provider.lastRefreshFailed }),
  });
}

function riskFromNearestExpiry(value: string | null, generatedAt: string): RiskSeverity {
  if (value === null) {
    return "info";
  }

  const remainingMs = Date.parse(value) - Date.parse(generatedAt);

  if (!Number.isFinite(remainingMs) || remainingMs <= CREDIT_CRITICAL_MS) {
    return "critical";
  }

  return remainingMs <= CREDIT_WARNING_MS ? "warning" : "info";
}

function creditStatus(
  expiresAt: string | null,
  generatedAt: string,
): CreditItemView["status"] {
  if (expiresAt === null) {
    return "unknown";
  }

  const remainingMs = Date.parse(expiresAt) - Date.parse(generatedAt);

  if (!Number.isFinite(remainingMs)) {
    return "unknown";
  }

  if (remainingMs <= 0) {
    return "expired";
  }

  return remainingMs <= CREDIT_WARNING_MS ? "expiring_soon" : "active";
}

function firstMetric(metrics: readonly TodayLiveMetric[], key: string): TodayLiveMetric | undefined {
  return metrics.find((metric) => metric.key === key);
}

function normalizeCount(value: number | null): number | null {
  return value === null || !Number.isFinite(value) || value < 0 ? null : Math.floor(value);
}

function summarizeCreditAccuracy(
  credits: readonly CreditItemView[],
  metrics: readonly TodayLiveMetric[],
): CreditAccuracy {
  if (credits.length === 0 && metrics.length === 0) {
    return "unknown";
  }

  if (credits.length > 0 && credits.every((credit) => credit.accuracy === "exact")) {
    return "exact";
  }

  if (credits.some((credit) => credit.accuracy === "bounded")) {
    return "bounded";
  }

  if (credits.some((credit) => credit.accuracy === "estimated")) {
    return "estimated";
  }

  return "unknown";
}

function normalizeCreditAccuracy(value: string | undefined, key: string): CreditAccuracy {
  if (value === "exact" || value === "estimated" || value === "bounded" || value === "unknown") {
    return value;
  }

  return key === "usage_reset_credit"
    ? "exact"
    : key === "usage_reset_credit_estimate"
      ? "bounded"
      : "unknown";
}

function compareCreditItems(left: CreditItemView, right: CreditItemView): number {
  return compareNullableIso(left.expiresAt ?? left.estimatedEarliestAt, right.expiresAt ?? right.estimatedEarliestAt) ||
    left.itemKey.localeCompare(right.itemKey);
}

function compareNullableIso(left: string | null, right: string | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return Date.parse(left) - Date.parse(right);
}

function latestIso(values: readonly (string | null)[]): string | null {
  return values
    .filter((value): value is string => value !== null && Number.isFinite(Date.parse(value)))
    .sort((first, second) => second.localeCompare(first))[0] ?? null;
}

function singleCurrency(values: readonly string[]): string | null {
  const normalized = values
    .map((currency) => currency.trim().toUpperCase())
    .filter((currency) => currency.length > 0);
  const unique = new Set(normalized);

  return unique.size === 1 ? normalized[0] ?? null : null;
}

function minFinite(values: readonly (number | undefined)[]): number | undefined {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return finiteValues.length === 0 ? undefined : Math.min(...finiteValues);
}

function maxFinite(values: readonly number[]): number | null {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  return finiteValues.length === 0 ? null : Math.max(...finiteValues);
}

function uniqueTexts(values: readonly (string | undefined)[]): string[] {
  return [...new Set(
    values
      .map((value) => value?.trim() ?? "")
      .filter((value) => value.length > 0),
  )];
}

function summarizeMergedFreshness(
  values: readonly TodayLiveProviderView["freshness"][],
): TodayLiveProviderView["freshness"] {
  if (values.includes("live")) {
    return "live";
  }

  const order: readonly TodayLiveProviderView["freshness"][] = [
    "error",
    "locked",
    "stale",
    "unavailable",
    "not_configured",
  ];

  return order.find((value) => values.includes(value)) ?? "unavailable";
}

function summarizeMergedConfidence(
  values: readonly TodayLiveProviderView["confidence"][],
): TodayLiveProviderView["confidence"] {
  if (values.includes("high")) {
    return "high";
  }

  if (values.includes("medium")) {
    return "medium";
  }

  if (values.includes("low")) {
    return "low";
  }

  return "none";
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function dataRevisionFor(todayLive: TodayLiveView): string {
  return [
    todayLive.generatedAt,
    todayLive.providers.map((provider) => [
      provider.providerKey,
      provider.checkedAt ?? "",
      provider.lastSuccessAt ?? "",
      provider.revision ?? "",
    ].join(":")).join("|"),
  ].join("#");
}

function isCodexProviderKey(value: string): value is typeof CODEX_PROVIDER_KEYS[number] {
  return CODEX_PROVIDER_KEYS.includes(value as typeof CODEX_PROVIDER_KEYS[number]);
}
