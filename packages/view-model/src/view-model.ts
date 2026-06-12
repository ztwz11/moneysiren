import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type NotificationWidgetKey,
} from "./notification-preferences.js";

export interface LocalSafeEnvelope {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
}

export type ViewModelHealthStatus = "ok" | "degraded" | "down" | "unknown";
export type ViewModelRiskSeverity = "info" | "warning" | "critical";

export interface ViewModelProviderRecord {
  key: string;
  displayName: string;
}

export interface ViewModelUsageSnapshotRecord {
  providerKey: string;
  collectedAt: string;
  service: string;
  metric: string;
  unit: string;
  value: number;
}

export interface ViewModelBillingSnapshotRecord {
  providerKey: string;
  collectedAt: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface ViewModelServiceHealthSnapshotRecord {
  providerKey: string;
  collectedAt: string;
  service: string;
  status: ViewModelHealthStatus;
  region?: string;
  message?: string;
}

export interface ViewModelCostEstimateRecord {
  providerKey: string;
  collectedAt: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "low" | "medium" | "high";
}

export interface ViewModelAlertRecord {
  providerKey?: string;
  createdAt: string;
  severity: ViewModelRiskSeverity;
  category: string;
  title: string;
  message: string;
}

export interface ViewModelStore {
  providers: readonly ViewModelProviderRecord[];
  usageSnapshots: readonly ViewModelUsageSnapshotRecord[];
  billingSnapshots: readonly ViewModelBillingSnapshotRecord[];
  serviceHealthSnapshots: readonly ViewModelServiceHealthSnapshotRecord[];
  costEstimates: readonly ViewModelCostEstimateRecord[];
  alerts: readonly ViewModelAlertRecord[];
}

export type ViewModelReadStore = () => Promise<ViewModelStore>;

export interface OperationsOverview extends LocalSafeEnvelope {
  source: "sqlite" | "empty";
  summary: {
    providerCount: number;
    connectedProviderCount: number;
    totalEstimatedAmountMinor: number;
    totalBillingAmountMinor: number;
    currency: string;
    usageSnapshotCount: number;
    costEstimateCount: number;
    alertCount: number;
    criticalAlertCount: number;
    healthStatus: ViewModelHealthStatus;
  };
  providers: readonly OperationsOverviewProvider[];
  alerts: readonly OperationsOverviewAlert[];
}

export interface OperationsOverviewProvider {
  providerKey: string;
  displayName: string;
  estimatedAmountMinor: number;
  billingAmountMinor: number;
  currency: string;
  usageSnapshotCount: number;
  costEstimateCount: number;
  latestCollectedAt: string | null;
  healthStatus: ViewModelHealthStatus;
  riskLevel: "low" | "warning" | "critical";
  alertCount: number;
}

export interface OperationsOverviewAlert {
  providerKey: string | null;
  displayName: string | null;
  severity: ViewModelRiskSeverity;
  category: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface TodayLiveView extends LocalSafeEnvelope {
  timezone: string;
  dateKey: string;
  cacheState: "empty" | "fresh" | "stale";
  summary: {
    providerCount: number;
    includedProviderCount: number;
    todayLiveAmountMinor: number | null;
    currency: string;
  };
  providers: readonly TodayLiveProviderView[];
}

export interface TodayLiveProviderInput {
  providerKey: string;
  displayName: string;
  checkedAt: string | null;
  freshness: "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";
  confidence: "high" | "medium" | "low" | "none";
  todayLiveAmountMinor: number | null;
  currency: string;
  included: boolean;
  metrics?: readonly TodayLiveMetric[];
}

export interface TodayLiveProviderView extends TodayLiveProviderInput {
  metrics: readonly TodayLiveMetric[];
}

export interface TodayLiveMetric {
  key: string;
  value: number;
  unit: string;
}

export interface NotificationDigest extends LocalSafeEnvelope {
  title: string;
  status: "ok" | "attention" | "critical";
  suppressedReason: string | null;
  items: readonly NotificationDigestItem[];
}

export interface NotificationDigestItem {
  widgetKey: NotificationWidgetKey;
  kind: "summary" | "live" | "risk" | "usage" | "health";
  severity: ViewModelRiskSeverity;
  label: string;
  value: string;
  freshness?: TodayLiveProviderView["freshness"];
  confidence?: TodayLiveProviderView["confidence"];
  clickPath?: string;
}

export interface TrayMenuModel extends LocalSafeEnvelope {
  title: string;
  subtitle: string;
  status: "ok" | "attention" | "critical";
  items: readonly TrayMenuItem[];
}

export interface TrayMenuItem {
  id: string;
  label: string;
  enabled: boolean;
  kind: "command" | "separator" | "status";
  action?: string;
  urlPath?: string;
  durationMinutes?: number;
}

export interface ReadOperationsOverviewOptions {
  now?: () => Date;
  store?: ViewModelStore;
  readStore?: ViewModelReadStore;
}

export interface ReadTodayLiveViewOptions extends ReadOperationsOverviewOptions {
  timezone?: string;
  liveProviders?: readonly TodayLiveProviderInput[];
}

export interface ReadNotificationDigestOptions extends ReadTodayLiveViewOptions {
  overview?: OperationsOverview;
  todayLive?: TodayLiveView;
  notificationPreferences?: NotificationPreferences;
}

export interface ReadTrayMenuModelOptions extends ReadNotificationDigestOptions {
  digest?: NotificationDigest;
}

const DEFAULT_CURRENCY = "USD";
const OPENAI_PROVIDER_KEY = "openai";
const AWS_PROVIDER_KEY = "aws";
const SUPABASE_PROVIDER_KEY = "supabase";
const CLOUDFLARE_PROVIDER_KEY = "cloudflare";
const CODEX_CLI_PROVIDER_KEY = "codex-cli";
const CLAUDE_CLI_PROVIDER_KEY = "claude-cli";
const SENSITIVE_TEXT_PATTERN =
  /(https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+|\b(?:sk|sbp|xox[baprs])[-_][A-Za-z0-9_-]+\b|\bacct[_-][A-Za-z0-9_-]+\b|\b(?:proj|project)[_-][A-Za-z0-9_-]+\b|\b(?:in|invoice)[_-][A-Za-z0-9_-]+\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

const EMPTY_STORE: ViewModelStore = {
  providers: [],
  usageSnapshots: [],
  billingSnapshots: [],
  serviceHealthSnapshots: [],
  costEstimates: [],
  alerts: [],
};

export async function readOperationsOverview(
  options: ReadOperationsOverviewOptions = {},
): Promise<OperationsOverview> {
  const store = await resolveStore(options);
  const now = options.now?.() ?? new Date();

  return buildOperationsOverview(store, {
    generatedAt: now.toISOString(),
  });
}

export function buildOperationsOverview(
  store: ViewModelStore,
  options: {
    generatedAt: string;
  },
): OperationsOverview {
  const providerNames = new Map(
    store.providers.map((provider) => [provider.key, safeText(provider.displayName)]),
  );
  const providers = store.providers.map((provider): OperationsOverviewProvider => {
    const providerKey = safeText(provider.key);
    const billingSnapshots = store.billingSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const costEstimates = store.costEstimates.filter((estimate) => estimate.providerKey === provider.key);
    const usageSnapshots = store.usageSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const healthSnapshots = store.serviceHealthSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const alerts = store.alerts.filter((alert) => alert.providerKey === provider.key);
    const healthStatus = summarizeHealth(healthSnapshots.map((snapshot) => snapshot.status));

    return {
      providerKey,
      displayName: safeText(provider.displayName),
      estimatedAmountMinor: sum(costEstimates.map((estimate) => estimate.estimatedAmountMinor)),
      billingAmountMinor: sum(billingSnapshots.map((snapshot) => snapshot.amountMinor)),
      currency: summarizeCurrency([
        ...costEstimates.map((estimate) => estimate.currency),
        ...billingSnapshots.map((snapshot) => snapshot.currency),
      ]),
      usageSnapshotCount: usageSnapshots.length,
      costEstimateCount: costEstimates.length,
      latestCollectedAt: latestIso([
        ...billingSnapshots.map((snapshot) => snapshot.collectedAt),
        ...costEstimates.map((estimate) => estimate.collectedAt),
        ...usageSnapshots.map((snapshot) => snapshot.collectedAt),
        ...healthSnapshots.map((snapshot) => snapshot.collectedAt),
      ]),
      healthStatus,
      riskLevel: summarizeRisk(alerts.map((alert) => alert.severity), healthStatus),
      alertCount: alerts.length,
    };
  });
  const alerts = store.alerts
    .map((alert): OperationsOverviewAlert => {
      const providerKey = alert.providerKey === undefined ? null : safeText(alert.providerKey);

      return {
        providerKey,
        displayName: alert.providerKey === undefined
          ? null
          : providerNames.get(alert.providerKey) ?? safeText(alert.providerKey),
        severity: alert.severity,
        category: safeText(alert.category),
        title: safeText(alert.title),
        message: safeText(alert.message),
        createdAt: alert.createdAt,
      };
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5);
  const summaryCurrency = summarizeCurrency([
    ...store.costEstimates.map((estimate) => estimate.currency),
    ...store.billingSnapshots.map((snapshot) => snapshot.currency),
  ]);

  return {
    generatedAt: options.generatedAt,
    localOnly: true,
    secretsReturned: false,
    source: store.providers.length === 0 ? "empty" : "sqlite",
    summary: {
      providerCount: store.providers.length,
      connectedProviderCount: providers.filter((provider) => provider.latestCollectedAt !== null).length,
      totalEstimatedAmountMinor: sum(store.costEstimates.map((estimate) => estimate.estimatedAmountMinor)),
      totalBillingAmountMinor: sum(store.billingSnapshots.map((snapshot) => snapshot.amountMinor)),
      currency: summaryCurrency,
      usageSnapshotCount: store.usageSnapshots.length,
      costEstimateCount: store.costEstimates.length,
      alertCount: store.alerts.length,
      criticalAlertCount: store.alerts.filter((alert) => alert.severity === "critical").length,
      healthStatus: summarizeHealth(providers.map((provider) => provider.healthStatus)),
    },
    providers,
    alerts,
  };
}

export async function readTodayLiveView(options: ReadTodayLiveViewOptions = {}): Promise<TodayLiveView> {
  const now = options.now?.() ?? new Date();
  const store = await resolveStore(options);
  const buildOptions = {
    generatedAt: now.toISOString(),
    now,
    timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    ...(options.liveProviders === undefined ? {} : { liveProviders: options.liveProviders }),
  };

  return buildTodayLiveView(store, buildOptions);
}

export function buildTodayLiveView(
  store: ViewModelStore,
  options: {
    generatedAt: string;
    now: Date;
    timezone: string;
    liveProviders?: readonly TodayLiveProviderInput[];
  },
): TodayLiveView {
  const dateKey = dateKeyInTimezone(options.now, options.timezone);
  const providers = options.liveProviders === undefined
    ? todayProvidersFromStore(store, dateKey)
    : options.liveProviders.map((provider) => ({
        ...provider,
        providerKey: safeText(provider.providerKey),
        displayName: safeText(provider.displayName),
        metrics: (provider.metrics ?? []).map((metric) => ({
          key: safeText(metric.key),
          value: metric.value,
          unit: safeText(metric.unit),
        })),
      }));
  const includedProviders = providers.filter((provider) =>
    provider.included && provider.todayLiveAmountMinor !== null
  );
  const currency = singleCurrency(includedProviders.map((provider) => provider.currency)) ?? DEFAULT_CURRENCY;
  const canSum = includedProviders.length > 0 && includedProviders.every((provider) => provider.currency === currency);

  return {
    generatedAt: options.generatedAt,
    localOnly: true,
    secretsReturned: false,
    timezone: options.timezone,
    dateKey,
    cacheState: providers.length === 0
      ? "empty"
      : providers.some((provider) => provider.freshness === "live")
        ? "fresh"
        : "stale",
    summary: {
      providerCount: providers.length,
      includedProviderCount: includedProviders.length,
      todayLiveAmountMinor: canSum ? sum(includedProviders.map((provider) => provider.todayLiveAmountMinor ?? 0)) : null,
      currency,
    },
    providers,
  };
}

export async function readNotificationDigest(
  options: ReadNotificationDigestOptions = {},
): Promise<NotificationDigest> {
  const overview = options.overview ?? await readOperationsOverview(options);
  const todayLive = options.todayLive ?? await readTodayLiveView(options);

  return buildNotificationDigest(overview, todayLive, options.notificationPreferences);
}

export function buildNotificationDigest(
  overview: OperationsOverview,
  todayLive: TodayLiveView,
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): NotificationDigest {
  const criticalAlerts = overview.summary.criticalAlertCount;
  const warningAlerts = overview.summary.alertCount - criticalAlerts;
  const status = criticalAlerts > 0
    ? "critical"
    : warningAlerts > 0 || overview.summary.healthStatus !== "ok"
      ? "attention"
      : "ok";
  const items = buildDigestItems(overview, todayLive, {
    criticalAlerts,
    warningAlerts,
  });

  return {
    generatedAt: overview.generatedAt,
    localOnly: true,
    secretsReturned: false,
    title: "StackSpend",
    status,
    suppressedReason: preferences.enabled
      ? preferences.digestEnabled
        ? null
        : "digest_disabled"
      : "notifications_disabled",
    items: preferences.enabled && preferences.digestEnabled
      ? filterDigestItems(items, preferences.selectedWidgets)
      : [],
  };
}

export async function readTrayMenuModel(
  options: ReadTrayMenuModelOptions = {},
): Promise<TrayMenuModel> {
  const digest = options.digest ?? await readNotificationDigest(options);

  return buildTrayMenuModel(digest);
}

function filterDigestItems(
  items: readonly NotificationDigestItem[],
  selectedWidgets: readonly NotificationWidgetKey[],
): NotificationDigestItem[] {
  const itemsByWidget = new Map(items.map((item) => [item.widgetKey, item]));

  return selectedWidgets.flatMap((widgetKey) => {
    const item = itemsByWidget.get(widgetKey);

    return item === undefined ? [] : [item];
  });
}

export function buildTrayMenuModel(digest: NotificationDigest): TrayMenuModel {
  const summaryItem = digest.items.find((item) => item.kind === "summary");
  const statusLabel = digest.status === "ok"
    ? digest.suppressedReason === null
      ? "All monitored providers OK"
      : "Notifications paused"
    : digest.status === "critical"
      ? "Critical alert needs attention"
      : "Provider attention needed";

  return {
    generatedAt: digest.generatedAt,
    localOnly: true,
    secretsReturned: false,
    title: digest.title,
    subtitle: summaryItem?.value ?? "No local data",
    status: digest.status,
    items: [
      {
        id: "status",
        label: digest.suppressedReason === null ? statusLabel : `${statusLabel}: ${digest.suppressedReason}`,
        enabled: false,
        kind: "status",
      },
      ...digest.items.map((item) => ({
        id: `widget-${item.widgetKey}`,
        label: `${item.label}: ${item.value}`,
        enabled: false,
        kind: "status" as const,
        ...(item.clickPath === undefined ? {} : { urlPath: item.clickPath }),
      })),
      ...(digest.items.length === 0
        ? []
        : [{
            id: "separator-widgets",
            label: "",
            enabled: false,
            kind: "separator" as const,
          }]),
      {
        id: "show-hud",
        label: "Show HUD",
        enabled: true,
        kind: "command",
        action: "show_hud",
        urlPath: "/hud?locale=ko",
      },
      {
        id: "open-dashboard",
        label: "Open Dashboard",
        enabled: true,
        kind: "command",
        action: "open_url",
        urlPath: "/ko/dashboard/overview",
      },
      {
        id: "open-notification-settings",
        label: "Notification Settings",
        enabled: true,
        kind: "command",
        action: "open_url",
        urlPath: "/ko/settings/notifications",
      },
      {
        id: "refresh-now",
        label: "Refresh Now",
        enabled: true,
        kind: "command",
        action: "refresh_live",
      },
      {
        id: "separator-main",
        label: "",
        enabled: false,
        kind: "separator",
      },
      {
        id: "quit",
        label: "Quit",
        enabled: true,
        kind: "command",
        action: "quit",
      },
    ],
  };
}

function buildDigestItems(
  overview: OperationsOverview,
  todayLive: TodayLiveView,
  alerts: {
    criticalAlerts: number;
    warningAlerts: number;
  },
): NotificationDigestItem[] {
  const riskCount = alerts.criticalAlerts + alerts.warningAlerts;
  const staleConnectionCount = todayLive.providers.filter((provider) =>
    provider.freshness === "stale" ||
    provider.freshness === "error" ||
    provider.freshness === "locked" ||
    provider.freshness === "unavailable"
  ).length;
  const awsOverview = findOverviewProvider(overview, AWS_PROVIDER_KEY);
  const openAiToday = amountFromTodayProviders(todayLive, OPENAI_PROVIDER_KEY);
  const openAiTokens = tokenTotalFromProviders(todayProviders(todayLive, OPENAI_PROVIDER_KEY));
  const supabaseOverview = findOverviewProvider(overview, SUPABASE_PROVIDER_KEY);
  const supabaseToday = firstTodayProvider(todayLive, SUPABASE_PROVIDER_KEY);
  const cloudflareOverview = findOverviewProvider(overview, CLOUDFLARE_PROVIDER_KEY);
  const cloudflareToday = amountFromTodayProviders(todayLive, CLOUDFLARE_PROVIDER_KEY);

  return [
    {
      widgetKey: "month_forecast",
      kind: "summary",
      severity: "info",
      label: "Month estimate",
      value: formatMinorAmount(overview.summary.totalEstimatedAmountMinor, overview.summary.currency),
      clickPath: "/ko/dashboard/forecast",
    },
    {
      widgetKey: "today_live_cost",
      kind: "live",
      severity: "info",
      label: "Today live",
      value: todayLive.summary.todayLiveAmountMinor === null
        ? "Not available"
        : formatMinorAmount(todayLive.summary.todayLiveAmountMinor, todayLive.summary.currency),
      clickPath: "/ko/dashboard/today",
    },
    {
      widgetKey: "risk_high_count",
      kind: "risk",
      severity: alerts.criticalAlerts > 0 ? "critical" : alerts.warningAlerts > 0 ? "warning" : "info",
      label: "High risks",
      value: String(riskCount),
      clickPath: "/ko/dashboard/risks",
    },
    {
      widgetKey: "stale_connection_count",
      kind: "risk",
      severity: staleConnectionCount > 0 ? "warning" : "info",
      label: "Stale connections",
      value: String(staleConnectionCount),
      clickPath: "/ko/settings/connections",
    },
    {
      widgetKey: "aws_month_forecast",
      kind: "summary",
      severity: providerRiskSeverity(awsOverview),
      label: "AWS month estimate",
      value: awsOverview === undefined
        ? "Not available"
        : formatMinorAmount(awsOverview.estimatedAmountMinor, awsOverview.currency),
      clickPath: "/ko/services/aws",
    },
    {
      widgetKey: "openai_today_cost",
      kind: "live",
      severity: "info",
      label: "OpenAI today",
      value: openAiToday === null ? "Not available" : formatMinorAmount(openAiToday.amountMinor, openAiToday.currency),
      clickPath: "/ko/services/openai",
    },
    {
      widgetKey: "openai_today_tokens",
      kind: "usage",
      severity: "info",
      label: "OpenAI tokens",
      value: openAiTokens === null ? "Not available" : formatTokens(openAiTokens),
      clickPath: "/ko/services/openai",
    },
    cliRemainingPercentItem({
      widgetKey: "claude_five_hour_percent",
      label: "Claude 5h remaining",
      providerKey: CLAUDE_CLI_PROVIDER_KEY,
      todayLive,
      usedPercentMetricKey: "five_hour_limit_percent",
      remainingTokensMetricKey: "five_hour_remaining_tokens",
      usedTokensMetricKey: "five_hour_tokens",
      clickPath: "/ko/services/claude-cli",
    }),
    cliRemainingPercentItem({
      widgetKey: "claude_weekly_percent",
      label: "Claude weekly remaining",
      providerKey: CLAUDE_CLI_PROVIDER_KEY,
      todayLive,
      usedPercentMetricKey: "weekly_limit_percent",
      remainingTokensMetricKey: "weekly_remaining_tokens",
      usedTokensMetricKey: "weekly_tokens",
      clickPath: "/ko/services/claude-cli",
    }),
    cliRemainingPercentItem({
      widgetKey: "codex_five_hour_percent",
      label: "Codex 5h remaining",
      providerKey: CODEX_CLI_PROVIDER_KEY,
      todayLive,
      usedPercentMetricKey: "five_hour_limit_percent",
      remainingTokensMetricKey: "five_hour_remaining_tokens",
      usedTokensMetricKey: "five_hour_tokens",
      clickPath: "/ko/services/codex-cli",
    }),
    cliRemainingPercentItem({
      widgetKey: "codex_weekly_percent",
      label: "Codex weekly remaining",
      providerKey: CODEX_CLI_PROVIDER_KEY,
      todayLive,
      usedPercentMetricKey: "weekly_limit_percent",
      remainingTokensMetricKey: "weekly_remaining_tokens",
      usedTokensMetricKey: "weekly_tokens",
      clickPath: "/ko/services/codex-cli",
    }),
    {
      widgetKey: "supabase_usage_health",
      kind: "health",
      severity: healthSeverity(supabaseOverview?.healthStatus),
      label: "Supabase health",
      value: providerHealthValue(supabaseOverview, supabaseToday),
      ...(supabaseToday === undefined
        ? {}
        : {
            freshness: supabaseToday.freshness,
            confidence: supabaseToday.confidence,
          }),
      clickPath: "/ko/services/supabase",
    },
    {
      widgetKey: "cloudflare_month_to_date",
      kind: "summary",
      severity: providerRiskSeverity(cloudflareOverview),
      label: "Cloudflare MTD",
      value: cloudflareOverview === undefined
        ? cloudflareToday === null
          ? "Not available"
          : formatMinorAmount(cloudflareToday.amountMinor, cloudflareToday.currency)
        : formatMinorAmount(cloudflareOverview.estimatedAmountMinor, cloudflareOverview.currency),
      clickPath: "/ko/services/cloudflare",
    },
  ];
}

function cliRemainingPercentItem(options: {
  widgetKey: NotificationWidgetKey;
  label: string;
  providerKey: string;
  todayLive: TodayLiveView;
  usedPercentMetricKey: string;
  remainingTokensMetricKey: string;
  usedTokensMetricKey: string;
  clickPath: string;
}): NotificationDigestItem {
  const providers = todayProviders(options.todayLive, options.providerKey);
  const percent = remainingPercentFromMetrics(
    providers,
    options.remainingTokensMetricKey,
    options.usedTokensMetricKey,
    options.usedPercentMetricKey,
  );
  const firstProvider = providers[0];

  return {
    widgetKey: options.widgetKey,
    kind: "usage",
    severity: remainingPercentSeverity(percent),
    label: options.label,
    value: percent === null ? "Not available" : formatPercent(percent),
    ...(firstProvider === undefined
      ? {}
      : {
          freshness: firstProvider.freshness,
          confidence: firstProvider.confidence,
        }),
    clickPath: options.clickPath,
  };
}

async function resolveStore(options: ReadOperationsOverviewOptions): Promise<ViewModelStore> {
  if (options.store !== undefined) {
    return options.store;
  }

  return options.readStore === undefined ? EMPTY_STORE : options.readStore();
}

function todayProvidersFromStore(store: ViewModelStore, dateKey: string): TodayLiveProviderView[] {
  const providerNames = new Map(store.providers.map((provider) => [provider.key, safeText(provider.displayName)]));
  const estimatesByProvider = new Map<string, ViewModelCostEstimateRecord[]>();

  for (const estimate of store.costEstimates) {
    if (!dateKeyMatchesIso(estimate.collectedAt, dateKey)) {
      continue;
    }

    estimatesByProvider.set(estimate.providerKey, [
      ...(estimatesByProvider.get(estimate.providerKey) ?? []),
      estimate,
    ]);
  }

  return [...estimatesByProvider.entries()]
    .map(([providerKey, estimates]) => {
      const currency = singleCurrency(estimates.map((estimate) => estimate.currency)) ?? DEFAULT_CURRENCY;
      const canInclude = estimates.length > 0 && estimates.every((estimate) => estimate.currency === currency);

      return {
        providerKey: safeText(providerKey),
        displayName: providerNames.get(providerKey) ?? safeText(providerKey),
        checkedAt: latestIso(estimates.map((estimate) => estimate.collectedAt)),
        freshness: "stale" as const,
        confidence: highestConfidence(estimates.map((estimate) => estimate.confidence)),
        todayLiveAmountMinor: canInclude ? sum(estimates.map((estimate) => estimate.estimatedAmountMinor)) : null,
        currency,
        included: canInclude,
        metrics: [],
      };
    })
    .sort((first, second) => first.providerKey.localeCompare(second.providerKey));
}

function findOverviewProvider(
  overview: OperationsOverview,
  providerKey: string,
): OperationsOverviewProvider | undefined {
  return overview.providers.find((provider) => provider.providerKey === providerKey);
}

function todayProviders(todayLive: TodayLiveView, providerKey: string): TodayLiveProviderView[] {
  return todayLive.providers.filter((provider) => provider.providerKey === providerKey);
}

function firstTodayProvider(todayLive: TodayLiveView, providerKey: string): TodayLiveProviderView | undefined {
  return todayProviders(todayLive, providerKey)[0];
}

function amountFromTodayProviders(
  todayLive: TodayLiveView,
  providerKey: string,
): { amountMinor: number; currency: string } | null {
  const providers = todayProviders(todayLive, providerKey).filter((provider) =>
    provider.included && provider.todayLiveAmountMinor !== null
  );

  if (providers.length === 0) {
    return null;
  }

  const currency = singleCurrency(providers.map((provider) => provider.currency));

  if (currency === null) {
    return null;
  }

  return {
    amountMinor: sum(providers.map((provider) => provider.todayLiveAmountMinor ?? 0)),
    currency,
  };
}

function tokenTotalFromProviders(providers: readonly TodayLiveProviderView[]): number | null {
  const totalTokens = metricSum(providers, "total_tokens");

  if (totalTokens !== null) {
    return totalTokens;
  }

  const componentTokens = sumNullable([
    metricSum(providers, "input_tokens"),
    metricSum(providers, "output_tokens"),
    metricSum(providers, "cache_tokens"),
    metricSum(providers, "reasoning_tokens"),
  ]);

  return componentTokens === 0 ? null : componentTokens;
}

function metricSum(providers: readonly TodayLiveProviderView[], metricKey: string): number | null {
  let found = false;
  let total = 0;

  for (const provider of providers) {
    for (const metric of provider.metrics) {
      if (metric.key !== metricKey) {
        continue;
      }

      found = true;
      total += metric.value;
    }
  }

  return found ? total : null;
}

function metricFirst(providers: readonly TodayLiveProviderView[], metricKey: string): number | null {
  for (const provider of providers) {
    const metric = provider.metrics.find((item) => item.key === metricKey);

    if (metric !== undefined) {
      return metric.value;
    }
  }

  return null;
}

function remainingPercentFromMetrics(
  providers: readonly TodayLiveProviderView[],
  remainingTokensMetricKey: string,
  usedTokensMetricKey: string,
  usedPercentMetricKey: string,
): number | null {
  const remainingTokens = metricSum(providers, remainingTokensMetricKey);
  const usedTokens = metricSum(providers, usedTokensMetricKey);

  if (remainingTokens !== null && usedTokens !== null) {
    const totalTokens = remainingTokens + usedTokens;

    if (totalTokens > 0) {
      return clampPercent((remainingTokens / totalTokens) * 100);
    }
  }

  const usedPercent = metricFirst(providers, usedPercentMetricKey);

  return usedPercent === null ? null : clampPercent(100 - usedPercent);
}

function providerRiskSeverity(provider: OperationsOverviewProvider | undefined): ViewModelRiskSeverity {
  if (provider?.riskLevel === "critical") {
    return "critical";
  }

  if (provider?.riskLevel === "warning") {
    return "warning";
  }

  return "info";
}

function healthSeverity(status: ViewModelHealthStatus | undefined): ViewModelRiskSeverity {
  if (status === "down") {
    return "critical";
  }

  if (status === "degraded" || status === "unknown") {
    return "warning";
  }

  return "info";
}

function remainingPercentSeverity(percent: number | null): ViewModelRiskSeverity {
  if (percent === null) {
    return "info";
  }

  if (percent <= 10) {
    return "critical";
  }

  if (percent <= 25) {
    return "warning";
  }

  return "info";
}

function providerHealthValue(
  overviewProvider: OperationsOverviewProvider | undefined,
  todayProvider: TodayLiveProviderView | undefined,
): string {
  if (overviewProvider === undefined && todayProvider === undefined) {
    return "Not available";
  }

  const values = [
    overviewProvider === undefined ? null : `health ${overviewProvider.healthStatus}`,
    todayProvider === undefined ? null : `live ${todayProvider.freshness}`,
  ].filter((value): value is string => value !== null);

  return values.join(" / ");
}

function summarizeHealth(statuses: readonly ViewModelHealthStatus[]): ViewModelHealthStatus {
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

function summarizeRisk(
  severities: readonly ViewModelRiskSeverity[],
  healthStatus: ViewModelHealthStatus,
): OperationsOverviewProvider["riskLevel"] {
  if (severities.includes("critical") || healthStatus === "down") {
    return "critical";
  }

  if (severities.includes("warning") || healthStatus === "degraded" || healthStatus === "unknown") {
    return "warning";
  }

  return "low";
}

function highestConfidence(
  values: readonly ViewModelCostEstimateRecord["confidence"][],
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

function summarizeCurrency(currencies: readonly string[]): string {
  const normalized = new Set(
    currencies
      .map((currency) => safeText(currency.toUpperCase()))
      .filter((currency) => currency.length > 0),
  );

  if (normalized.size === 0) {
    return DEFAULT_CURRENCY;
  }

  if (normalized.size > 1) {
    return "MIXED";
  }

  return [...normalized][0] ?? DEFAULT_CURRENCY;
}

function singleCurrency(currencies: readonly string[]): string | null {
  const normalized = currencies
    .map((currency) => safeText(currency.toUpperCase()))
    .filter((currency) => currency.length > 0);
  const values = new Set(normalized);

  return values.size === 1 ? normalized[0] ?? null : null;
}

function latestIso(values: readonly string[]): string | null {
  return values.length === 0
    ? null
    : [...values].sort((first, second) => second.localeCompare(first))[0] ?? null;
}

function dateKeyMatchesIso(value: string, dateKey: string): boolean {
  return value.startsWith(dateKey);
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

function formatMinorAmount(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(tokens);
}

function formatPercent(percent: number): string {
  const rounded = Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1);

  return `${rounded}%`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sumNullable(values: readonly (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function safeText(value: string): string {
  return value.replace(SENSITIVE_TEXT_PATTERN, "[redacted]");
}
