import { access } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import {
  readLocalStore,
  type LocalAlertRecord,
  type LocalServiceHealthSnapshotRecord,
  type LocalStore,
} from "../../../packages/db/src/index.js";

const DEFAULT_DASHBOARD_DB_PATH = ".stackspend/stackspend.sqlite";
const DEFAULT_CURRENCY = "USD";
const SENSITIVE_TEXT_PATTERN =
  /(sk-[A-Za-z0-9_-]+|hooks\.slack[^\s]*|acct_[A-Za-z0-9_-]+|project_[A-Za-z0-9_-]+|invoice_[A-Za-z0-9_-]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

export type DashboardSource = "sqlite" | "empty";
export type DashboardHealthStatus = "ok" | "degraded" | "down" | "unknown";
export type DashboardRiskLevel = "low" | "warning" | "critical";
export type DashboardRiskSeverity = "info" | "warning" | "critical";

export interface DashboardSnapshot {
  generatedAt: string;
  source: DashboardSource;
  database: {
    available: boolean;
    reason: "ok" | "missing";
  };
  summary: DashboardSummary;
  providers: DashboardProviderRow[];
  usage: DashboardUsageSummary;
  risks: DashboardRiskItem[];
  health: DashboardHealthItem[];
  alerts: DashboardAlertItem[];
}

export interface DashboardSummary {
  providerCount: number;
  totalEstimatedAmountMinor: number;
  totalBillingAmountMinor: number;
  currency: string;
  usageSnapshotCount: number;
  costEstimateCount: number;
  alertCount: number;
  criticalAlertCount: number;
  healthStatus: DashboardHealthStatus;
}

export interface DashboardProviderRow {
  providerKey: string;
  displayName: string;
  estimatedAmountMinor: number;
  billingAmountMinor: number;
  currency: string;
  usageSnapshotCount: number;
  billingSnapshotCount: number;
  costEstimateCount: number;
  healthStatus: DashboardHealthStatus;
  alertCount: number;
  riskLevel: DashboardRiskLevel;
  latestCollectedAt: string | null;
}

export interface DashboardUsageSummary {
  snapshotCount: number;
  topMetrics: DashboardUsageMetric[];
}

export interface DashboardUsageMetric {
  providerKey: string;
  displayName: string;
  service: string;
  metric: string;
  unit: string;
  value: number;
  collectedAt: string;
}

export interface DashboardRiskItem {
  providerKey: string | null;
  displayName: string | null;
  severity: DashboardRiskSeverity;
  title: string;
  message: string;
  createdAt: string;
}

export interface DashboardHealthItem {
  providerKey: string;
  displayName: string;
  service: string;
  region: string | null;
  status: DashboardHealthStatus;
  message: string | null;
  collectedAt: string;
}

export interface DashboardAlertItem {
  providerKey: string | null;
  displayName: string | null;
  severity: DashboardRiskSeverity;
  category: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface BuildDashboardSnapshotOptions {
  generatedAt: string;
}

export interface ReadDashboardSnapshotOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  fileExists?: (path: string) => Promise<boolean>;
  readStore?: (options: { dbPath: string }) => Promise<LocalStore>;
}

export async function readDashboardSnapshot(options: ReadDashboardSnapshotOptions = {}): Promise<DashboardSnapshot> {
  const now = options.now ?? (() => new Date());
  const generatedAt = now().toISOString();
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const dbPath = resolveDashboardDbPath(cwd, env.STACKSPEND_DB_PATH);
  const exists = await (options.fileExists ?? pathExists)(dbPath);

  if (!exists) {
    return createEmptyDashboardSnapshot(generatedAt);
  }

  const store = await (options.readStore ?? readLocalStore)({ dbPath });

  return buildDashboardSnapshot(store, { generatedAt });
}

export function buildDashboardSnapshot(
  store: LocalStore,
  options: BuildDashboardSnapshotOptions,
): DashboardSnapshot {
  const providerDisplayNames = new Map(store.providers.map((provider) => [provider.key, safeText(provider.displayName)]));
  const providerRows = store.providers.map((provider): DashboardProviderRow => {
    const usageSnapshots = store.usageSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const billingSnapshots = store.billingSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const serviceHealthSnapshots = store.serviceHealthSnapshots.filter(
      (snapshot) => snapshot.providerKey === provider.key,
    );
    const costEstimates = store.costEstimates.filter((snapshot) => snapshot.providerKey === provider.key);
    const alerts = store.alerts.filter((alert) => alert.providerKey === provider.key);
    const healthStatus = summarizeHealth(serviceHealthSnapshots.map((snapshot) => snapshot.status));
    const latestCollectedAt = latestIso([
      ...usageSnapshots.map((snapshot) => snapshot.collectedAt),
      ...billingSnapshots.map((snapshot) => snapshot.collectedAt),
      ...serviceHealthSnapshots.map((snapshot) => snapshot.collectedAt),
      ...costEstimates.map((snapshot) => snapshot.collectedAt),
    ]);

    return {
      providerKey: safeText(provider.key),
      displayName: safeText(provider.displayName),
      estimatedAmountMinor: sum(costEstimates.map((snapshot) => snapshot.estimatedAmountMinor)),
      billingAmountMinor: sum(billingSnapshots.map((snapshot) => snapshot.amountMinor)),
      currency: summarizeCurrency([
        ...costEstimates.map((snapshot) => snapshot.currency),
        ...billingSnapshots.map((snapshot) => snapshot.currency),
      ]),
      usageSnapshotCount: usageSnapshots.length,
      billingSnapshotCount: billingSnapshots.length,
      costEstimateCount: costEstimates.length,
      healthStatus,
      alertCount: alerts.length,
      riskLevel: summarizeProviderRisk(
        alerts.map((alert) => alert.severity),
        healthStatus,
      ),
      latestCollectedAt,
    };
  });
  const alertItems = buildAlertItems(store.alerts, providerDisplayNames);
  const healthItems = buildHealthItems(store.serviceHealthSnapshots, providerDisplayNames);

  return {
    generatedAt: options.generatedAt,
    source: "sqlite",
    database: {
      available: true,
      reason: "ok",
    },
    summary: {
      providerCount: store.providers.length,
      totalEstimatedAmountMinor: sum(store.costEstimates.map((snapshot) => snapshot.estimatedAmountMinor)),
      totalBillingAmountMinor: sum(store.billingSnapshots.map((snapshot) => snapshot.amountMinor)),
      currency: summarizeCurrency([
        ...store.costEstimates.map((snapshot) => snapshot.currency),
        ...store.billingSnapshots.map((snapshot) => snapshot.currency),
      ]),
      usageSnapshotCount: store.usageSnapshots.length,
      costEstimateCount: store.costEstimates.length,
      alertCount: store.alerts.length,
      criticalAlertCount: store.alerts.filter((alert) => alert.severity === "critical").length,
      healthStatus: summarizeHealth(providerRows.map((provider) => provider.healthStatus)),
    },
    providers: providerRows,
    usage: {
      snapshotCount: store.usageSnapshots.length,
      topMetrics: [...store.usageSnapshots]
        .sort((first, second) => second.collectedAt.localeCompare(first.collectedAt))
        .slice(0, 5)
        .map((snapshot) => ({
          providerKey: safeText(snapshot.providerKey),
          displayName: displayNameFor(snapshot.providerKey, providerDisplayNames),
          service: safeText(snapshot.service),
          metric: safeText(snapshot.metric),
          unit: safeText(snapshot.unit),
          value: snapshot.value,
          collectedAt: snapshot.collectedAt,
        })),
    },
    risks: buildRiskItems(alertItems, healthItems),
    health: healthItems,
    alerts: alertItems,
  };
}

function createEmptyDashboardSnapshot(generatedAt: string): DashboardSnapshot {
  return {
    generatedAt,
    source: "empty",
    database: {
      available: false,
      reason: "missing",
    },
    summary: {
      providerCount: 0,
      totalEstimatedAmountMinor: 0,
      totalBillingAmountMinor: 0,
      currency: DEFAULT_CURRENCY,
      usageSnapshotCount: 0,
      costEstimateCount: 0,
      alertCount: 0,
      criticalAlertCount: 0,
      healthStatus: "unknown",
    },
    providers: [],
    usage: {
      snapshotCount: 0,
      topMetrics: [],
    },
    risks: [],
    health: [],
    alerts: [],
  };
}

function buildAlertItems(
  alerts: readonly LocalAlertRecord[],
  providerDisplayNames: ReadonlyMap<string, string>,
): DashboardAlertItem[] {
  return [...alerts]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5)
    .map((alert) => {
      const providerKey = alert.providerKey === undefined ? null : safeText(alert.providerKey);

      return {
        providerKey,
        displayName: alert.providerKey === undefined ? null : displayNameFor(alert.providerKey, providerDisplayNames),
        severity: alert.severity,
        category: safeText(alert.category),
        title: safeText(alert.title),
        message: safeText(alert.message),
        createdAt: alert.createdAt,
      };
    });
}

function buildHealthItems(
  healthSnapshots: readonly LocalServiceHealthSnapshotRecord[],
  providerDisplayNames: ReadonlyMap<string, string>,
): DashboardHealthItem[] {
  return [...healthSnapshots]
    .sort((first, second) => second.collectedAt.localeCompare(first.collectedAt))
    .slice(0, 10)
    .map((snapshot) => ({
      providerKey: safeText(snapshot.providerKey),
      displayName: displayNameFor(snapshot.providerKey, providerDisplayNames),
      service: safeText(snapshot.service),
      region: snapshot.region === undefined ? null : safeText(snapshot.region),
      status: snapshot.status,
      message: snapshot.message === undefined ? null : safeText(snapshot.message),
      collectedAt: snapshot.collectedAt,
    }));
}

function buildRiskItems(
  alerts: readonly DashboardAlertItem[],
  health: readonly DashboardHealthItem[],
): DashboardRiskItem[] {
  const alertRisks: DashboardRiskItem[] = alerts
    .filter((alert) => alert.severity !== "info")
    .map((alert) => ({
      providerKey: alert.providerKey,
      displayName: alert.displayName,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      createdAt: alert.createdAt,
    }));
  const healthRisks: DashboardRiskItem[] = health
    .filter((item) => item.status !== "ok")
    .map((item) => ({
      providerKey: item.providerKey,
      displayName: item.displayName,
      severity: item.status === "down" ? "critical" : "warning",
      title: `Health ${item.status}`,
      message: `${item.service}${item.region === null ? "" : ` in ${item.region}`} reported ${item.status}.`,
      createdAt: item.collectedAt,
    }));

  return [...alertRisks, ...healthRisks]
    .sort((first, second) => {
      const severityDelta = riskSeverityRank(second.severity) - riskSeverityRank(first.severity);

      if (severityDelta !== 0) {
        return severityDelta;
      }

      return second.createdAt.localeCompare(first.createdAt);
    })
    .slice(0, 6);
}

function resolveDashboardDbPath(cwd: string, configuredPath: string | undefined): string {
  const rawPath = configuredPath === undefined || configuredPath.trim().length === 0
    ? DEFAULT_DASHBOARD_DB_PATH
    : configuredPath.trim();

  return isAbsolute(rawPath) ? rawPath : join(cwd, rawPath);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function displayNameFor(providerKey: string, providerDisplayNames: ReadonlyMap<string, string>): string {
  return providerDisplayNames.get(providerKey) ?? safeText(providerKey);
}

function summarizeHealth(statuses: readonly DashboardHealthStatus[]): DashboardHealthStatus {
  if (statuses.includes("down")) {
    return "down";
  }

  if (statuses.includes("degraded")) {
    return "degraded";
  }

  if (statuses.includes("unknown") || statuses.length === 0) {
    return "unknown";
  }

  return "ok";
}

function summarizeProviderRisk(
  severities: readonly DashboardRiskSeverity[],
  healthStatus: DashboardHealthStatus,
): DashboardRiskLevel {
  if (severities.includes("critical") || healthStatus === "down") {
    return "critical";
  }

  if (severities.includes("warning") || healthStatus === "degraded" || healthStatus === "unknown") {
    return "warning";
  }

  return "low";
}

function summarizeCurrency(currencies: readonly string[]): string {
  const normalizedCurrencies = new Set(currencies.map((currency) => safeText(currency.toUpperCase())));

  if (normalizedCurrencies.size === 0) {
    return DEFAULT_CURRENCY;
  }

  if (normalizedCurrencies.size > 1) {
    return "MIXED";
  }

  return [...normalizedCurrencies][0] ?? DEFAULT_CURRENCY;
}

function latestIso(values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return [...values].sort((first, second) => second.localeCompare(first))[0] ?? null;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function riskSeverityRank(severity: DashboardRiskSeverity): number {
  if (severity === "critical") {
    return 2;
  }

  if (severity === "warning") {
    return 1;
  }

  return 0;
}

function safeText(value: string): string {
  return value.replace(SENSITIVE_TEXT_PATTERN, "[redacted]");
}
