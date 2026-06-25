import {
  buildNotificationDigest,
  buildTodayLiveView,
  buildTrayMenuModel,
  readNotificationPreferencesFile,
  resolveNotificationPreferencesPath,
  type NotificationDigest,
  type NotificationPreferences,
  type OperationsOverview,
  type TodayLiveProviderInput,
  type TodayLiveView,
  type TrayMenuModel,
} from "../../../packages/view-model/src/index";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import {
  readDashboardSnapshot,
  type DashboardSnapshot,
} from "./dashboard-data";
import {
  readLiveTodaySnapshot,
  type LiveTodaySnapshot,
} from "./live-today";
import { findAvailableProvider } from "./provider-catalog";

export interface ReadWebLocalNotificationModelOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  dashboardSnapshot?: DashboardSnapshot;
  liveTodaySnapshot?: LiveTodaySnapshot;
  notificationPreferences?: NotificationPreferences;
}

export interface WebNotificationPreferencesState {
  preferences: NotificationPreferences;
  preferencesStored: boolean;
}

export async function readWebNotificationPreferences(
  options: Pick<ReadWebLocalNotificationModelOptions, "env"> = {},
): Promise<NotificationPreferences> {
  return readNotificationPreferencesFile({
    cwd: process.cwd(),
    env: options.env ?? process.env,
  });
}

export async function readWebNotificationPreferencesState(
  options: Pick<ReadWebLocalNotificationModelOptions, "env"> = {},
): Promise<WebNotificationPreferencesState> {
  const env = options.env ?? process.env;
  const fileOptions = {
    cwd: process.cwd(),
    env,
  };
  const [preferences, preferencesStored] = await Promise.all([
    readNotificationPreferencesFile(fileOptions),
    notificationPreferencesFileExists(fileOptions),
  ]);

  return {
    preferences,
    preferencesStored,
  };
}

export async function readWebLocalNotificationDigest(
  options: ReadWebLocalNotificationModelOptions = {},
): Promise<NotificationDigest> {
  const now = options.now ?? (() => new Date());
  const env = options.env ?? process.env;
  const [dashboardSnapshot, liveTodaySnapshot, notificationPreferences] = await Promise.all([
    options.dashboardSnapshot ?? readDashboardSnapshot({ env, now }),
    options.liveTodaySnapshot ?? readLiveTodaySnapshot({ env, now }),
    options.notificationPreferences ?? readWebNotificationPreferences({ env }),
  ]);
  const overview = operationsOverviewFromDashboard(dashboardSnapshot);
  const todayLive = todayLiveViewFromSnapshot(liveTodaySnapshot);

  return buildNotificationDigest(overview, todayLive, notificationPreferences);
}

export async function readWebLocalTrayMenuModel(
  options: ReadWebLocalNotificationModelOptions = {},
): Promise<TrayMenuModel> {
  return buildTrayMenuModel(await readWebLocalNotificationDigest(options));
}

async function notificationPreferencesFileExists(
  options: Parameters<typeof resolveNotificationPreferencesPath>[0],
): Promise<boolean> {
  try {
    await access(resolveNotificationPreferencesPath(options), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function operationsOverviewFromDashboard(snapshot: DashboardSnapshot): OperationsOverview {
  return {
    generatedAt: snapshot.generatedAt,
    localOnly: true,
    secretsReturned: false,
    source: snapshot.source,
    summary: {
      providerCount: snapshot.summary.providerCount,
      connectedProviderCount: snapshot.providers.filter((provider) => provider.latestCollectedAt !== null).length,
      totalEstimatedAmountMinor: snapshot.summary.totalEstimatedAmountMinor,
      totalBillingAmountMinor: snapshot.summary.totalBillingAmountMinor,
      currency: snapshot.summary.currency,
      usageSnapshotCount: snapshot.summary.usageSnapshotCount,
      costEstimateCount: snapshot.summary.costEstimateCount,
      alertCount: snapshot.summary.alertCount,
      criticalAlertCount: snapshot.summary.criticalAlertCount,
      healthStatus: snapshot.summary.healthStatus,
    },
    providers: snapshot.providers.map((provider) => ({
      providerKey: provider.providerKey,
      displayName: provider.displayName,
      estimatedAmountMinor: provider.estimatedAmountMinor,
      billingAmountMinor: provider.billingAmountMinor,
      currency: provider.currency,
      usageSnapshotCount: provider.usageSnapshotCount,
      costEstimateCount: provider.costEstimateCount,
      latestCollectedAt: provider.latestCollectedAt,
      healthStatus: provider.healthStatus,
      riskLevel: provider.riskLevel,
      alertCount: provider.alertCount,
    })),
    alerts: snapshot.alerts.map((alert) => ({
      providerKey: alert.providerKey,
      displayName: alert.displayName,
      severity: alert.severity,
      category: alert.category,
      title: alert.title,
      message: alert.message,
      createdAt: alert.createdAt,
    })),
  };
}

export function todayLiveViewFromSnapshot(snapshot: LiveTodaySnapshot): TodayLiveView {
  const now = new Date(snapshot.generatedAt);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  return buildTodayLiveView({
    providers: [],
    usageSnapshots: [],
    billingSnapshots: [],
    serviceHealthSnapshots: [],
    costEstimates: [],
    alerts: [],
  }, {
    generatedAt: snapshot.generatedAt,
    now: Number.isNaN(now.getTime()) ? new Date() : now,
    timezone,
    liveProviders: snapshot.providers.map((provider): TodayLiveProviderInput => ({
      providerKey: provider.providerKey,
      displayName: findAvailableProvider(provider.providerKey)?.name ?? provider.providerKey,
      checkedAt: provider.checkedAt,
      expiresAt: provider.expiresAt,
      ttlSeconds: provider.ttlSeconds,
      ...(provider.lastAttemptAt === undefined ? {} : { lastAttemptAt: provider.lastAttemptAt }),
      ...(provider.lastSuccessAt === undefined ? {} : { lastSuccessAt: provider.lastSuccessAt }),
      ...(provider.freshUntil === undefined ? {} : { freshUntil: provider.freshUntil }),
      ...(provider.staleUntil === undefined ? {} : { staleUntil: provider.staleUntil }),
      ...(provider.lastRefreshFailed === undefined ? {} : { lastRefreshFailed: provider.lastRefreshFailed }),
      ...(provider.revision === undefined ? {} : { revision: provider.revision }),
      ...(provider.message === undefined ? {} : { message: provider.message }),
      freshness: provider.freshness,
      confidence: provider.confidence,
      todayLiveAmountMinor: provider.todayLiveAmountMinor,
      currency: provider.currency,
      included: provider.included,
      metrics: provider.usageSummary?.metrics.map((metric) => ({
        key: metric.key,
        value: metric.value,
        unit: metric.unit,
        ...(metric.resetAt === undefined ? {} : { resetAt: metric.resetAt }),
        ...(metric.resetAtLatest === undefined ? {} : { resetAtLatest: metric.resetAtLatest }),
        ...(metric.itemKey === undefined ? {} : { itemKey: metric.itemKey }),
        ...(metric.accuracy === undefined ? {} : { accuracy: metric.accuracy }),
        ...(metric.source === undefined ? {} : { source: metric.source }),
      })) ?? [],
    })),
  });
}
