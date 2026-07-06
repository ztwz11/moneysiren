import { loadMoneySirenConfig } from "../../../packages/config/src/index";
import {
  DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  readNotificationPreferencesFile,
  type DashboardBudgetPreferences,
  type DashboardWidgetLayoutPreferences,
  type LocalCliDashboardMetricKey,
  type NotificationPreferences,
} from "../../../packages/view-model/src/index";
import {
  readConnectionsStatus,
  type ConnectionState,
  type ConnectionsStatusPayload,
  type EmergencyAccessState,
  type ProviderCredentialConnectionStatus,
  type ProviderConnectionStatus,
} from "./connection-status";
import type {
  DashboardAlertItem,
  DashboardHealthStatus,
  DashboardProviderRow,
  DashboardRiskLevel,
  DashboardRiskSeverity,
  DashboardDailyUsageMetric,
  DashboardSnapshot,
  DashboardUsageMetric,
} from "./dashboard-data";
import { readDashboardSnapshot, type ReadDashboardSnapshotOptions } from "./dashboard-data";
import {
  CONNECTABLE_PROVIDER_KEYS,
  LOCAL_PROVIDER_KEYS,
  findAvailableProvider,
  type LiveGranularity,
  type ProviderSetupLink,
  type ProviderKey,
} from "./provider-catalog";
import {
  readLiveTodaySnapshot,
  type LiveTodayFreshness,
  type LiveTodayProviderSnapshot,
  type LiveTodaySnapshot,
  type LiveTodayUsageMetric,
  type LiveTodayUsageSummary,
} from "./live-today";
import { readExchangeRate, type ExchangeRateResult } from "./exchange-rates";
import { readLocalAiCliStatus, type LocalAiCliStatusPayload } from "./local-tools";

export type CanonicalFreshness = "fresh" | "stale" | "missing";
export type LiveFreshness = "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";
type OperationsCredentialStore = ProviderConnectionStatus["credentialStore"];

const CODEX_APP_PROVIDER_KEY: ProviderKey = "codex-app";
const CODEX_CLI_PROVIDER_KEY: ProviderKey = "codex-cli";
const CODEX_DISPLAY_NAME = "Codex";

export interface OperationsDashboard {
  generatedAt: string;
  source: DashboardSnapshot["source"];
  database: DashboardSnapshot["database"];
  timezone: string;
  summary: OperationsSummary;
  providers: OperationsProvider[];
  visibleProviders: OperationsProvider[];
  visibleConnections: OperationsProviderConnection[];
  usageTrend: OperationsUsageTrendPoint[];
  displayPreferences: OperationsDisplayPreferences;
  risks: DashboardAlertItem[];
}

export interface OperationsDisplayPreferences {
  localCliMetricKeys: readonly LocalCliDashboardMetricKey[];
  widgetLayouts: DashboardWidgetLayoutPreferences;
}

export interface OperationsSummary {
  currency: string;
  sourceCurrency: string;
  exchangeRate: OperationsExchangeRateStatus;
  monthForecastAmountMinor: number;
  confirmedThroughYesterdayAmountMinor: number;
  todayLiveAmountMinor: number | null;
  todayLiveIncludedProviderCount: number;
  todayLiveExcludedProviderCount: number;
  providersNeedingAttention: number;
  canonicalCoverageDate: string | null;
  remainingDaysInMonth: number;
  budget: OperationsBudgetStatus;
}

export interface OperationsBudgetStatus {
  monthlyBudgetMinor: number | null;
  currency: string;
  warningPercent: number;
  criticalPercent: number;
  usagePercent: number | null;
  riskLevel: DashboardRiskLevel;
  status: "not_configured" | "ok" | "warning" | "critical" | "currency_mismatch";
}

export interface OperationsExchangeRateStatus {
  sourceCurrency: string;
  requestedCurrency: string;
  displayCurrency: string;
  rate: number;
  rateDate: string | null;
  fetchedAt: string;
  source: "identity" | "frankfurter";
  status: "identity" | "live" | "unavailable";
  message?: string;
}

export interface OperationsProvider {
  providerKey: ProviderKey;
  displayName: string;
  connections: readonly ProviderCredentialConnectionStatus[];
  connectionState: ConnectionState;
  credentialSource: ProviderConnectionStatus["credentialSource"];
  readOnlyTestState: ConnectionState;
  emergencyAccessState: EmergencyAccessState;
  credentialStore: OperationsCredentialStore;
  authMethod: string;
  credentialRequirements: readonly string[];
  requiredEnvKeys: readonly string[];
  configuredEnvKeys: readonly string[];
  missingEnvKeys: readonly string[];
  setupLinks: readonly ProviderSetupLink[];
  canonicalFreshness: CanonicalFreshness;
  liveFreshness: LiveFreshness;
  liveGranularity: LiveGranularity;
  liveConfidence: "high" | "medium" | "low" | "none";
  currentUsageSummary: LiveTodayUsageSummary | null;
  latestCanonicalSync: string | null;
  latestLiveCheck: string | null;
  monthForecastAmountMinor: number;
  confirmedAmountMinor: number;
  todayLiveAmountMinor: number | null;
  todayLiveIncluded: boolean;
  currency: string;
  usageSnapshotCount: number;
  serviceCostBreakdown: OperationsServiceCostRow[];
  usageTrend: OperationsUsageTrendPoint[];
  healthStatus: DashboardHealthStatus;
  riskLevel: DashboardRiskLevel;
  alertCount: number;
  risks: DashboardAlertItem[];
}

export interface OperationsServiceCostRow {
  service: string;
  metric: string;
  currency: string;
  amountMinor: number;
  collectedAt: string;
  sharePercent: number;
}

export interface OperationsUsageTrendPoint {
  date: string;
  providerKey: ProviderKey;
  displayName: string;
  metric: string;
  unit: string;
  value: number;
  sampleCount: number;
  latestCollectedAt: string;
}

export interface OperationsProviderConnection extends Omit<OperationsProvider, "connections" | "risks"> {
  providerDisplayName: string;
  connectionId: string;
  connectionLabel: string;
  risks: DashboardAlertItem[];
}

export interface ReadOperationsDashboardOptions extends ReadDashboardSnapshotOptions {
  env?: Record<string, string | undefined>;
  connections?: ConnectionsStatusPayload;
  exchangeRate?: ExchangeRateResult;
  liveToday?: LiveTodaySnapshot;
  localAiCliStatus?: LocalAiCliStatusPayload;
  notificationPreferences?: NotificationPreferences;
}

export async function readOperationsDashboard(
  options: ReadOperationsDashboardOptions = {},
): Promise<OperationsDashboard> {
  const snapshot = await readDashboardSnapshot(options);
  const env = options.env ?? process.env;
  const timezone = resolveDashboardTimezone(env);
  const now = options.now?.() ?? new Date();
  const localAiCliStatus = options.localAiCliStatus ?? await readLocalAiCliStatus({
    env,
    now: () => now,
  });
  const connections = options.connections ?? await readConnectionsStatus({
    env,
    localAiCliStatus,
    now: () => now,
  });
  const notificationPreferences = options.notificationPreferences ?? await readNotificationPreferencesFile({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    env,
  });
  const exchangeRate = options.exchangeRate ?? await readExchangeRate({
    env,
    now: () => now,
    requestedCurrency: notificationPreferences.dashboard.budget.currency,
    sourceCurrency: snapshot.summary.currency,
  });
  const liveToday = options.liveToday ?? await readLiveTodaySnapshot({
    env,
    connections,
    localAiCliStatus,
    now: () => now,
    timezone,
  });

  return buildOperationsDashboard(snapshot, {
    connections,
    env,
    exchangeRate,
    liveToday,
    notificationPreferences,
    now,
    timezone,
  });
}

export function buildOperationsDashboard(
  snapshot: DashboardSnapshot,
  options: {
    connections?: ConnectionsStatusPayload;
    env: Record<string, string | undefined>;
    exchangeRate?: ExchangeRateResult;
    liveToday?: LiveTodaySnapshot;
    notificationPreferences?: NotificationPreferences;
    now: Date;
    timezone: string;
  },
): OperationsDashboard {
  const config = loadMoneySirenConfig(options.env);
  const conversion = buildCurrencyConversion(
    snapshot.summary.currency,
    options.notificationPreferences?.dashboard.budget.currency ?? snapshot.summary.currency,
    options.exchangeRate,
    options.now,
  );
  const providers = CONNECTABLE_PROVIDER_KEYS.map((providerKey) => {
    const catalog = findAvailableProvider(providerKey);
    const row = snapshot.providers.find((provider) => provider.providerKey === providerKey);
    const providerConfig = config.providers[providerKey];
    const connection = options.connections?.providers.find((item) => item.providerKey === providerKey);
    const liveItems = options.liveToday?.providers.filter((item) => item.providerKey === providerKey) ?? [];
    const liveSummary = summarizeProviderLive(
      liveItems,
      connection?.connectionState ?? (providerConfig.configured ? "env_configured" : "not_configured"),
      catalog?.liveGranularity ?? "unavailable",
      row?.currency ?? snapshot.summary.currency,
    );
    const connectionState = connection?.connectionState ?? (providerConfig.configured ? "env_configured" : "not_configured");
    const localUsageCollectedAt = localUsageCollectionTime(providerKey, liveSummary);
    const canonicalFreshness = localUsageCollectedAt === null
      ? summarizeCanonicalFreshness(row, options.now, options.timezone)
      : summarizeCanonicalFreshnessFromTimestamp(localUsageCollectedAt, options.now, options.timezone);
    const risks = snapshot.alerts.filter((alert) => alert.providerKey === providerKey);
    const usageTrend = buildUsageTrend(snapshot.usage.dailyMetrics, providerKey, conversion);
    const monthForecast = convertAmountMinorForDisplay(
      row?.estimatedAmountMinor ?? 0,
      row?.currency ?? snapshot.summary.currency,
      conversion,
    );
    const confirmed = convertAmountMinorForDisplay(
      row?.billingAmountMinor ?? 0,
      row?.currency ?? snapshot.summary.currency,
      conversion,
    );
    const todayLiveSource = liveTodayDisplaySource(liveSummary, catalog?.liveGranularity, row);
    const todayLive = todayLiveSource === null
      ? null
      : convertAmountMinorForDisplay(todayLiveSource.amountMinor, todayLiveSource.currency, conversion);

    return {
      providerKey,
      displayName: row?.displayName ?? catalog?.name ?? providerKey,
      connections: connection?.connections ?? [],
      connectionState,
      credentialSource: connection?.credentialSource ?? (connectionState === "env_configured" ? "env" : "none"),
      readOnlyTestState: connection?.readOnlyTestState ?? connectionState,
      emergencyAccessState: connection?.emergencyAccessState ?? "emergency_planned",
      credentialStore: connection?.credentialStore ?? defaultCredentialStoreStatus(),
      authMethod: connection?.authMethod ?? catalog?.authMethods.join(" / ") ?? "Unknown",
      credentialRequirements: connection?.credentialRequirements ?? [],
      requiredEnvKeys: connection?.requiredEnvKeys ?? providerConfig.requiredEnvKeys,
      configuredEnvKeys: connection?.configuredEnvKeys ?? providerConfig.configuredEnvKeys,
      missingEnvKeys: connection?.missingEnvKeys ?? providerConfig.missingEnvKeys,
      setupLinks: catalog?.setupLinks ?? [],
      canonicalFreshness,
      liveFreshness: liveSummary.freshness,
      liveGranularity: catalog?.liveGranularity ?? "unavailable",
      liveConfidence: liveSummary.confidence,
      currentUsageSummary: liveSummary.usageSummary,
      latestCanonicalSync: row?.latestCollectedAt ?? localUsageCollectedAt,
      latestLiveCheck: liveSummary.checkedAt,
      monthForecastAmountMinor: monthForecast.amountMinor,
      confirmedAmountMinor: confirmed.amountMinor,
      todayLiveAmountMinor: todayLive?.amountMinor ?? null,
      todayLiveIncluded: liveSummary.included,
      currency: todayLive?.currency ?? monthForecast.currency,
      usageSnapshotCount: row?.usageSnapshotCount ?? 0,
      serviceCostBreakdown: buildServiceCostBreakdown(snapshot.usage.latestServiceMetrics, providerKey, conversion),
      usageTrend,
      healthStatus: row?.healthStatus ?? (localUsageCollectedAt === null ? "unknown" : "ok"),
      riskLevel: row?.riskLevel ?? (localUsageCollectedAt === null ? "warning" : "low"),
      alertCount: row?.alertCount ?? 0,
      risks,
    } satisfies OperationsProvider;
  });
  const displayProviders = mergeCodexDisplayProviders(providers);
  const visibleProviders = displayProviders.filter(isVisibleProvider);
  const visibleConnections = displayProviders.flatMap((provider) =>
    buildProviderConnectionRows(provider, options.liveToday?.providers ?? [], conversion)
  );
  const usageTrend = visibleProviders.flatMap((provider) => provider.usageTrend);
  const canonicalCoverageDate = latestDateKey(
    visibleProviders.map((provider) => provider.latestCanonicalSync).filter((value): value is string => value !== null),
    options.timezone,
  );
  const includedLiveProviders = visibleProviders.filter((provider) =>
    provider.todayLiveIncluded &&
    provider.todayLiveAmountMinor !== null &&
    provider.currency === conversion.displayCurrency
  );
  const todayLiveAmountMinor = sum(includedLiveProviders.map((provider) => provider.todayLiveAmountMinor ?? 0));
  const remainingDays = remainingDaysInMonth(options.now, options.timezone);
  const confirmedThroughYesterdayAmountMinor = sum(
    visibleProviders
      .filter((provider) => provider.currency === conversion.displayCurrency)
      .map((provider) => provider.confirmedAmountMinor),
  );
  const projectedRemainingDays = projectedRemainingAmountMinor(
    confirmedThroughYesterdayAmountMinor,
    options.now,
    options.timezone,
    remainingDays,
  );
  const monthForecastAmountMinor =
    confirmedThroughYesterdayAmountMinor + todayLiveAmountMinor + projectedRemainingDays;
  const budget = buildBudgetStatus(
    options.notificationPreferences?.dashboard.budget,
    monthForecastAmountMinor,
    conversion.displayCurrency,
  );
  const visibleProviderKeys = new Set<string>(visibleProviders.map((provider) => provider.providerKey));

  return {
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    database: snapshot.database,
    timezone: options.timezone,
    summary: {
      currency: conversion.displayCurrency,
      sourceCurrency: conversion.sourceCurrency,
      exchangeRate: conversion.exchangeRate,
      monthForecastAmountMinor,
      confirmedThroughYesterdayAmountMinor,
      todayLiveAmountMinor: includedLiveProviders.length === 0 ? null : todayLiveAmountMinor,
      todayLiveIncludedProviderCount: includedLiveProviders.length,
      todayLiveExcludedProviderCount: visibleProviders.length - includedLiveProviders.length,
      providersNeedingAttention: visibleProviders.filter(providerNeedsAttention).length,
      canonicalCoverageDate,
      remainingDaysInMonth: remainingDays,
      budget,
    },
    providers: displayProviders,
    visibleProviders,
    visibleConnections,
    usageTrend,
    displayPreferences: {
      localCliMetricKeys: [
        ...(options.notificationPreferences?.dashboard.localCliMetricKeys ??
          DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS),
      ],
      widgetLayouts: options.notificationPreferences?.dashboard.widgetLayouts ??
        DEFAULT_NOTIFICATION_PREFERENCES.dashboard.widgetLayouts,
    },
    risks: snapshot.alerts.filter((alert) =>
      alert.providerKey !== null && visibleProviderKeys.has(alert.providerKey)
    ),
  };
}

function mergeCodexDisplayProviders(providers: OperationsProvider[]): OperationsProvider[] {
  const appIndex = providers.findIndex((provider) => provider.providerKey === CODEX_APP_PROVIDER_KEY);
  const cliIndex = providers.findIndex((provider) => provider.providerKey === CODEX_CLI_PROVIDER_KEY);

  if (appIndex < 0 || cliIndex < 0) {
    return providers;
  }

  const appProvider = providers[appIndex];
  const cliProvider = providers[cliIndex];

  if (appProvider === undefined || cliProvider === undefined || !isVisibleProvider(appProvider) || !isVisibleProvider(cliProvider)) {
    return providers;
  }

  const primary = pickCodexPrimaryProvider(appProvider, cliProvider);
  const secondary = primary === appProvider ? cliProvider : appProvider;
  const primaryIndex = primary === appProvider ? appIndex : cliIndex;
  const secondaryIndex = secondary === appProvider ? appIndex : cliIndex;
  const merged = mergeCodexProviderRows(primary, secondary);

  return providers.flatMap((provider, index) => {
    if (index === secondaryIndex) {
      return [];
    }

    return index === primaryIndex ? [merged] : [provider];
  });
}

function pickCodexPrimaryProvider(appProvider: OperationsProvider, cliProvider: OperationsProvider): OperationsProvider {
  if (appProvider.currentUsageSummary !== null) {
    return appProvider;
  }

  if (cliProvider.currentUsageSummary !== null) {
    return cliProvider;
  }

  return appProvider.latestLiveCheck !== null ? appProvider : cliProvider;
}

function mergeCodexProviderRows(primary: OperationsProvider, secondary: OperationsProvider): OperationsProvider {
  const currency = singleCurrency([primary.currency, secondary.currency]) ?? primary.currency;
  const canSumAmounts = primary.currency === currency && secondary.currency === currency;
  const todayLiveAmountMinor = primary.todayLiveAmountMinor === null && secondary.todayLiveAmountMinor === null
    ? null
    : canSumAmounts
      ? (primary.todayLiveAmountMinor ?? 0) + (secondary.todayLiveAmountMinor ?? 0)
      : primary.todayLiveAmountMinor;

  return {
    ...primary,
    displayName: CODEX_DISPLAY_NAME,
    connections: uniqueConnections([...primary.connections, ...secondary.connections]),
    connectionState: summarizeConnectionStates([primary.connectionState, secondary.connectionState]),
    credentialSource: credentialSourceForState(summarizeConnectionStates([primary.connectionState, secondary.connectionState])),
    readOnlyTestState: summarizeConnectionStates([primary.readOnlyTestState, secondary.readOnlyTestState]),
    credentialStore: summarizeCredentialStores(primary.credentialStore, secondary.credentialStore),
    authMethod: uniqueTexts([primary.authMethod, secondary.authMethod]).join(" / "),
    credentialRequirements: uniqueTexts([...primary.credentialRequirements, ...secondary.credentialRequirements]),
    requiredEnvKeys: uniqueTexts([...primary.requiredEnvKeys, ...secondary.requiredEnvKeys]),
    configuredEnvKeys: uniqueTexts([...primary.configuredEnvKeys, ...secondary.configuredEnvKeys]),
    missingEnvKeys: uniqueTexts([...primary.missingEnvKeys, ...secondary.missingEnvKeys]),
    setupLinks: uniqueSetupLinks([...primary.setupLinks, ...secondary.setupLinks]),
    canonicalFreshness: summarizeCanonicalFreshnessValues([primary.canonicalFreshness, secondary.canonicalFreshness]),
    liveFreshness: summarizeLiveFreshnessValues([primary.liveFreshness, secondary.liveFreshness]),
    liveConfidence: highestConfidence([primary.liveConfidence, secondary.liveConfidence]),
    currentUsageSummary: mergeCodexUsageSummary([primary.currentUsageSummary, secondary.currentUsageSummary]),
    latestCanonicalSync: latestIso([primary.latestCanonicalSync, secondary.latestCanonicalSync].filter((value): value is string => value !== null)),
    latestLiveCheck: latestIso([primary.latestLiveCheck, secondary.latestLiveCheck].filter((value): value is string => value !== null)),
    monthForecastAmountMinor: canSumAmounts
      ? primary.monthForecastAmountMinor + secondary.monthForecastAmountMinor
      : primary.monthForecastAmountMinor,
    confirmedAmountMinor: canSumAmounts
      ? primary.confirmedAmountMinor + secondary.confirmedAmountMinor
      : primary.confirmedAmountMinor,
    todayLiveAmountMinor,
    todayLiveIncluded: primary.todayLiveIncluded || secondary.todayLiveIncluded,
    currency,
    usageSnapshotCount: primary.usageSnapshotCount + secondary.usageSnapshotCount,
    serviceCostBreakdown: [...primary.serviceCostBreakdown, ...secondary.serviceCostBreakdown],
    usageTrend: [...primary.usageTrend, ...secondary.usageTrend].map((point) => ({
      ...point,
      providerKey: primary.providerKey,
      displayName: CODEX_DISPLAY_NAME,
    })),
    healthStatus: summarizeHealthStatuses([primary.healthStatus, secondary.healthStatus]),
    riskLevel: summarizeRiskLevels([primary.riskLevel, secondary.riskLevel]),
    alertCount: primary.alertCount + secondary.alertCount,
    risks: [...primary.risks, ...secondary.risks],
  };
}

function uniqueConnections(
  connections: readonly ProviderCredentialConnectionStatus[],
): ProviderCredentialConnectionStatus[] {
  const byId = new Map<string, ProviderCredentialConnectionStatus>();

  for (const connection of connections) {
    if (!byId.has(connection.connectionId)) {
      byId.set(connection.connectionId, connection);
    }
  }

  return [...byId.values()];
}

function uniqueSetupLinks(links: readonly ProviderSetupLink[]): ProviderSetupLink[] {
  const byKey = new Map<string, ProviderSetupLink>();

  for (const link of links) {
    byKey.set(`${link.href}:${link.label}`, link);
  }

  return [...byKey.values()];
}

function uniqueTexts(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function summarizeConnectionStates(values: readonly ConnectionState[]): ConnectionState {
  const order: readonly ConnectionState[] = [
    "read_only_ready",
    "env_configured",
    "credential_store_configured",
    "oauth_connected",
    "locked",
    "expired",
    "invalid",
    "not_configured",
  ];

  return order.find((value) => values.includes(value)) ?? "not_configured";
}

function credentialSourceForState(state: ConnectionState): OperationsProvider["credentialSource"] {
  if (state === "env_configured" || state === "read_only_ready") {
    return "env";
  }

  if (state === "credential_store_configured") {
    return "credential_store";
  }

  if (state === "oauth_connected") {
    return "oauth";
  }

  if (state === "locked") {
    return "locked";
  }

  return "none";
}

function defaultCredentialStoreStatus(): OperationsCredentialStore {
  return {
    backend: "memory",
    storeState: "ready",
    readOnlyState: "not_configured",
    emergencyState: "not_configured",
  };
}

function summarizeCredentialStores(
  primary: OperationsCredentialStore,
  secondary: OperationsCredentialStore,
): OperationsCredentialStore {
  return {
    backend: primary.backend,
    storeState: summarizeCredentialStoreStates([primary.storeState, secondary.storeState]),
    readOnlyState: summarizeCredentialConnectionStates([primary.readOnlyState, secondary.readOnlyState]),
    emergencyState: summarizeCredentialConnectionStates([primary.emergencyState, secondary.emergencyState]),
  };
}

function summarizeCredentialStoreStates(
  values: readonly OperationsCredentialStore["storeState"][],
): OperationsCredentialStore["storeState"] {
  if (values.includes("ready")) {
    return "ready";
  }

  return values.includes("locked") ? "locked" : "unavailable";
}

function summarizeCredentialConnectionStates(
  values: readonly OperationsCredentialStore["readOnlyState"][],
): OperationsCredentialStore["readOnlyState"] {
  const order: readonly OperationsCredentialStore["readOnlyState"][] = [
    "oauth_connected",
    "credential_store_configured",
    "locked",
    "expired",
    "invalid",
    "not_configured",
  ];

  return order.find((value) => values.includes(value)) ?? "not_configured";
}

function summarizeCanonicalFreshnessValues(values: readonly CanonicalFreshness[]): CanonicalFreshness {
  if (values.includes("fresh")) {
    return "fresh";
  }

  return values.includes("stale") ? "stale" : "missing";
}

function summarizeLiveFreshnessValues(values: readonly LiveFreshness[]): LiveFreshness {
  if (values.includes("live")) {
    return "live";
  }

  const order: readonly LiveFreshness[] = ["error", "locked", "stale", "unavailable", "not_configured"];

  return order.find((value) => values.includes(value)) ?? "unavailable";
}

function summarizeHealthStatuses(values: readonly DashboardHealthStatus[]): DashboardHealthStatus {
  if (values.includes("down")) {
    return "down";
  }

  if (values.includes("degraded")) {
    return "degraded";
  }

  if (values.includes("unknown")) {
    return "unknown";
  }

  return "ok";
}

function summarizeRiskLevels(values: readonly DashboardRiskLevel[]): DashboardRiskLevel {
  if (values.includes("critical")) {
    return "critical";
  }

  return values.includes("warning") ? "warning" : "low";
}

function mergeCodexUsageSummary(
  summaries: readonly (LiveTodayUsageSummary | null)[],
): LiveTodayUsageSummary | null {
  const available = summaries.filter((summary): summary is LiveTodayUsageSummary => summary !== null);

  if (available.length === 0) {
    return null;
  }

  return {
    kind: "llm_subscription",
    period: "current_month",
    metrics: mergeCodexUsageMetrics(available),
    topServices: uniqueTexts(available.flatMap((summary) => summary.topServices)),
  };
}

function mergeCodexUsageMetrics(summaries: readonly LiveTodayUsageSummary[]): LiveTodayUsageMetric[] {
  const metrics: LiveTodayUsageMetric[] = [];
  const selectedMetricKeys = new Set<string>();
  const selectedCreditMetricKeys = new Set<string>();

  for (const summary of summaries) {
    for (const metric of summary.metrics) {
      if (metric.key === "usage_reset_credit" || metric.key === "usage_reset_credit_estimate") {
        const metricKey = resetCreditMetricIdentity(metric);

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

function resetCreditMetricIdentity(metric: LiveTodayUsageMetric): string {
  return [
    metric.key,
    metric.itemKey ?? "",
    metric.resetAt ?? "",
    metric.resetAtLatest ?? "",
    metric.source ?? "",
    metric.value,
  ].join(":");
}

export function resolveDashboardTimezone(env: Record<string, string | undefined> = process.env): string {
  const configured = env.MONEYSIREN_TIMEZONE?.trim();

  if (configured !== undefined && configured.length > 0 && isValidTimeZone(configured)) {
    return configured;
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function summarizeCanonicalFreshness(
  row: DashboardProviderRow | undefined,
  now: Date,
  timezone: string,
): CanonicalFreshness {
  if (row?.latestCollectedAt === undefined || row.latestCollectedAt === null) {
    return "missing";
  }

  return summarizeCanonicalFreshnessFromTimestamp(row.latestCollectedAt, now, timezone);
}

function summarizeCanonicalFreshnessFromTimestamp(
  collectedAt: string,
  now: Date,
  timezone: string,
): CanonicalFreshness {
  const latest = dateKeyInTimezone(new Date(collectedAt), timezone);
  const yesterday = dateKeyInTimezone(new Date(now.getTime() - 24 * 60 * 60 * 1000), timezone);

  return latest >= yesterday ? "fresh" : "stale";
}

function localUsageCollectionTime(
  providerKey: ProviderKey,
  liveSummary: Pick<ReturnType<typeof summarizeProviderLive>, "checkedAt" | "usageSummary">,
): string | null {
  if (!isLocalProviderKey(providerKey) || liveSummary.usageSummary === null) {
    return null;
  }

  return liveSummary.checkedAt;
}

function isLocalProviderKey(providerKey: ProviderKey): boolean {
  return (LOCAL_PROVIDER_KEYS as readonly string[]).includes(providerKey);
}

function buildServiceCostBreakdown(
  metrics: readonly DashboardUsageMetric[],
  providerKey: ProviderKey,
  conversion: CurrencyConversion,
): OperationsServiceCostRow[] {
  const costRows = metrics
    .filter((metric) => metric.providerKey === providerKey && metric.metric === "unblended_cost")
    .map((metric) => {
      const converted = convertAmountMinorForDisplay(
        majorAmountToMinorUnits(metric.value),
        metric.unit,
        conversion,
      );

      return {
        service: metric.service,
        metric: metric.metric,
        currency: converted.currency,
        amountMinor: converted.amountMinor,
        collectedAt: metric.collectedAt,
        sharePercent: 0,
      };
    });
  const totalByCurrency = new Map<string, number>();

  for (const row of costRows) {
    totalByCurrency.set(row.currency, (totalByCurrency.get(row.currency) ?? 0) + row.amountMinor);
  }

  return costRows
    .map((row) => {
      const currencyTotal = totalByCurrency.get(row.currency) ?? 0;

      return {
        ...row,
        sharePercent: currencyTotal > 0 ? (row.amountMinor / currencyTotal) * 100 : 0,
      };
    })
    .sort((first, second) => {
      const amountOrder = second.amountMinor - first.amountMinor;

      if (amountOrder !== 0) {
        return amountOrder;
      }

      return first.service.localeCompare(second.service);
    });
}

function majorAmountToMinorUnits(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

function summarizeLiveFreshness(connectionState: ConnectionState, liveGranularity: LiveGranularity): LiveFreshness {
  if (connectionState === "locked") {
    return "locked";
  }

  if (connectionState === "not_configured") {
    return "not_configured";
  }

  if (connectionState === "invalid" || connectionState === "expired") {
    return "error";
  }

  if (liveGranularity === "unavailable") {
    return "unavailable";
  }

  return "stale";
}

function summarizeProviderLive(
  liveItems: readonly LiveTodayProviderSnapshot[],
  connectionState: ConnectionState,
  liveGranularity: LiveGranularity,
  fallbackCurrency: string,
): {
  freshness: LiveFreshness;
  confidence: OperationsProvider["liveConfidence"];
  usageSummary: LiveTodayUsageSummary | null;
  checkedAt: string | null;
  todayLiveAmountMinor: number | null;
  included: boolean;
  currency: string;
} {
  if (liveItems.length === 0) {
    return {
      freshness: summarizeLiveFreshness(connectionState, liveGranularity),
      confidence: "none",
      usageSummary: null,
      checkedAt: null,
      todayLiveAmountMinor: null,
      included: false,
      currency: fallbackCurrency,
    };
  }

  const includedItems = liveItems.filter((item) => item.included && item.todayLiveAmountMinor !== null);
  const amountItems = liveItems.filter((item) => item.todayLiveAmountMinor !== null);
  const includedCurrency = singleCurrency(includedItems.map((item) => item.currency));
  const amountCurrency = singleCurrency(amountItems.map((item) => item.currency));
  const currency = includedCurrency ?? amountCurrency ?? fallbackCurrency;
  const canSumLive = includedItems.length > 0 && includedItems.every((item) => item.currency === currency);
  const canDisplayLive = amountItems.length > 0 && amountItems.every((item) => item.currency === currency);

  return {
    freshness: summarizeLiveItemsFreshness(liveItems, connectionState, liveGranularity),
    confidence: highestConfidence(liveItems.map((item) => item.confidence)),
    usageSummary: liveItems.find((item) => item.usageSummary !== undefined)?.usageSummary ?? null,
    checkedAt: latestIso(liveItems.map((item) => item.checkedAt).filter((value): value is string => value !== null)),
    todayLiveAmountMinor: canSumLive
      ? sum(includedItems.map((item) => item.todayLiveAmountMinor ?? 0))
      : canDisplayLive
        ? sum(amountItems.map((item) => item.todayLiveAmountMinor ?? 0))
        : null,
    included: canSumLive,
    currency,
  };
}

function liveTodayDisplaySource(
  liveSummary: {
    todayLiveAmountMinor: number | null;
    currency: string;
  },
  liveGranularity: LiveGranularity | undefined,
  row: DashboardProviderRow | undefined,
): { amountMinor: number; currency: string } | null {
  if (liveSummary.todayLiveAmountMinor !== null) {
    return {
      amountMinor: liveSummary.todayLiveAmountMinor,
      currency: liveSummary.currency,
    };
  }

  if (liveGranularity !== "current_period" || row === undefined) {
    return null;
  }

  return {
    amountMinor: row.estimatedAmountMinor,
    currency: row.currency,
  };
}

function summarizeLiveItemsFreshness(
  liveItems: readonly LiveTodayProviderSnapshot[],
  connectionState: ConnectionState,
  liveGranularity: LiveGranularity,
): LiveFreshness {
  if (liveItems.some((item) => item.freshness === "live")) {
    return "live";
  }

  const ordered: readonly LiveTodayFreshness[] = [
    "error",
    "locked",
    "stale",
    "unavailable",
    "not_configured",
  ];
  const found = ordered.find((freshness) => liveItems.some((item) => item.freshness === freshness));

  return found ?? summarizeLiveFreshness(connectionState, liveGranularity);
}

interface CurrencyConversion {
  sourceCurrency: string;
  requestedCurrency: string;
  displayCurrency: string;
  rate: number;
  canConvert: boolean;
  exchangeRate: OperationsExchangeRateStatus;
}

function buildCurrencyConversion(
  sourceCurrency: string,
  requestedCurrency: string,
  exchangeRate: ExchangeRateResult | undefined,
  now: Date,
): CurrencyConversion {
  const source = normalizeCurrencyCode(sourceCurrency) ?? "USD";
  const requested = normalizeCurrencyCode(requestedCurrency) ?? source;
  const canConvert = requested === source || exchangeRate?.status === "live" || exchangeRate?.status === "identity";
  const displayCurrency = canConvert ? requested : source;
  const rate = requested === source ? 1 : exchangeRate?.rate ?? 1;

  return {
    sourceCurrency: source,
    requestedCurrency: requested,
    displayCurrency,
    rate,
    canConvert,
    exchangeRate: {
      sourceCurrency: source,
      requestedCurrency: requested,
      displayCurrency,
      rate,
      rateDate: requested === source
        ? now.toISOString().slice(0, 10)
        : exchangeRate?.rateDate ?? null,
      fetchedAt: exchangeRate?.fetchedAt ?? now.toISOString(),
      source: requested === source ? "identity" : exchangeRate?.source ?? "frankfurter",
      status: requested === source ? "identity" : exchangeRate?.status ?? "unavailable",
      ...(exchangeRate?.message === undefined ? {} : { message: exchangeRate.message }),
    },
  };
}

function convertAmountMinorForDisplay(
  amountMinor: number,
  currency: string,
  conversion: CurrencyConversion,
): { amountMinor: number; currency: string } {
  const normalizedCurrency = normalizeCurrencyCode(currency);

  if (normalizedCurrency === conversion.displayCurrency) {
    return {
      amountMinor,
      currency: conversion.displayCurrency,
    };
  }

  if (normalizedCurrency === conversion.sourceCurrency && conversion.canConvert) {
    return {
      amountMinor: Math.round(amountMinor * conversion.rate),
      currency: conversion.displayCurrency,
    };
  }

  return {
    amountMinor,
    currency: normalizedCurrency ?? currency,
  };
}

function convertTrendValueForDisplay(
  value: number,
  unit: string,
  conversion: CurrencyConversion,
): { value: number; unit: string } {
  const normalizedUnit = normalizeCurrencyCode(unit);

  if (normalizedUnit === conversion.sourceCurrency && conversion.canConvert) {
    return {
      value: value * conversion.rate,
      unit: conversion.displayCurrency,
    };
  }

  return {
    value,
    unit,
  };
}

function normalizeCurrencyCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function buildProviderConnectionRows(
  provider: OperationsProvider,
  liveItems: readonly LiveTodayProviderSnapshot[],
  conversion: CurrencyConversion,
): OperationsProviderConnection[] {
  const envConnection: ProviderCredentialConnectionStatus[] = provider.connectionState === "env_configured"
    ? [{
        connectionId: "env",
        label: "Environment",
        active: true,
        connectionState: "env_configured" as const,
        credentialSource: "env" as const,
        readOnlyTestState: "env_configured" as const,
        credentialStore: {
          backend: "memory" as const,
          storeState: "ready" as const,
          readOnlyState: "not_configured" as const,
        },
      } satisfies ProviderCredentialConnectionStatus]
    : [];
  const connectionRows = [...envConnection, ...provider.connections].filter(
    (connection) => connection.connectionState !== "not_configured",
  );

  return connectionRows.map((connection) => {
    const live = liveItems.find((item) =>
      item.providerKey === provider.providerKey && item.connectionId === connection.connectionId
    );
    const liveFreshness = live?.freshness ??
      summarizeLiveFreshness(connection.connectionState, provider.liveGranularity);
    const liveAmount = live?.todayLiveAmountMinor === null || live?.todayLiveAmountMinor === undefined
      ? null
      : convertAmountMinorForDisplay(live.todayLiveAmountMinor, live.currency, conversion);
    const fallbackLiveAmount = liveAmount === null &&
      connectionRows.length === 1 &&
      provider.liveGranularity === "current_period" &&
      provider.todayLiveAmountMinor !== null
      ? {
          amountMinor: provider.todayLiveAmountMinor,
          currency: provider.currency,
        }
      : null;
    const displayLiveAmount = liveAmount ?? fallbackLiveAmount;

    return {
      providerKey: provider.providerKey,
      providerDisplayName: provider.displayName,
      connectionId: connection.connectionId,
      connectionLabel: connection.label,
      displayName: `${provider.displayName} / ${connection.label}`,
      connectionState: connection.connectionState,
      credentialSource: connection.credentialSource,
      readOnlyTestState: connection.readOnlyTestState,
      emergencyAccessState: provider.emergencyAccessState,
      credentialStore: provider.credentialStore,
      authMethod: connection.authMethod ?? provider.authMethod,
      credentialRequirements: provider.credentialRequirements,
      requiredEnvKeys: provider.requiredEnvKeys,
      configuredEnvKeys: provider.configuredEnvKeys,
      missingEnvKeys: provider.missingEnvKeys,
      setupLinks: provider.setupLinks,
      canonicalFreshness: "missing",
      liveFreshness,
      liveGranularity: provider.liveGranularity,
      liveConfidence: live?.confidence ?? "none",
      currentUsageSummary: live?.usageSummary ?? null,
      latestCanonicalSync: null,
      latestLiveCheck: live?.checkedAt ?? null,
      monthForecastAmountMinor: displayLiveAmount?.amountMinor ?? 0,
      confirmedAmountMinor: 0,
      todayLiveAmountMinor: displayLiveAmount?.amountMinor ?? null,
      todayLiveIncluded: live?.included ?? false,
      currency: displayLiveAmount?.currency ?? provider.currency,
      usageSnapshotCount: 0,
      serviceCostBreakdown: [],
      usageTrend: [],
      healthStatus: provider.healthStatus,
      riskLevel: provider.riskLevel,
      alertCount: provider.alertCount,
      risks: provider.risks,
    } satisfies OperationsProviderConnection;
  });
}

function buildUsageTrend(
  metrics: readonly DashboardDailyUsageMetric[],
  providerKey: ProviderKey,
  conversion: CurrencyConversion,
): OperationsUsageTrendPoint[] {
  return metrics
    .filter((metric) => metric.providerKey === providerKey)
    .map((metric) => {
      const converted = convertTrendValueForDisplay(metric.value, metric.unit, conversion);

      return {
        date: metric.date,
        providerKey,
        displayName: metric.displayName,
        metric: metric.metric,
        unit: converted.unit,
        value: converted.value,
        sampleCount: metric.sampleCount,
        latestCollectedAt: metric.latestCollectedAt,
      };
    });
}

function highestConfidence(
  values: readonly OperationsProvider["liveConfidence"][],
): OperationsProvider["liveConfidence"] {
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

function singleCurrency(values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  const currencies = new Set(values);

  return currencies.size === 1 ? values[0] ?? null : null;
}

function latestIso(values: readonly string[]): string | null {
  return values.length === 0
    ? null
    : [...values].sort((first, second) => second.localeCompare(first))[0] ?? null;
}

function providerNeedsAttention(provider: OperationsProvider): boolean {
  return (
    provider.canonicalFreshness !== "fresh"
    || provider.liveFreshness !== "live"
    || provider.riskLevel !== "low"
    || provider.healthStatus !== "ok"
  );
}

function buildBudgetStatus(
  budget: DashboardBudgetPreferences | undefined,
  monthForecastAmountMinor: number,
  currency: string,
): OperationsBudgetStatus {
  if (budget?.monthlyBudgetMinor === null || budget?.monthlyBudgetMinor === undefined) {
    return {
      monthlyBudgetMinor: null,
      currency,
      warningPercent: budget?.warningPercent ?? 80,
      criticalPercent: budget?.criticalPercent ?? 100,
      usagePercent: null,
      riskLevel: "low",
      status: "not_configured",
    };
  }

  if (budget.currency !== currency) {
    return {
      monthlyBudgetMinor: budget.monthlyBudgetMinor,
      currency: budget.currency,
      warningPercent: budget.warningPercent,
      criticalPercent: budget.criticalPercent,
      usagePercent: null,
      riskLevel: "warning",
      status: "currency_mismatch",
    };
  }

  const usagePercent = Math.round((monthForecastAmountMinor / budget.monthlyBudgetMinor) * 100);
  const riskLevel =
    usagePercent >= budget.criticalPercent
      ? "critical"
      : usagePercent >= budget.warningPercent
        ? "warning"
        : "low";

  return {
    monthlyBudgetMinor: budget.monthlyBudgetMinor,
    currency: budget.currency,
    warningPercent: budget.warningPercent,
    criticalPercent: budget.criticalPercent,
    usagePercent,
    riskLevel,
    status: riskLevel === "low" ? "ok" : riskLevel,
  };
}

function isVisibleProvider(provider: OperationsProvider): boolean {
  return provider.connectionState !== "not_configured";
}

function latestDateKey(values: readonly string[], timezone: string): string | null {
  if (values.length === 0) {
    return null;
  }

  return values
    .map((value) => dateKeyInTimezone(new Date(value), timezone))
    .sort((first, second) => second.localeCompare(first))[0] ?? null;
}

function remainingDaysInMonth(now: Date, timezone: string): number {
  const parts = datePartsInTimezone(now, timezone);
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();

  return Math.max(lastDay - parts.day, 0);
}

function projectedRemainingAmountMinor(
  confirmedThroughYesterdayAmountMinor: number,
  now: Date,
  timezone: string,
  remainingDays: number,
): number {
  if (confirmedThroughYesterdayAmountMinor <= 0 || remainingDays <= 0) {
    return 0;
  }

  const completedCanonicalDays = Math.max(datePartsInTimezone(now, timezone).day - 1, 1);

  return Math.round((confirmedThroughYesterdayAmountMinor / completedCanonicalDays) * remainingDays);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function dateKeyInTimezone(date: Date, timezone: string): string {
  const parts = datePartsInTimezone(date, timezone);

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function datePartsInTimezone(date: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "1970"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "01"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "01"),
  };
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
