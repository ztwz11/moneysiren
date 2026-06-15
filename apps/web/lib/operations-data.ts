import { loadStackSpendConfig } from "../../../packages/config/src/index";
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
  DashboardSnapshot,
  DashboardUsageMetric,
} from "./dashboard-data";
import { readDashboardSnapshot, type ReadDashboardSnapshotOptions } from "./dashboard-data";
import {
  CONNECTABLE_PROVIDER_KEYS,
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
  type LiveTodayUsageSummary,
} from "./live-today";

export type CanonicalFreshness = "fresh" | "stale" | "missing";
export type LiveFreshness = "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";

export interface OperationsDashboard {
  generatedAt: string;
  source: DashboardSnapshot["source"];
  database: DashboardSnapshot["database"];
  timezone: string;
  summary: OperationsSummary;
  providers: OperationsProvider[];
  visibleProviders: OperationsProvider[];
  visibleConnections: OperationsProviderConnection[];
  risks: DashboardAlertItem[];
}

export interface OperationsSummary {
  currency: string;
  monthForecastAmountMinor: number;
  confirmedThroughYesterdayAmountMinor: number;
  todayLiveAmountMinor: number | null;
  todayLiveIncludedProviderCount: number;
  todayLiveExcludedProviderCount: number;
  providersNeedingAttention: number;
  canonicalCoverageDate: string | null;
  remainingDaysInMonth: number;
}

export interface OperationsProvider {
  providerKey: ProviderKey;
  displayName: string;
  connections: readonly ProviderCredentialConnectionStatus[];
  connectionState: ConnectionState;
  credentialSource: ProviderConnectionStatus["credentialSource"];
  readOnlyTestState: ConnectionState;
  emergencyAccessState: EmergencyAccessState;
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

export interface OperationsProviderConnection extends Omit<OperationsProvider, "connections" | "risks"> {
  providerDisplayName: string;
  connectionId: string;
  connectionLabel: string;
  risks: DashboardAlertItem[];
}

export interface ReadOperationsDashboardOptions extends ReadDashboardSnapshotOptions {
  env?: Record<string, string | undefined>;
  connections?: ConnectionsStatusPayload;
  liveToday?: LiveTodaySnapshot;
}

export async function readOperationsDashboard(
  options: ReadOperationsDashboardOptions = {},
): Promise<OperationsDashboard> {
  const snapshot = await readDashboardSnapshot(options);
  const env = options.env ?? process.env;
  const timezone = resolveDashboardTimezone(env);
  const now = options.now?.() ?? new Date();
  const connections = options.connections ?? await readConnectionsStatus({
    env,
    now: () => now,
  });
  const liveToday = options.liveToday ?? await readLiveTodaySnapshot({
    env,
    connections,
    now: () => now,
    timezone,
  });

  return buildOperationsDashboard(snapshot, {
    connections,
    env,
    liveToday,
    now,
    timezone,
  });
}

export function buildOperationsDashboard(
  snapshot: DashboardSnapshot,
  options: {
    connections?: ConnectionsStatusPayload;
    env: Record<string, string | undefined>;
    liveToday?: LiveTodaySnapshot;
    now: Date;
    timezone: string;
  },
): OperationsDashboard {
  const config = loadStackSpendConfig(options.env);
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
    const canonicalFreshness = summarizeCanonicalFreshness(row, options.now, options.timezone);
    const risks = snapshot.alerts.filter((alert) => alert.providerKey === providerKey);
    const serviceCostBreakdown = buildServiceCostBreakdown(snapshot.usage.latestServiceMetrics, providerKey);

    return {
      providerKey,
      displayName: row?.displayName ?? catalog?.name ?? providerKey,
      connections: connection?.connections ?? [],
      connectionState,
      credentialSource: connection?.credentialSource ?? (connectionState === "env_configured" ? "env" : "none"),
      readOnlyTestState: connection?.readOnlyTestState ?? connectionState,
      emergencyAccessState: "emergency_planned",
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
      latestCanonicalSync: row?.latestCollectedAt ?? null,
      latestLiveCheck: liveSummary.checkedAt,
      monthForecastAmountMinor: row?.estimatedAmountMinor ?? 0,
      confirmedAmountMinor: row?.billingAmountMinor ?? 0,
      todayLiveAmountMinor: liveSummary.todayLiveAmountMinor,
      todayLiveIncluded: liveSummary.included,
      currency: liveSummary.currency,
      usageSnapshotCount: row?.usageSnapshotCount ?? 0,
      serviceCostBreakdown,
      healthStatus: row?.healthStatus ?? "unknown",
      riskLevel: row?.riskLevel ?? "warning",
      alertCount: row?.alertCount ?? 0,
      risks,
    } satisfies OperationsProvider;
  });
  const visibleProviders = providers.filter(isVisibleProvider);
  const visibleConnections = providers.flatMap((provider) =>
    buildProviderConnectionRows(provider, options.liveToday?.providers ?? [], snapshot.summary.currency)
  );
  const canonicalCoverageDate = latestDateKey(
    visibleProviders.map((provider) => provider.latestCanonicalSync).filter((value): value is string => value !== null),
    options.timezone,
  );
  const includedLiveProviders = visibleProviders.filter((provider) =>
    provider.todayLiveIncluded &&
    provider.todayLiveAmountMinor !== null &&
    provider.currency === snapshot.summary.currency
  );
  const todayLiveAmountMinor = sum(includedLiveProviders.map((provider) => provider.todayLiveAmountMinor ?? 0));
  const remainingDays = remainingDaysInMonth(options.now, options.timezone);
  const confirmedThroughYesterdayAmountMinor = sum(
    visibleProviders
      .filter((provider) => provider.currency === snapshot.summary.currency)
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
  const visibleProviderKeys = new Set<string>(visibleProviders.map((provider) => provider.providerKey));

  return {
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    database: snapshot.database,
    timezone: options.timezone,
    summary: {
      currency: snapshot.summary.currency,
      monthForecastAmountMinor,
      confirmedThroughYesterdayAmountMinor,
      todayLiveAmountMinor: includedLiveProviders.length === 0 ? null : todayLiveAmountMinor,
      todayLiveIncludedProviderCount: includedLiveProviders.length,
      todayLiveExcludedProviderCount: visibleProviders.length - includedLiveProviders.length,
      providersNeedingAttention: visibleProviders.filter(providerNeedsAttention).length,
      canonicalCoverageDate,
      remainingDaysInMonth: remainingDays,
    },
    providers,
    visibleProviders,
    visibleConnections,
    risks: snapshot.alerts.filter((alert) =>
      alert.providerKey !== null && visibleProviderKeys.has(alert.providerKey)
    ),
  };
}

export function resolveDashboardTimezone(env: Record<string, string | undefined> = process.env): string {
  const configured = env.STACKSPEND_TIMEZONE?.trim();

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

  const latest = dateKeyInTimezone(new Date(row.latestCollectedAt), timezone);
  const yesterday = dateKeyInTimezone(new Date(now.getTime() - 24 * 60 * 60 * 1000), timezone);

  return latest >= yesterday ? "fresh" : "stale";
}

function buildServiceCostBreakdown(
  metrics: readonly DashboardUsageMetric[],
  providerKey: ProviderKey,
): OperationsServiceCostRow[] {
  const costRows = metrics
    .filter((metric) => metric.providerKey === providerKey && metric.metric === "unblended_cost")
    .map((metric) => ({
      service: metric.service,
      metric: metric.metric,
      currency: metric.unit,
      amountMinor: majorAmountToMinorUnits(metric.value),
      collectedAt: metric.collectedAt,
      sharePercent: 0,
    }));
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
  const currency = singleCurrency(includedItems.map((item) => item.currency)) ?? fallbackCurrency;
  const canSumLive = includedItems.length > 0 && includedItems.every((item) => item.currency === currency);

  return {
    freshness: summarizeLiveItemsFreshness(liveItems, connectionState, liveGranularity),
    confidence: highestConfidence(liveItems.map((item) => item.confidence)),
    usageSummary: liveItems.find((item) => item.usageSummary !== undefined)?.usageSummary ?? null,
    checkedAt: latestIso(liveItems.map((item) => item.checkedAt).filter((value): value is string => value !== null)),
    todayLiveAmountMinor: canSumLive ? sum(includedItems.map((item) => item.todayLiveAmountMinor ?? 0)) : null,
    included: canSumLive,
    currency,
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

function buildProviderConnectionRows(
  provider: OperationsProvider,
  liveItems: readonly LiveTodayProviderSnapshot[],
  fallbackCurrency: string,
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
      monthForecastAmountMinor: live?.todayLiveAmountMinor ?? 0,
      confirmedAmountMinor: 0,
      todayLiveAmountMinor: live?.todayLiveAmountMinor ?? null,
      todayLiveIncluded: live?.included ?? false,
      currency: live?.currency ?? fallbackCurrency,
      usageSnapshotCount: 0,
      serviceCostBreakdown: [],
      healthStatus: provider.healthStatus,
      riskLevel: provider.riskLevel,
      alertCount: provider.alertCount,
      risks: provider.risks,
    } satisfies OperationsProviderConnection;
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
