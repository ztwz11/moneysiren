import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  MoreVertical,
} from "lucide-react";
import type { Messages, Locale } from "../lib/i18n";
import { BudgetSettings } from "./BudgetSettings";
import { ConnectionCard } from "./ConnectionCard";
import { DashboardDisplaySettings } from "./DashboardDisplaySettings";
import { EmergencyActionsPanel } from "./EmergencyActionsPanel";
import { LiveRefreshButton } from "./LiveRefreshButton";
import { ProviderIcon } from "./ProviderIcon";
import { RefreshPageButton } from "./RefreshPageButton";
import { RuntimeShutdownButton } from "./RuntimeShutdownButton";
import { UsageProgress } from "./UsageProgress";
import {
  ServiceRemediationHeader,
  ServiceRemediationPanel,
  ServiceRemediationSummary,
} from "./ServiceRemediation";
import type {
  OperationsDashboard,
  OperationsProvider,
  OperationsProviderConnection,
  OperationsUsageTrendPoint,
} from "../lib/operations-data";
import type { ProviderCatalogItem, ProviderSetupLink } from "../lib/provider-catalog";
import type {
  DashboardViewKey,
  DashboardWidgetKey,
  DashboardWidgetLayoutItem,
} from "../../../packages/view-model/src/index";

export type DashboardGrouping = "service" | "connection";

interface ViewProps {
  dashboard: OperationsDashboard;
  locale: Locale;
  messages: Messages;
  grouping?: DashboardGrouping;
  groupingBasePath?: string | undefined;
}

type UsageMetric = NonNullable<OperationsProvider["currentUsageSummary"]>["metrics"][number];

export function PageHeader({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {meta === undefined ? null : <div className="meta-stack">{meta}</div>}
    </header>
  );
}

export function ProviderSourceLink({
  provider,
  variant = "icon",
}: {
  provider: {
    displayName: string;
    setupLinks: readonly ProviderSetupLink[];
  };
  variant?: "button" | "icon";
}) {
  const link = primaryProviderSourceLink(provider.setupLinks);

  if (link === undefined) {
    return null;
  }

  const label = `${provider.displayName}: ${link.label}`;

  if (variant === "button") {
    return (
      <a
        aria-label={label}
        className="ghost-button header-control"
        href={link.href}
        rel="noreferrer"
        target="_blank"
        title={link.description}
      >
        <span>{link.label}</span>
        <ExternalLink aria-hidden="true" size={14} />
      </a>
    );
  }

  return (
    <a
      aria-label={label}
      className="icon-button"
      href={link.href}
      rel="noreferrer"
      target="_blank"
      title={link.description}
    >
      <ExternalLink aria-hidden="true" size={15} strokeWidth={1.8} />
    </a>
  );
}

export function DashboardTabs({
  locale,
  messages,
  active,
  grouping = "service",
}: {
  locale: Locale;
  messages: Messages;
  active: string;
  grouping?: DashboardGrouping;
}) {
  const items = [
    { key: "overview", href: `/${locale}/dashboard/overview`, label: messages.nav.overview },
    { key: "today", href: `/${locale}/dashboard/today`, label: messages.nav.today },
    { key: "forecast", href: `/${locale}/dashboard/forecast`, label: messages.nav.forecast },
    { key: "risks", href: `/${locale}/dashboard/risks`, label: messages.nav.risks },
  ];

  return (
    <nav className="tabs" aria-label={messages.nav.dashboard}>
      {items.map((item) => (
        <Link className={active === item.key ? "tab tab-active" : "tab"} href={hrefWithGrouping(item.href, grouping)} key={item.key}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function GroupingToggle({
  basePath,
  grouping,
  messages,
  wide = false,
}: {
  basePath?: string | undefined;
  grouping: DashboardGrouping;
  messages: Messages;
  wide?: boolean;
}) {
  if (basePath === undefined) {
    return null;
  }

  return (
    <nav className={wide ? "segmented-control segmented-control-wide" : "segmented-control"} aria-label={messages.dashboard.groupBy}>
      <Link
        className={grouping === "service" ? "segment segment-active" : "segment"}
        href={hrefWithGrouping(basePath, "service")}
      >
        {messages.dashboard.groupByService}
      </Link>
      <Link
        className={grouping === "connection" ? "segment segment-active" : "segment"}
        href={hrefWithGrouping(basePath, "connection")}
      >
        {messages.dashboard.groupByConnection}
      </Link>
    </nav>
  );
}

function hrefWithGrouping(href: string, grouping: DashboardGrouping): string {
  return grouping === "connection" ? `${href}?group=connection` : href;
}

export function OverviewView({ dashboard, locale, messages, grouping = "service", groupingBasePath }: ViewProps) {
  const widgets = {
    overview_meta: <DashboardMeta dashboard={dashboard} locale={locale} messages={messages} />,
    overview_metrics: (
      <section className="metric-grid">
        <MetricCard
          label={messages.dashboard.monthForecast}
          value={formatMinorAmount(dashboard.summary.monthForecastAmountMinor, dashboard.summary.currency, locale)}
          meta={`${messages.dashboard.canonicalCoverage}: ${dashboard.summary.canonicalCoverageDate ?? labelFor(messages, "missing")}`}
          progress={forecastCoveragePercent(dashboard)}
        />
        <MetricCard
          label={messages.dashboard.monthlyBudget}
          value={budgetValueLabel(dashboard, locale, messages)}
          meta={budgetUsageLabel(dashboard, locale, messages)}
          progress={dashboard.summary.budget.usagePercent ?? undefined}
          progressState={dashboard.summary.budget.riskLevel}
          warning={dashboard.summary.budget.riskLevel !== "low"}
        />
        <MetricCard
          label={messages.dashboard.confirmedThroughYesterday}
          value={formatMinorAmount(
            dashboard.summary.confirmedThroughYesterdayAmountMinor,
            dashboard.summary.currency,
            locale,
          )}
          meta={dashboard.timezone}
        />
        <MetricCard
          label={messages.dashboard.todayLive}
          value={
            dashboard.summary.todayLiveAmountMinor === null
              ? messages.dashboard.noLiveValue
              : formatMinorAmount(dashboard.summary.todayLiveAmountMinor, dashboard.summary.currency, locale)
          }
          meta={`${messages.dashboard.excludedProviders}: ${dashboard.summary.todayLiveExcludedProviderCount}`}
        />
        <MetricCard
          label={messages.dashboard.providersNeedingAttention}
          value={String(dashboard.summary.providersNeedingAttention)}
          meta={messages.dashboard.partial}
          warning={dashboard.summary.providersNeedingAttention > 0}
        />
      </section>
    ),
    overview_trend: (
      <UsageTrendPanel
        locale={locale}
        messages={messages}
        points={dashboard.usageTrend}
      />
    ),
    overview_grouping: (
      <div className="view-switch-row">
        <GroupingToggle
          basePath={groupingBasePath}
          grouping={grouping}
          messages={messages}
          wide
        />
      </div>
    ),
    overview_services: (
      <DashboardServicesTable
        dashboard={dashboard}
        locale={locale}
        messages={messages}
        grouping={grouping}
      />
    ),
    overview_insights: <DashboardInsightPanels dashboard={dashboard} locale={locale} messages={messages} />,
  } satisfies DashboardWidgetNodes;

  return (
    <DashboardWidgetLayout dashboard={dashboard} viewKey="overview" widgets={widgets} />
  );
}

export function TodayLiveView({ dashboard, locale, messages, grouping = "service", groupingBasePath }: ViewProps) {
  const rows = serviceRowsFor(dashboard, grouping);
  const liveStats = summarizeLiveRows(rows);
  const widgets = {
    today_main: (
      <div className="panel ops-main-panel">
        <div className="panel-header">
          <h2 className="panel-title">{messages.dashboard.todayTitle}</h2>
          <div className="panel-actions">
            <GroupingToggle
              basePath={groupingBasePath}
              grouping={grouping}
              messages={messages}
            />
            <LiveRefreshButton label={messages.dashboard.refresh} />
          </div>
        </div>
        <div className="status-strip">
          <StatusMetric label={messages.dashboard.includedProviders} value={String(liveStats.included)} state="live" messages={messages} />
          <StatusMetric label={messages.dashboard.excludedProviders} value={String(liveStats.excluded)} state={liveStats.excluded > 0 ? "warning" : "ok"} messages={messages} />
          <StatusMetric label={messages.services.confidence} value={liveStats.confidence} state={liveStats.confidence === "none" ? "stale" : "ok"} messages={messages} />
        </div>
        <TodayLiveDisplayTables
          dashboard={dashboard}
          locale={locale}
          messages={messages}
          rows={rows}
        />
      </div>
    ),
    today_rail: <TodayLiveRail dashboard={dashboard} rows={rows} locale={locale} messages={messages} />,
  } satisfies DashboardWidgetNodes;

  return (
    <DashboardWidgetLayout className="dashboard-widget-grid dashboard-widget-grid-ops" dashboard={dashboard} viewKey="today" widgets={widgets} />
  );
}

export function ForecastView({ dashboard, locale, messages, grouping = "service", groupingBasePath }: ViewProps) {
  const widgets = {
    forecast_metrics: (
      <section className="metric-grid">
        <MetricCard
          label={messages.dashboard.monthForecast}
          value={formatMinorAmount(dashboard.summary.monthForecastAmountMinor, dashboard.summary.currency, locale)}
          meta={`${messages.dashboard.remainingDays}: ${dashboard.summary.remainingDaysInMonth}`}
        />
        <MetricCard
          label={messages.dashboard.includedProviders}
          value={String(dashboard.summary.todayLiveIncludedProviderCount)}
          meta={messages.dashboard.provisional}
        />
        <MetricCard
          label={messages.dashboard.excludedProviders}
          value={String(dashboard.summary.todayLiveExcludedProviderCount)}
          meta={messages.dashboard.partial}
        />
        <MetricCard
          label={messages.dashboard.canonicalCoverage}
          value={dashboard.summary.canonicalCoverageDate ?? labelFor(messages, "missing")}
          meta={dashboard.timezone}
        />
      </section>
    ),
    forecast_table: (
      <ProviderSummaryTable
        dashboard={dashboard}
        locale={locale}
        messages={messages}
        grouping={grouping}
        groupingBasePath={groupingBasePath}
      />
    ),
    forecast_breakdown: <ForecastBreakdownPanel dashboard={dashboard} locale={locale} messages={messages} />,
  } satisfies DashboardWidgetNodes;

  return (
    <DashboardWidgetLayout className="dashboard-widget-grid dashboard-widget-grid-ops" dashboard={dashboard} viewKey="forecast" widgets={widgets} />
  );
}

export function RisksView({ dashboard, locale, messages, grouping = "service", groupingBasePath }: ViewProps) {
  const rows = serviceRowsFor(dashboard, grouping);
  const riskProviders = rows.filter(
    (provider) =>
      provider.riskLevel !== "low"
      || provider.healthStatus !== "ok"
      || provider.canonicalFreshness !== "fresh"
      || provider.liveFreshness !== "live",
  );

  const widgets = {
    risks_summary: <RiskSummaryCards dashboard={dashboard} rows={rows} messages={messages} />,
    risks_table: (
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{messages.dashboard.risksTitle}</h2>
          <div className="panel-actions">
            <GroupingToggle
              basePath={groupingBasePath}
              grouping={grouping}
              messages={messages}
            />
            <StatusBadge messages={messages} state={riskProviders.length > 0 ? "warning" : "ok"} />
          </div>
        </div>
        <div className="data-table-wrap">
          {riskProviders.length === 0 ? (
            <div className="empty-state">{messages.empty.noRisks}</div>
          ) : (
            <table className="data-table risk-table">
              <thead>
                <tr>
                  <th>{messages.table.provider}</th>
                  <th>{messages.table.risk}</th>
                  <th>{messages.table.health}</th>
                  <th>{messages.services.canonicalFreshness}</th>
                  <th>{messages.services.liveFreshness}</th>
                  <th>{messages.table.latest}</th>
                  <th><ServiceRemediationHeader locale={locale} /></th>
                </tr>
              </thead>
              <tbody>
                {riskProviders.map((provider) => (
                  <tr key={rowKey(provider)}>
                    <td>
                      <strong>{provider.displayName}</strong>
                      <div className="muted">{rowSubLabel(provider)}</div>
                    </td>
                    <td><StatusBadge messages={messages} state={provider.riskLevel} /></td>
                    <td><StatusBadge messages={messages} state={provider.healthStatus} /></td>
                    <td><StatusBadge messages={messages} state={provider.canonicalFreshness} /></td>
                    <td><StatusBadge messages={messages} state={provider.liveFreshness} /></td>
                    <td>{formatOptionalDate(provider.latestCanonicalSync, locale, dashboard.timezone, messages)}</td>
                    <td><ServiceRemediationSummary locale={locale} service={provider} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    ),
  } satisfies DashboardWidgetNodes;

  return (
    <DashboardWidgetLayout dashboard={dashboard} viewKey="risks" widgets={widgets} />
  );
}

export function ServicesOverview({ dashboard, locale, messages, grouping = "service", groupingBasePath }: ViewProps) {
  return (
    <div className="ops-grid">
      <ProviderSummaryTable
        dashboard={dashboard}
        locale={locale}
        messages={messages}
        grouping={grouping}
        groupingBasePath={groupingBasePath}
        serviceLinks
      />
      <ServicesRail dashboard={dashboard} messages={messages} />
    </div>
  );
}

export function ServiceDetail({
  locale,
  messages,
  provider,
  dashboard,
}: {
  locale: Locale;
  messages: Messages;
  provider: OperationsProvider;
  dashboard: OperationsDashboard;
}) {
  if (isLocalAiCliProvider(provider.providerKey)) {
    return <LocalAiCliServiceDetail dashboard={dashboard} locale={locale} messages={messages} provider={provider} />;
  }

  return (
    <div className="stack">
      <ServiceRemediationPanel locale={locale} service={provider} />
      <section className="metric-grid">
        <MetricCard
          label={messages.services.connection}
          value={labelFor(messages, provider.connectionState)}
          meta={`${messages.services.access}: ${messages.services.readOnly}`}
        />
        <MetricCard
          label={messages.services.canonicalFreshness}
          value={labelFor(messages, provider.canonicalFreshness)}
          meta={formatOptionalDate(provider.latestCanonicalSync, locale, dashboard.timezone, messages)}
        />
        <MetricCard
          label={messages.services.liveFreshness}
          value={labelFor(messages, provider.liveFreshness)}
          meta={labelFor(messages, provider.liveGranularity)}
        />
        <MetricCard
          label={messages.dashboard.monthForecast}
          value={formatMinorAmount(provider.monthForecastAmountMinor, provider.currency, locale)}
          meta={`${messages.dashboard.todayLive}: ${liveAmountLabel(provider, locale, messages)}`}
        />
      </section>
      {provider.usageTrend.length === 0 ? null : (
        <UsageTrendPanel
          locale={locale}
          messages={messages}
          points={provider.usageTrend}
        />
      )}
      <div className="two-column">
        <InfoPanel title={messages.services.cost}>
          <KeyValue label={messages.dashboard.confirmedThroughYesterday} value={formatMinorAmount(provider.confirmedAmountMinor, provider.currency, locale)} />
          <KeyValue label={messages.dashboard.todayLive} value={liveAmountLabel(provider, locale, messages)} />
          <KeyValue label={messages.dashboard.monthForecast} value={formatMinorAmount(provider.monthForecastAmountMinor, provider.currency, locale)} />
        </InfoPanel>
        <InfoPanel title={messages.services.usage}>
          <KeyValue label={messages.table.provider} value={provider.displayName} />
          <KeyValue label={messages.services.latestCanonicalSync} value={formatOptionalDate(provider.latestCanonicalSync, locale, dashboard.timezone, messages)} />
          <KeyValue label={messages.table.status} value={String(provider.usageSnapshotCount)} />
          <UsageSummaryBlock summary={provider.currentUsageSummary} locale={locale} messages={messages} />
        </InfoPanel>
      </div>
      {provider.providerKey === "aws" ? (
        <AwsServiceCostBreakdown
          locale={locale}
          messages={messages}
          provider={provider}
          timezone={dashboard.timezone}
        />
      ) : null}
      <div className="two-column">
        <InfoPanel title={messages.services.healthRisk}>
          <BadgeLine messages={messages} states={[provider.healthStatus, provider.riskLevel]} />
          <KeyValue label={messages.table.status} value={`${provider.alertCount}`} />
        </InfoPanel>
        <InfoPanel title={messages.services.dataConfidence}>
          <KeyValue label={messages.services.liveGranularity} value={labelFor(messages, provider.liveGranularity)} />
          <KeyValue label={messages.services.confidence} value={provider.liveConfidence} />
          <KeyValue label={messages.dashboard.canonicalCoverage} value={dashboard.summary.canonicalCoverageDate ?? labelFor(messages, "missing")} />
        </InfoPanel>
      </div>
      <div className="two-column">
        <InfoPanel title={messages.services.securityPermissions}>
          <div>
            <div className="metric-label">{messages.settings.requiredEnv}</div>
            <RequirementLinks provider={provider} messages={messages} />
          </div>
          <KeyValue label={messages.settings.credentialSource} value={labelFor(messages, provider.connectionState)} />
          <KeyValue label={messages.settings.readOnlyTest} value={labelFor(messages, provider.readOnlyTestState)} />
        </InfoPanel>
        <InfoPanel title={messages.services.emergencyActions}>
          <EmergencyActionsPanel locale={locale} messages={messages} provider={provider} />
        </InfoPanel>
      </div>
    </div>
  );
}

function AwsServiceCostBreakdown({
  locale,
  messages,
  provider,
  timezone,
}: {
  locale: Locale;
  messages: Messages;
  provider: OperationsProvider;
  timezone: string;
}) {
  return (
    <InfoPanel title={messages.services.serviceCostBreakdown}>
      <p className="muted">{messages.services.serviceCostBreakdownNote}</p>
      {provider.serviceCostBreakdown.length === 0 ? (
        <p className="muted">{messages.services.noServiceCosts}</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table usage-service-table">
            <thead>
              <tr>
                <th>{messages.dashboard.groupByService}</th>
                <th>{messages.services.serviceMetric}</th>
                <th>{messages.services.cost}</th>
                <th>{messages.services.serviceCostShare}</th>
                <th>{messages.services.latestCanonicalSync}</th>
              </tr>
            </thead>
            <tbody>
              {provider.serviceCostBreakdown.map((row) => (
                <tr key={`${row.service}:${row.metric}:${row.currency}:${row.collectedAt}`}>
                  <td>{row.service}</td>
                  <td>{row.metric}</td>
                  <td>{formatMinorAmount(row.amountMinor, row.currency, locale)}</td>
                  <td>{formatPercent(row.sharePercent, locale)}</td>
                  <td>{formatOptionalDate(row.collectedAt, locale, timezone, messages)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </InfoPanel>
  );
}

function LocalAiCliServiceDetail({
  locale,
  messages,
  provider,
  dashboard,
}: {
  locale: Locale;
  messages: Messages;
  provider: OperationsProvider;
  dashboard: OperationsDashboard;
}) {
  const summary = provider.currentUsageSummary;
  const fiveHourLimit = usageUsagePercentLabel(summary, "five_hour", locale) ??
    usageMetricValue(summary, "five_hour_tokens", locale) ??
    messages.services.noCurrentUsage;
  const weeklyLimit = usageUsagePercentLabel(summary, "weekly", locale) ??
    usageMetricValue(summary, "weekly_tokens", locale) ??
    messages.services.noCurrentUsage;
  const totalTokens = usageMetricValue(summary, "total_tokens", locale) ??
    usageMetricValue(summary, "input_tokens", locale) ??
    messages.services.noCurrentUsage;
  const contextValue = usageMetricValue(summary, "context_percent", locale) ??
    usageMetricValue(summary, "context_tokens", locale) ??
    messages.services.noCurrentUsage;

  return (
    <div className="stack">
      <ServiceRemediationPanel locale={locale} service={provider} />
      <section className="metric-grid">
        <MetricCard
          label={messages.services.fiveHourLimit}
          value={fiveHourLimit}
          meta={metricMeta(summary, "five_hour_remaining_tokens", locale, messages)}
        />
        <MetricCard
          label={messages.services.weeklyLimit}
          value={weeklyLimit}
          meta={metricMeta(summary, "weekly_remaining_tokens", locale, messages)}
        />
        <MetricCard
          label={messages.services.totalTokens}
          value={totalTokens}
          meta={messages.services.localCliUsageNote}
        />
        <MetricCard
          label={messages.services.contextPercent}
          value={contextValue}
          meta={metricMeta(summary, "context_tokens", locale, messages)}
        />
      </section>
      <div className="two-column">
        <InfoPanel title={messages.settings.localCliTitle}>
          <p className="muted">{messages.services.localCliUsageNote}</p>
          <UsageSummaryBlock summary={summary} locale={locale} messages={messages} />
        </InfoPanel>
        <InfoPanel title={messages.services.dataConfidence}>
          <KeyValue label={messages.services.liveGranularity} value={labelFor(messages, provider.liveGranularity)} />
          <KeyValue label={messages.services.confidence} value={provider.liveConfidence} />
          <KeyValue label={messages.services.latestLiveCheck} value={formatOptionalDate(provider.latestLiveCheck, locale, dashboard.timezone, messages)} />
          <KeyValue label={messages.settings.credentialSource} value={labelFor(messages, provider.connectionState)} />
        </InfoPanel>
      </div>
      <div className="two-column">
        <InfoPanel title={messages.services.securityPermissions}>
          <div>
            <div className="metric-label">{messages.settings.requiredEnv}</div>
            <RequirementLinks provider={provider} messages={messages} />
          </div>
          <KeyValue label={messages.settings.readOnlyTest} value={labelFor(messages, provider.readOnlyTestState)} />
          <KeyValue label={messages.services.currentUsage} value={summary === null ? messages.services.noCurrentUsage : messages.dashboard.provisional} />
        </InfoPanel>
        <InfoPanel title={messages.services.healthRisk}>
          <BadgeLine messages={messages} states={[provider.liveFreshness, provider.healthStatus, provider.riskLevel]} />
          <KeyValue label={messages.table.status} value={`${provider.alertCount}`} />
        </InfoPanel>
      </div>
      <InfoPanel title={messages.services.emergencyActions}>
        <EmergencyActionsPanel locale={locale} messages={messages} provider={provider} />
      </InfoPanel>
    </div>
  );
}

export function ProviderCatalogView({
  providers,
  locale,
  messages,
}: {
  providers: readonly ProviderCatalogItem[];
  locale: Locale;
  messages: Messages;
}) {
  const displayProviders = mergeCodexCatalogProviders(providers);

  return (
    <div className="catalog-grid">
      {displayProviders.map((provider) => (
        <article className="catalog-card" key={provider.key}>
          <div className="catalog-card-header">
            <ProviderIcon
              className={`provider-mark provider-mark-${provider.key} catalog-provider-mark`}
              providerKey={provider.key}
            />
            <div>
              <h2 className="panel-title">{provider.name}</h2>
              <p className="metric-meta">{provider.category}</p>
            </div>
          </div>
          <div className="badge-row">
            <StatusBadge messages={messages} state={provider.status} />
            <StatusBadge messages={messages} state={provider.liveGranularity} />
          </div>
          <KeyValue label={messages.catalog.auth} value={provider.authMethods.join(", ")} />
          <KeyValue label={messages.catalog.data} value={provider.dataSurfaces.join(", ")} />
          <Link
            className={provider.status === "available" ? "primary-button" : "ghost-button"}
            href={`/${locale}/settings/connections#${provider.key}`}
          >
            {messages.catalog.connect}
          </Link>
        </article>
      ))}
    </div>
  );
}

function mergeCodexCatalogProviders(providers: readonly ProviderCatalogItem[]): ProviderCatalogItem[] {
  const codexProviders = providers.filter((provider) => provider.key === "codex-app" || provider.key === "codex-cli");

  if (codexProviders.length < 2) {
    return [...providers];
  }

  const appProvider = codexProviders.find((provider) => provider.key === "codex-app") ?? codexProviders[0]!;
  const cliProvider = codexProviders.find((provider) => provider.key === "codex-cli");
  const merged: ProviderCatalogItem = {
    ...appProvider,
    name: "Codex",
    authMethods: uniqueStrings(codexProviders.flatMap((provider) => provider.authMethods)),
    dataSurfaces: uniqueStrings(codexProviders.flatMap((provider) => provider.dataSurfaces)),
    requiredEnvKeys: uniqueStrings(codexProviders.flatMap((provider) => provider.requiredEnvKeys)),
    credentialRequirements: uniqueStrings(codexProviders.flatMap((provider) => provider.credentialRequirements)),
    setupLinks: uniqueProviderSetupLinks([
      ...appProvider.setupLinks,
      ...(cliProvider?.setupLinks ?? []),
    ]),
  };
  let inserted = false;

  return providers.flatMap((provider) => {
    if (provider.key !== "codex-app" && provider.key !== "codex-cli") {
      return [provider];
    }

    if (inserted) {
      return [];
    }

    inserted = true;
    return [merged];
  });
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function uniqueProviderSetupLinks(links: readonly ProviderSetupLink[]): ProviderSetupLink[] {
  const byKey = new Map<string, ProviderSetupLink>();

  for (const link of links) {
    byKey.set(`${link.href}:${link.label}`, link);
  }

  return [...byKey.values()];
}

export function ConnectionsView({ dashboard, locale, messages }: ViewProps) {
  return (
    <div className="stack">
      <div className="connection-card-list">
        {dashboard.providers.map((provider) => (
          <ConnectionCard key={provider.providerKey} locale={locale} messages={messages} provider={provider} />
        ))}
      </div>
    </div>
  );
}

export function PreferencesView({ dashboard, locale, messages }: ViewProps) {
  return (
    <div className="stack">
      <div className="two-column">
        <InfoPanel title={messages.settings.preferencesTitle}>
          <KeyValue label={messages.settings.defaultLocale} value={locale.toUpperCase()} />
          <div id="timezone">
            <KeyValue label={messages.settings.dashboardTimezone} value={dashboard.timezone} />
          </div>
          <KeyValue label={messages.settings.defaultStart} value={messages.nav.overview} />
          <KeyValue label={messages.settings.currencyDisplay} value={dashboard.summary.currency} />
          <KeyValue label={messages.settings.refreshTtl} value="60s" />
          <KeyValue label={messages.settings.density} value="comfortable" />
        </InfoPanel>
        <InfoPanel title={messages.settings.telemetry}>
          <KeyValue label={messages.settings.telemetry} value={messages.settings.off} />
        </InfoPanel>
        <InfoPanel title={locale === "ko" ? "로컬 런타임" : locale === "ja" ? "ローカルランタイム" : "Local runtime"}>
          <RuntimeShutdownButton locale={locale} />
        </InfoPanel>
      </div>
      <BudgetSettings currentCurrency={dashboard.summary.currency} messages={messages} />
      <DashboardDisplaySettings messages={messages} />
    </div>
  );
}

function TodayLiveDisplayTables({
  dashboard,
  locale,
  messages,
  rows,
}: {
  dashboard: OperationsDashboard;
  locale: Locale;
  messages: Messages;
  rows: readonly OperationsRow[];
}) {
  const { amountRows, usageRows } = splitRowsByDisplay(rows);
  const amountTitle = serviceGroupTitle(messages.services.cost, messages);
  const usageTitle = serviceGroupTitle(messages.services.usage, messages);

  return (
    <div className="split-table-stack split-table-stack-inner">
      <section className="data-table-section">
        <div className="table-section-header">
          <h3 className="panel-title">{amountTitle}</h3>
          <span className="metric-meta">{amountRows.length}</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table amount-service-table">
            <thead>
              <tr>
                <th>{messages.table.provider}</th>
                <th>{messages.dashboard.todayLive}</th>
                <th>{messages.services.liveFreshness}</th>
                <th>{messages.services.liveGranularity}</th>
                <th>{messages.services.latestLiveCheck}</th>
                <th>{messages.services.confidence}</th>
                <th><ServiceRemediationHeader locale={locale} /></th>
              </tr>
            </thead>
            <tbody>
              {amountRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>{emptyGroupLabel(amountTitle, rows.length, messages)}</td>
                </tr>
              ) : (
                amountRows.map((provider) => (
                  <tr key={rowKey(provider)}>
                    <td>
                      <strong>{provider.displayName}</strong>
                      <div className="muted">{rowSubLabel(provider)}</div>
                    </td>
                    <td>
                      {amountTodayLiveLabel(provider, locale, messages)}
                      <div className="badge-row">
                        <StatusBadge messages={messages} state="provisional" text={messages.dashboard.provisional} />
                        {!provider.todayLiveIncluded ? (
                          <StatusBadge messages={messages} state="stale" text={messages.dashboard.partial} />
                        ) : null}
                      </div>
                    </td>
                    <td><StatusBadge messages={messages} state={provider.liveFreshness} /></td>
                    <td>{labelFor(messages, provider.liveGranularity)}</td>
                    <td>{formatOptionalDate(provider.latestLiveCheck, locale, dashboard.timezone, messages)}</td>
                    <td>{provider.liveConfidence}</td>
                    <td><ServiceRemediationSummary locale={locale} service={provider} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="data-table-section">
        <div className="table-section-header">
          <h3 className="panel-title">{usageTitle}</h3>
          <span className="metric-meta">{usageRows.length}</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table usage-service-table">
            <thead>
              <tr>
                <th>{messages.table.provider}</th>
                <th>{messages.services.fiveHourLimit}</th>
                <th>{messages.services.weeklyLimit}</th>
                <th>{messages.services.currentUsage}</th>
                <th>{messages.services.latestLiveCheck}</th>
                <th>{messages.services.confidence}</th>
                <th><ServiceRemediationHeader locale={locale} /></th>
              </tr>
            </thead>
            <tbody>
              {usageRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>{emptyGroupLabel(usageTitle, rows.length, messages)}</td>
                </tr>
              ) : (
                usageRows.map((provider) => (
                  <tr key={rowKey(provider)}>
                    <td>
                      <strong>{provider.displayName}</strong>
                      <div className="muted">{rowSubLabel(provider)}</div>
                    </td>
                    <td>{rowFiveHourUsageLabel(provider, locale, messages)}</td>
                    <td>{rowWeeklyUsageLabel(provider, locale, messages)}</td>
                    <td>{renderUsageSummary(provider.currentUsageSummary, locale, messages, dashboardMetricKeysForRow(provider, dashboard))}</td>
                    <td>{formatOptionalDate(provider.latestLiveCheck, locale, dashboard.timezone, messages)}</td>
                    <td>{provider.liveConfidence}</td>
                    <td><ServiceRemediationSummary locale={locale} service={provider} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TodayLiveRail({
  dashboard,
  rows,
  locale,
  messages,
}: {
  dashboard: OperationsDashboard;
  rows: readonly OperationsRow[];
  locale: Locale;
  messages: Messages;
}) {
  const liveRows = rows
    .filter((row) => row.todayLiveAmountMinor !== null || row.currentUsageSummary !== null)
    .slice(0, 4);
  const latestLiveCheck = latestDateValue(rows.map((row) => row.latestLiveCheck).filter((value): value is string => value !== null));

  return (
    <aside className="panel ops-rail">
      <div className="panel-header compact-header">
        <h2 className="panel-title">{messages.dashboard.todayLive}</h2>
        <StatusBadge messages={messages} state={liveRows.length > 0 ? "live" : "stale"} />
      </div>
      <div className="panel-body ops-rail-body">
        <KeyValue
          label={messages.services.latestLiveCheck}
          value={formatOptionalDate(latestLiveCheck, locale, dashboard.timezone, messages)}
        />
        <KeyValue
          label={messages.dashboard.todayLive}
          value={
            dashboard.summary.todayLiveAmountMinor === null
              ? messages.dashboard.noLiveValue
              : formatMinorAmount(dashboard.summary.todayLiveAmountMinor, dashboard.summary.currency, locale)
          }
        />
        <div className="rail-list">
          {liveRows.length === 0 ? (
            <p className="muted">{messages.services.noCurrentUsage}</p>
          ) : (
            liveRows.map((row) => (
              <div className="rail-row" key={rowKey(row)}>
                <div>
                  <strong>{row.displayName}</strong>
                  <div className="metric-meta">{rowSubLabel(row)}</div>
                </div>
                <StatusBadge messages={messages} state={row.liveFreshness} />
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function ForecastBreakdownPanel({
  dashboard,
  locale,
  messages,
}: {
  dashboard: OperationsDashboard;
  locale: Locale;
  messages: Messages;
}) {
  const todayLive = dashboard.summary.todayLiveAmountMinor ?? 0;
  const projected = Math.max(
    dashboard.summary.monthForecastAmountMinor -
      dashboard.summary.confirmedThroughYesterdayAmountMinor -
      todayLive,
    0,
  );

  return (
    <section className="panel forecast-breakdown">
      <div className="panel-header compact-header">
        <h2 className="panel-title">{messages.dashboard.forecastTitle}</h2>
        <span className="metric-meta">{messages.dashboard.remainingDays}: {dashboard.summary.remainingDaysInMonth}</span>
      </div>
      <div className="panel-body forecast-body">
        <div className="forecast-ring" style={forecastRingStyle(dashboard)} aria-hidden="true">
          <span>{forecastCoveragePercent(dashboard)}%</span>
        </div>
        <div className="forecast-stack">
          <KeyValue
            label={messages.dashboard.confirmedThroughYesterday}
            value={formatMinorAmount(
              dashboard.summary.confirmedThroughYesterdayAmountMinor,
              dashboard.summary.currency,
              locale,
            )}
          />
          <KeyValue
            label={messages.dashboard.todayLive}
            value={
              dashboard.summary.todayLiveAmountMinor === null
                ? messages.dashboard.noLiveValue
                : formatMinorAmount(todayLive, dashboard.summary.currency, locale)
            }
          />
          <KeyValue
            label={messages.dashboard.monthForecast}
            value={formatMinorAmount(projected, dashboard.summary.currency, locale)}
          />
        </div>
      </div>
    </section>
  );
}

function RiskSummaryCards({
  dashboard,
  rows,
  messages,
}: {
  dashboard: OperationsDashboard;
  rows: readonly OperationsRow[];
  messages: Messages;
}) {
  const staleLive = rows.filter((row) => row.liveFreshness !== "live").length;
  const missingCanonical = rows.filter((row) => row.canonicalFreshness !== "fresh").length;
  const healthIssues = rows.filter((row) => row.healthStatus !== "ok").length;
  const credentialIssues = rows.filter((row) =>
    row.connectionState === "locked" ||
    row.connectionState === "expired" ||
    row.connectionState === "invalid" ||
    row.connectionState === "not_configured"
  ).length;

  return (
    <section className="risk-summary-grid">
      <StatusMetric
        label={messages.dashboard.budgetRisk}
        value={dashboard.summary.budget.usagePercent === null ? messages.dashboard.budgetNotSet : `${dashboard.summary.budget.usagePercent}%`}
        state={dashboard.summary.budget.status === "not_configured" ? "stale" : dashboard.summary.budget.riskLevel}
        messages={messages}
      />
      <StatusMetric label={messages.services.liveFreshness} value={String(staleLive)} state={staleLive > 0 ? "warning" : "ok"} messages={messages} />
      <StatusMetric label={messages.services.canonicalFreshness} value={String(missingCanonical)} state={missingCanonical > 0 ? "warning" : "ok"} messages={messages} />
      <StatusMetric label={messages.services.healthRisk} value={String(healthIssues)} state={healthIssues > 0 ? "critical" : "ok"} messages={messages} />
      <StatusMetric label={messages.services.connection} value={String(credentialIssues)} state={credentialIssues > 0 ? "invalid" : "ok"} messages={messages} />
    </section>
  );
}

function ServicesRail({ dashboard, messages }: { dashboard: OperationsDashboard; messages: Messages }) {
  const attention = dashboard.visibleProviders.filter(providerNeedsAttentionForView);
  const connected = dashboard.visibleProviders.length;
  const liveReady = dashboard.visibleProviders.filter((provider) => provider.liveFreshness === "live").length;

  return (
    <aside className="panel ops-rail">
      <div className="panel-header compact-header">
        <h2 className="panel-title">{messages.nav.services}</h2>
        <StatusBadge messages={messages} state={attention.length > 0 ? "warning" : "ok"} />
      </div>
      <div className="panel-body ops-rail-body">
        <div className="rail-stat-grid">
          <StatusMetric label={messages.nav.connections} value={String(connected)} state={connected > 0 ? "ok" : "stale"} messages={messages} />
          <StatusMetric label={messages.dashboard.providersNeedingAttention} value={String(attention.length)} state={attention.length > 0 ? "warning" : "ok"} messages={messages} />
          <StatusMetric label={messages.dashboard.todayLive} value={String(liveReady)} state={liveReady > 0 ? "live" : "stale"} messages={messages} />
        </div>
        <div className="rail-list">
          {dashboard.visibleProviders.slice(0, 6).map((provider) => (
            <div className="rail-row" key={provider.providerKey}>
              <div>
                <strong>{provider.displayName}</strong>
                <div className="metric-meta">{provider.providerKey}</div>
              </div>
              <StatusBadge messages={messages} state={provider.riskLevel} />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function StatusMetric({
  label,
  value,
  state,
  messages,
}: {
  label: string;
  value: string;
  state: string;
  messages: Messages;
}) {
  return (
    <div className="status-metric">
      <div>
        <div className="metric-label">{label}</div>
        <strong>{value}</strong>
      </div>
      <StatusBadge messages={messages} state={state} />
    </div>
  );
}

interface UsageTrendSeries {
  metric: string;
  unit: string;
  points: UsageTrendSeriesPoint[];
}

interface UsageTrendSeriesPoint {
  date: string;
  value: number;
  sampleCount: number;
  latestCollectedAt: string;
}

function UsageTrendPanel({
  locale,
  messages,
  points,
}: {
  locale: Locale;
  messages: Messages;
  points: readonly OperationsUsageTrendPoint[];
}) {
  const series = selectUsageTrendSeries(points);

  return (
    <section className="panel usage-trend-panel">
      <div className="panel-header compact-header">
        <div className="usage-trend-title">
          <h2 className="panel-title">{messages.dashboard.dailyUsageTrend}</h2>
          <p className="metric-meta">
            {series === null
              ? messages.dashboard.dailyUsageTrendNote
              : `${usageMetricLabel(series.metric, messages)} · ${series.unit}`}
          </p>
        </div>
        <StatusBadge messages={messages} state={series === null ? "missing" : "fresh"} />
      </div>
      <div className="panel-body">
        {series === null ? (
          <p className="muted">{messages.dashboard.noDailyUsageTrend}</p>
        ) : (
          <DailyUsageChart
            locale={locale}
            series={series}
          />
        )}
      </div>
    </section>
  );
}

function DailyUsageChart({
  locale,
  series,
}: {
  locale: Locale;
  series: UsageTrendSeries;
}) {
  const width = 640;
  const height = 214;
  const chartLeft = 46;
  const chartRight = 14;
  const chartTop = 14;
  const chartBottom = 48;
  const chartWidth = width - chartLeft - chartRight;
  const chartHeight = height - chartTop - chartBottom;
  const maxValue = Math.max(...series.points.map((point) => Math.max(point.value, 0)), 1);
  const step = chartWidth / Math.max(series.points.length, 1);
  const barWidth = Math.min(42, Math.max(12, step * 0.58));
  const labelEvery = Math.max(1, Math.ceil(series.points.length / 7));
  const latestPoint = series.points[series.points.length - 1];

  return (
    <div className="usage-trend-chart">
      {latestPoint === undefined ? null : (
        <div className="usage-trend-summary">
          <strong>{formatTrendValue(latestPoint.value, series.unit, locale)}</strong>
          <span>{formatDateKey(latestPoint.date, locale)}</span>
        </div>
      )}
      <svg
        aria-label={messagesForChart(series, locale)}
        className="usage-trend-svg"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0.5, 1].map((ratio) => {
          const y = chartTop + chartHeight - chartHeight * ratio;

          return (
            <g key={ratio}>
              <line
                className="usage-trend-grid"
                x1={chartLeft}
                x2={width - chartRight}
                y1={y}
                y2={y}
              />
              <text className="usage-trend-axis" textAnchor="end" x={chartLeft - 8} y={y + 4}>
                {formatTrendAxisValue(maxValue * ratio, series.unit, locale)}
              </text>
            </g>
          );
        })}
        <line
          className="usage-trend-axis-line"
          x1={chartLeft}
          x2={width - chartRight}
          y1={chartTop + chartHeight}
          y2={chartTop + chartHeight}
        />
        {series.points.map((point, index) => {
          const barHeight = chartHeight * (Math.max(point.value, 0) / maxValue);
          const x = chartLeft + index * step + (step - barWidth) / 2;
          const y = chartTop + chartHeight - barHeight;

          return (
            <g key={point.date}>
              <rect
                className="usage-trend-bar"
                height={Math.max(barHeight, point.value > 0 ? 2 : 0)}
                rx="3"
                width={barWidth}
                x={x}
                y={y}
              >
                <title>{`${formatDateKey(point.date, locale)} ${formatTrendValue(point.value, series.unit, locale)}`}</title>
              </rect>
              {index % labelEvery === 0 || index === series.points.length - 1 ? (
                <text
                  className="usage-trend-label"
                  textAnchor="middle"
                  x={x + barWidth / 2}
                  y={height - 18}
                >
                  {formatDateKey(point.date, locale)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function selectUsageTrendSeries(points: readonly OperationsUsageTrendPoint[]): UsageTrendSeries | null {
  const buckets = new Map<string, {
    metric: string;
    unit: string;
    latestCollectedAt: string;
    total: number;
    pointsByDate: Map<string, UsageTrendSeriesPoint>;
  }>();

  for (const point of points) {
    if (!Number.isFinite(point.value)) {
      continue;
    }

    const key = [point.metric, point.unit].join("\u001f");
    const bucket = buckets.get(key) ?? {
      metric: point.metric,
      unit: point.unit,
      latestCollectedAt: point.latestCollectedAt,
      total: 0,
      pointsByDate: new Map<string, UsageTrendSeriesPoint>(),
    };
    const datePoint = bucket.pointsByDate.get(point.date) ?? {
      date: point.date,
      value: 0,
      sampleCount: 0,
      latestCollectedAt: point.latestCollectedAt,
    };

    datePoint.value += point.value;
    datePoint.sampleCount += point.sampleCount;

    if (point.latestCollectedAt > datePoint.latestCollectedAt) {
      datePoint.latestCollectedAt = point.latestCollectedAt;
    }

    bucket.pointsByDate.set(point.date, datePoint);
    bucket.total += Math.abs(point.value);

    if (point.latestCollectedAt > bucket.latestCollectedAt) {
      bucket.latestCollectedAt = point.latestCollectedAt;
    }

    buckets.set(key, bucket);
  }

  const selected = [...buckets.values()].sort((first, second) => {
    const unitOrder = usageTrendRank(first.metric, first.unit) - usageTrendRank(second.metric, second.unit);

    if (unitOrder !== 0) {
      return unitOrder;
    }

    const latestOrder = second.latestCollectedAt.localeCompare(first.latestCollectedAt);

    if (latestOrder !== 0) {
      return latestOrder;
    }

    return second.total - first.total;
  })[0];

  if (selected === undefined) {
    return null;
  }

  return {
    metric: selected.metric,
    unit: selected.unit,
    points: [...selected.pointsByDate.values()].sort((first, second) => first.date.localeCompare(second.date)),
  };
}

function usageTrendRank(metric: string, unit: string): number {
  if (metric === "unblended_cost" || isCurrencyUnit(unit.toUpperCase())) {
    return 0;
  }

  if (unit === "tokens") {
    return 1;
  }

  if (unit === "requests" || unit === "count") {
    return 2;
  }

  return 3;
}

function messagesForChart(series: UsageTrendSeries, locale: Locale): string {
  const latestPoint = series.points[series.points.length - 1];

  return latestPoint === undefined
    ? series.metric
    : `${series.metric} ${formatDateKey(latestPoint.date, locale)} ${formatTrendValue(latestPoint.value, series.unit, locale)}`;
}

function DashboardServicesTable({
  dashboard,
  locale,
  messages,
  grouping = "service",
}: ViewProps) {
  const rows = serviceRowsFor(dashboard, grouping);
  const { amountRows, usageRows } = splitRowsByDisplay(rows);

  return (
    <div className="split-table-stack">
      <DashboardAmountServicesTable
        locale={locale}
        messages={messages}
        rows={amountRows}
        totalRows={rows.length}
      />
      <DashboardUsageServicesTable
        dashboard={dashboard}
        locale={locale}
        messages={messages}
        rows={usageRows}
        totalRows={rows.length}
      />
    </div>
  );
}

function ProviderSummaryTable({
  dashboard,
  locale,
  messages,
  grouping = "service",
  groupingBasePath,
  serviceLinks = false,
}: ViewProps & { serviceLinks?: boolean }) {
  const rows = serviceRowsFor(dashboard, grouping);
  const { amountRows, usageRows } = splitRowsByDisplay(rows);

  return (
    <div className="split-table-stack">
      <ProviderAmountSummaryTable
        dashboard={dashboard}
        grouping={grouping}
        groupingBasePath={groupingBasePath}
        locale={locale}
        messages={messages}
        rows={amountRows}
        serviceLinks={serviceLinks}
        totalRows={rows.length}
      />
      <ProviderUsageSummaryTable
        dashboard={dashboard}
        grouping={grouping}
        groupingBasePath={groupingBasePath}
        locale={locale}
        messages={messages}
        rows={usageRows}
        serviceLinks={serviceLinks}
        totalRows={rows.length}
      />
    </div>
  );
}

function DashboardAmountServicesTable({
  locale,
  messages,
  rows,
  totalRows,
}: {
  locale: Locale;
  messages: Messages;
  rows: readonly OperationsRow[];
  totalRows: number;
}) {
  const title = serviceGroupTitle(messages.services.cost, messages);

  return (
    <div className="panel panel-table-only">
      <div className="panel-header compact-header">
        <h2 className="panel-title">{title}</h2>
        <StatusBadge messages={messages} state={rows.length > 0 ? "ok" : "stale"} />
      </div>
      <div className="data-table-wrap">
        <table className="data-table dashboard-service-table">
          <thead>
            <tr>
              <th>{messages.table.provider}</th>
              <th>{messages.services.title}</th>
              <th>{messages.table.status}</th>
              <th>{messages.dashboard.monthForecast}</th>
              <th>{messages.dashboard.confirmedThroughYesterday}</th>
              <th>{messages.dashboard.todayLive}</th>
              <th>{messages.dashboard.confirmedCoverage}</th>
              <th><ServiceRemediationHeader locale={locale} /></th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9}>{emptyGroupLabel(title, totalRows, messages)}</td>
              </tr>
            ) : (
              rows.map((provider) => {
                const ratio = provider.monthForecastAmountMinor <= 0
                  ? 0
                  : Math.min(100, Math.round((provider.confirmedAmountMinor / provider.monthForecastAmountMinor) * 100));

                return (
                  <tr key={rowKey(provider)}>
                    <td>{serviceNameCell(provider)}</td>
                    <td>{rowSubLabel(provider)}</td>
                    <td>
                      <span className="status-dot-line">
                        <span className={`tiny-dot tiny-dot-${provider.healthStatus}`} aria-hidden="true" />
                        {labelFor(messages, provider.healthStatus)}
                      </span>
                    </td>
                    <td>{formatMinorAmount(provider.monthForecastAmountMinor, provider.currency, locale)}</td>
                    <td>{formatMinorAmount(provider.confirmedAmountMinor, provider.currency, locale)}</td>
                    <td>{amountTodayLiveLabel(provider, locale, messages)}</td>
                    <td>
                      <div className="table-progress-cell">
                        <span>{ratio}%</span>
                        <ProgressBar value={ratio} state="low" />
                      </div>
                    </td>
                    <td><ServiceRemediationSummary locale={locale} service={provider} /></td>
                    <td className="table-action-cell">
                      <div className="table-action-buttons">
                        <ProviderSourceLink provider={provider} />
                        <ServiceDetailLink locale={locale} messages={messages} row={provider} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{title}: {rows.length}</span>
        <span className="pager-dots">1 / 1</span>
      </div>
    </div>
  );
}

function DashboardUsageServicesTable({
  dashboard,
  locale,
  messages,
  rows,
  totalRows,
}: {
  dashboard: OperationsDashboard;
  locale: Locale;
  messages: Messages;
  rows: readonly OperationsRow[];
  totalRows: number;
}) {
  const title = serviceGroupTitle(messages.services.usage, messages);

  return (
    <div className="panel panel-table-only">
      <div className="panel-header compact-header">
        <h2 className="panel-title">{title}</h2>
        <StatusBadge messages={messages} state={rows.length > 0 ? "live" : "stale"} />
      </div>
      <div className="data-table-wrap">
        <table className="data-table dashboard-service-table usage-service-table">
          <thead>
            <tr>
              <th>{messages.table.provider}</th>
              <th>{messages.services.title}</th>
              <th>{messages.services.fiveHourLimit}</th>
              <th>{messages.services.weeklyLimit}</th>
              <th>{messages.services.currentUsage}</th>
              <th>{messages.services.latestLiveCheck}</th>
              <th>{messages.services.confidence}</th>
              <th><ServiceRemediationHeader locale={locale} /></th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9}>{emptyGroupLabel(title, totalRows, messages)}</td>
              </tr>
            ) : (
              rows.map((provider) => (
                <tr key={rowKey(provider)}>
                  <td>{serviceNameCell(provider)}</td>
                  <td>{rowSubLabel(provider)}</td>
                  <td>{rowFiveHourUsageLabel(provider, locale, messages)}</td>
                  <td>{rowWeeklyUsageLabel(provider, locale, messages)}</td>
                  <td>{renderUsageSummary(provider.currentUsageSummary, locale, messages, dashboardMetricKeysForRow(provider, dashboard))}</td>
                  <td>{formatOptionalDate(provider.latestLiveCheck, locale, dashboard.timezone, messages)}</td>
                  <td>{provider.liveConfidence}</td>
                  <td><ServiceRemediationSummary locale={locale} service={provider} /></td>
                  <td className="table-action-cell">
                    <div className="table-action-buttons">
                      <ProviderSourceLink provider={provider} />
                      <ServiceDetailLink locale={locale} messages={messages} row={provider} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{title}: {rows.length}</span>
        <span className="pager-dots">1 / 1</span>
      </div>
    </div>
  );
}

function ProviderAmountSummaryTable({
  dashboard,
  grouping,
  groupingBasePath,
  locale,
  messages,
  rows,
  serviceLinks,
  totalRows,
}: {
  dashboard: OperationsDashboard;
  grouping: DashboardGrouping;
  groupingBasePath: string | undefined;
  locale: Locale;
  messages: Messages;
  rows: readonly OperationsRow[];
  serviceLinks: boolean;
  totalRows: number;
}) {
  const title = serviceGroupTitle(messages.services.cost, messages);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <div className="panel-actions">
          <GroupingToggle
            basePath={groupingBasePath}
            grouping={grouping}
            messages={messages}
          />
          <StatusBadge messages={messages} state={rows.some((row) => row.riskLevel !== "low") ? "warning" : "ok"} />
        </div>
      </div>
      <div className="data-table-wrap">
        <table className="data-table amount-service-table">
          <thead>
            <tr>
              <th>{messages.table.provider}</th>
              <th>{messages.dashboard.monthForecast}</th>
              <th>{messages.dashboard.confirmedThroughYesterday}</th>
              <th>{messages.dashboard.todayLive}</th>
              <th>{messages.services.canonicalFreshness}</th>
              <th>{messages.services.liveFreshness}</th>
              <th>{messages.table.health}</th>
              <th>{messages.table.latest}</th>
              <th><ServiceRemediationHeader locale={locale} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9}>{emptyGroupLabel(title, totalRows, messages)}</td>
              </tr>
            ) : (
              rows.map((provider) => (
                <tr key={rowKey(provider)}>
                  <td>{summaryServiceNameCell(provider, locale, serviceLinks)}</td>
                  <td>{formatMinorAmount(provider.monthForecastAmountMinor, provider.currency, locale)}</td>
                  <td>{formatMinorAmount(provider.confirmedAmountMinor, provider.currency, locale)}</td>
                  <td>{amountTodayLiveLabel(provider, locale, messages)}</td>
                  <td><StatusBadge messages={messages} state={provider.canonicalFreshness} /></td>
                  <td><StatusBadge messages={messages} state={provider.liveFreshness} /></td>
                  <td><StatusBadge messages={messages} state={provider.healthStatus} /></td>
                  <td>{formatOptionalDate(provider.latestCanonicalSync, locale, dashboard.timezone, messages)}</td>
                  <td><ServiceRemediationSummary locale={locale} service={provider} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProviderUsageSummaryTable({
  dashboard,
  grouping,
  groupingBasePath,
  locale,
  messages,
  rows,
  serviceLinks,
  totalRows,
}: {
  dashboard: OperationsDashboard;
  grouping: DashboardGrouping;
  groupingBasePath: string | undefined;
  locale: Locale;
  messages: Messages;
  rows: readonly OperationsRow[];
  serviceLinks: boolean;
  totalRows: number;
}) {
  const title = serviceGroupTitle(messages.services.usage, messages);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <div className="panel-actions">
          <GroupingToggle
            basePath={groupingBasePath}
            grouping={grouping}
            messages={messages}
          />
          <StatusBadge messages={messages} state={rows.some((row) => row.liveFreshness !== "live") ? "warning" : "live"} />
        </div>
      </div>
      <div className="data-table-wrap">
        <table className="data-table usage-service-table">
          <thead>
            <tr>
              <th>{messages.table.provider}</th>
              <th>{messages.services.fiveHourLimit}</th>
              <th>{messages.services.weeklyLimit}</th>
              <th>{messages.services.currentUsage}</th>
              <th>{messages.services.liveFreshness}</th>
              <th>{messages.services.latestLiveCheck}</th>
              <th>{messages.services.confidence}</th>
              <th>{messages.table.health}</th>
              <th><ServiceRemediationHeader locale={locale} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9}>{emptyGroupLabel(title, totalRows, messages)}</td>
              </tr>
            ) : (
              rows.map((provider) => (
                <tr key={rowKey(provider)}>
                  <td>{summaryServiceNameCell(provider, locale, serviceLinks)}</td>
                  <td>{rowFiveHourUsageLabel(provider, locale, messages)}</td>
                  <td>{rowWeeklyUsageLabel(provider, locale, messages)}</td>
                  <td>{renderUsageSummary(provider.currentUsageSummary, locale, messages, dashboardMetricKeysForRow(provider, dashboard))}</td>
                  <td><StatusBadge messages={messages} state={provider.liveFreshness} /></td>
                  <td>{formatOptionalDate(provider.latestLiveCheck, locale, dashboard.timezone, messages)}</td>
                  <td>{provider.liveConfidence}</td>
                  <td><StatusBadge messages={messages} state={provider.healthStatus} /></td>
                  <td><ServiceRemediationSummary locale={locale} service={provider} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardInsightPanels({
  dashboard,
  locale,
  messages,
}: {
  dashboard: OperationsDashboard;
  locale: Locale;
  messages: Messages;
}) {
  const liveRows = dashboard.visibleProviders
    .filter((provider) => provider.currentUsageSummary !== null || provider.todayLiveAmountMinor !== null)
    .slice(0, 5);

  return (
    <section className="insight-grid">
      <div className="panel">
        <div className="panel-header compact-header">
          <h2 className="panel-title">{messages.services.currentUsage}</h2>
          <StatusBadge messages={messages} state={dashboard.summary.todayLiveAmountMinor === null ? "stale" : "live"} />
        </div>
        <div className="panel-body">
          {liveRows.length === 0 ? (
            <p className="muted">{messages.services.noCurrentUsage}</p>
          ) : (
            <div className="insight-list">
              {liveRows.map((provider) => (
                <div className="insight-row" key={provider.providerKey}>
                  <div>
                    <strong>{provider.displayName}</strong>
                    <div className="metric-meta">{provider.liveConfidence}</div>
                  </div>
                  <div className="insight-value">
                    {rowTodayLiveLabel(provider, locale, messages)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="panel forecast-panel">
        <div className="panel-header compact-header">
          <h2 className="panel-title">{messages.dashboard.monthForecast}</h2>
          <span className="metric-meta">{messages.dashboard.remainingDays}: {dashboard.summary.remainingDaysInMonth}</span>
        </div>
        <div className="panel-body forecast-body">
          <div className="forecast-ring" style={forecastRingStyle(dashboard)} aria-hidden="true">
            <span>{forecastCoveragePercent(dashboard)}%</span>
          </div>
          <div className="forecast-stack">
            <KeyValue
              label={messages.dashboard.monthForecast}
              value={formatMinorAmount(dashboard.summary.monthForecastAmountMinor, dashboard.summary.currency, locale)}
            />
            <KeyValue
              label={messages.dashboard.confirmedThroughYesterday}
              value={formatMinorAmount(
                dashboard.summary.confirmedThroughYesterdayAmountMinor,
                dashboard.summary.currency,
                locale,
              )}
            />
            <KeyValue
              label={messages.dashboard.todayLive}
              value={
                dashboard.summary.todayLiveAmountMinor === null
                  ? messages.dashboard.noLiveValue
                  : formatMinorAmount(dashboard.summary.todayLiveAmountMinor, dashboard.summary.currency, locale)
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function forecastCoveragePercent(dashboard: OperationsDashboard): number {
  if (dashboard.summary.monthForecastAmountMinor <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      (dashboard.summary.confirmedThroughYesterdayAmountMinor / dashboard.summary.monthForecastAmountMinor) * 100,
    ),
  );
}

function forecastRingStyle(dashboard: OperationsDashboard): CSSProperties {
  return {
    "--forecast-coverage": `${forecastCoveragePercent(dashboard)}%`,
  } as CSSProperties;
}

function budgetValueLabel(dashboard: OperationsDashboard, locale: Locale, messages: Messages): string {
  return dashboard.summary.budget.monthlyBudgetMinor === null
    ? messages.dashboard.budgetNotSet
    : formatMinorAmount(dashboard.summary.budget.monthlyBudgetMinor, dashboard.summary.budget.currency, locale);
}

function budgetUsageLabel(dashboard: OperationsDashboard, locale: Locale, messages: Messages): string {
  if (dashboard.summary.budget.status === "currency_mismatch") {
    return `${messages.dashboard.budgetRisk}: ${labelFor(messages, "warning")}`;
  }

  if (dashboard.summary.budget.usagePercent === null) {
    return messages.dashboard.budgetNotSet;
  }

  return `${messages.dashboard.budgetUsage}: ${new Intl.NumberFormat(locale).format(dashboard.summary.budget.usagePercent)}%`;
}

type OperationsRow = OperationsProvider | OperationsProviderConnection;
type DashboardWidgetNodes = Partial<Record<DashboardWidgetKey, ReactNode>>;

function DashboardWidgetLayout({
  className = "dashboard-widget-grid",
  dashboard,
  viewKey,
  widgets,
}: {
  className?: string;
  dashboard: OperationsDashboard;
  viewKey: DashboardViewKey;
  widgets: DashboardWidgetNodes;
}) {
  const layout = dashboard.displayPreferences.widgetLayouts[viewKey];

  return (
    <div className={className}>
      {layout.map((item) => {
        const widget = widgets[item.widgetKey];

        if (!item.visible || widget === undefined) {
          return null;
        }

        return (
          <div className={dashboardWidgetClassName(item)} key={item.widgetKey}>
            {widget}
          </div>
        );
      })}
    </div>
  );
}

function dashboardWidgetClassName(item: DashboardWidgetLayoutItem): string {
  return `dashboard-widget dashboard-widget-${item.size}`;
}

function serviceRowsFor(
  dashboard: OperationsDashboard,
  grouping: DashboardGrouping,
): readonly OperationsRow[] {
  return grouping === "connection" ? dashboard.visibleConnections : dashboard.visibleProviders;
}

function rowKey(row: OperationsRow): string {
  return isConnectionRow(row) ? `${row.providerKey}:${row.connectionId}` : row.providerKey;
}

function rowSubLabel(row: OperationsRow): string {
  return isConnectionRow(row) ? row.connectionId : row.providerKey;
}

function primaryProviderSourceLink(links: readonly ProviderSetupLink[]): ProviderSetupLink | undefined {
  return [...links]
    .sort((first, second) => providerSourceLinkScore(second) - providerSourceLinkScore(first))[0];
}

function providerSourceLinkScore(link: ProviderSetupLink): number {
  const searchable = `${link.label} ${link.href} ${link.description}`.toLowerCase();
  let score = 0;

  if (/(console|dashboard|settings|tokens|usage|cost|billing|management)/.test(searchable)) {
    score += 20;
  }

  if (/(console\.aws\.amazon\.com|platform\.openai\.com\/settings|supabase\.com\/dashboard|dash\.cloudflare\.com)/.test(searchable)) {
    score += 30;
  }

  if (/(docs|install|configure|profiles|sso|keys-create-delete)/.test(searchable)) {
    score -= 8;
  }

  return score;
}

function isConnectionRow(row: OperationsRow): row is OperationsProviderConnection {
  return "connectionId" in row;
}

function splitRowsByDisplay(rows: readonly OperationsRow[]): {
  amountRows: OperationsRow[];
  usageRows: OperationsRow[];
} {
  return {
    amountRows: rows.filter((row) => !isUsageDisplayRow(row)),
    usageRows: rows.filter(isUsageDisplayRow),
  };
}

function isUsageDisplayRow(row: OperationsRow): boolean {
  return row.liveGranularity === "usage_only";
}

function serviceGroupTitle(kind: string, messages: Messages): string {
  return `${kind} ${messages.nav.services}`;
}

function emptyGroupLabel(title: string, totalRows: number, messages: Messages): string {
  return totalRows === 0 ? messages.empty.noProviders : `${title}: 0`;
}

function serviceNameCell(row: OperationsRow): ReactNode {
  return (
    <div className="service-name-cell">
      <ProviderIcon
        className={`provider-swatch provider-swatch-${row.providerKey}`}
        providerKey={row.providerKey}
      />
      <strong>{row.displayName}</strong>
    </div>
  );
}

function summaryServiceNameCell(row: OperationsRow, locale: Locale, serviceLinks: boolean): ReactNode {
  return (
    <>
      <span className="summary-service-title-line">
        {serviceLinks ? (
          <Link href={`/${locale}/services/${row.providerKey}`}>
            <strong>{row.displayName}</strong>
          </Link>
        ) : (
          <strong>{row.displayName}</strong>
        )}
        <ProviderSourceLink provider={row} />
      </span>
      <div className="muted">{rowSubLabel(row)}</div>
    </>
  );
}

function ServiceDetailLink({
  locale,
  messages,
  row,
}: {
  locale: Locale;
  messages: Messages;
  row: OperationsRow;
}) {
  return (
    <Link
      aria-label={`${row.displayName} ${messages.services.serviceTitle}`}
      className="icon-button"
      href={`/${locale}/services/${row.providerKey}`}
    >
      <MoreVertical size={15} strokeWidth={1.8} />
    </Link>
  );
}

function amountTodayLiveLabel(row: OperationsRow, locale: Locale, messages: Messages): string {
  return row.todayLiveAmountMinor === null
    ? messages.dashboard.noLiveValue
    : formatMinorAmount(row.todayLiveAmountMinor, row.currency, locale);
}

function rowFiveHourUsageLabel(row: OperationsRow, locale: Locale, messages: Messages): string {
  return usageUsagePercentLabel(row.currentUsageSummary, "five_hour", locale) ??
    usageMetricValue(row.currentUsageSummary, "five_hour_tokens", locale) ??
    usageMetricValue(row.currentUsageSummary, "five_hour_remaining_tokens", locale) ??
    messages.services.noCurrentUsage;
}

function rowWeeklyUsageLabel(row: OperationsRow, locale: Locale, messages: Messages): string {
  return usageUsagePercentLabel(row.currentUsageSummary, "weekly", locale) ??
    usageMetricValue(row.currentUsageSummary, "weekly_tokens", locale) ??
    usageMetricValue(row.currentUsageSummary, "weekly_remaining_tokens", locale) ??
    messages.services.noCurrentUsage;
}

function usageUsagePercentLabel(
  summary: OperationsProvider["currentUsageSummary"],
  window: "five_hour" | "weekly",
  locale: Locale,
): string | undefined {
  const explicitPercent = usageMetricValue(summary, `${window}_limit_percent`, locale);

  if (explicitPercent !== undefined) {
    return explicitPercent;
  }

  const usedMetric = usageMetric(summary, `${window}_tokens`);
  const remainingMetric = usageMetric(summary, `${window}_remaining_tokens`);

  if (usedMetric === undefined || remainingMetric === undefined) {
    return undefined;
  }

  const total = usedMetric.value + remainingMetric.value;

  return total <= 0 ? undefined : formatUsageMetric((usedMetric.value / total) * 100, "percent", locale);
}

function summarizeLiveRows(rows: readonly OperationsRow[]): {
  included: number;
  excluded: number;
  confidence: OperationsProvider["liveConfidence"];
} {
  const included = rows.filter((row) => row.todayLiveIncluded).length;
  const confidenceValues = rows.map((row) => row.liveConfidence);

  return {
    included,
    excluded: Math.max(rows.length - included, 0),
    confidence: confidenceValues.includes("high")
      ? "high"
      : confidenceValues.includes("medium")
        ? "medium"
        : confidenceValues.includes("low")
          ? "low"
          : "none",
  };
}

function providerNeedsAttentionForView(provider: OperationsProvider): boolean {
  return (
    provider.canonicalFreshness !== "fresh" ||
    provider.liveFreshness !== "live" ||
    provider.riskLevel !== "low" ||
    provider.healthStatus !== "ok"
  );
}

function latestDateValue(values: readonly string[]): string | null {
  return values.length === 0
    ? null
    : [...values].sort((first, second) => second.localeCompare(first))[0] ?? null;
}

function DashboardMeta({
  dashboard,
  locale,
  messages,
}: {
  dashboard: OperationsDashboard;
  locale: Locale;
  messages: Messages;
}) {
  return (
    <PageHeader
      title={messages.dashboard.overviewTitle}
      subtitle={messages.dashboard.overviewSubtitle}
      meta={
        <>
          <div className="header-control-row">
            <Link className="ghost-button header-control" href={`/${locale}/dashboard/forecast`}>
              <span>{formatMonthLabel(dashboard.generatedAt, locale)}</span>
              <CalendarDays aria-hidden="true" size={14} />
            </Link>
            <RefreshPageButton label={messages.dashboard.refresh} />
          </div>
          <span>{exchangeRateLabel(dashboard, locale)}</span>
          <span>{messages.app.generated}: {dashboard.generatedAt}</span>
        </>
      }
    />
  );
}

function exchangeRateLabel(dashboard: OperationsDashboard, locale: Locale): string {
  const rate = dashboard.summary.exchangeRate;

  if (rate.status === "identity") {
    return `${rate.displayCurrency}`;
  }

  if (rate.status === "unavailable") {
    return `${rate.sourceCurrency}->${rate.requestedCurrency}: unavailable`;
  }

  return `${rate.sourceCurrency}->${rate.displayCurrency}: ${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
  }).format(rate.rate)}${rate.rateDate === null ? "" : ` (${rate.rateDate})`}`;
}

function MetricCard({
  label,
  value,
  meta,
  progress,
  progressState = "low",
  warning = false,
}: {
  label: string;
  value: string;
  meta: string;
  progress?: number | undefined;
  progressState?: string | undefined;
  warning?: boolean;
}) {
  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <p className="metric-label">{label}</p>
        {warning ? <AlertTriangle aria-hidden="true" className="metric-warning-icon" size={17} /> : null}
      </div>
      <p className={value.length > 7 ? "metric-value metric-value-compact" : "metric-value"}>{value}</p>
      <p className="metric-meta">{meta}</p>
      {progress === undefined ? null : <ProgressBar value={progress} state={progressState} />}
    </article>
  );
}

function ProgressBar({ value, state }: { value: number; state: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const thresholds = progressThresholdsForState(state);

  return <UsageProgress compact label="Usage progress" progress={{
    usedPercent: safeValue,
    remainingPercent: Math.max(0, 100 - safeValue),
    warningAtPercent: thresholds.warningAtPercent,
    criticalAtPercent: thresholds.criticalAtPercent,
  }} />;
}

function progressThresholdsForState(state: string): { warningAtPercent: number; criticalAtPercent: number } {
  if (state === "critical" || state === "high") {
    return {
      warningAtPercent: 0,
      criticalAtPercent: 0,
    };
  }

  if (state === "warning" || state === "medium") {
    return {
      warningAtPercent: 0,
      criticalAtPercent: 101,
    };
  }

  return {
    warningAtPercent: 80,
    criticalAtPercent: 95,
  };
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
      </div>
      <div className="panel-body stack">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function RequirementLinks({ provider, messages }: { provider: OperationsProvider; messages: Messages }) {
  return (
    <div className="requirements-cell" aria-label={messages.settings.requiredValueLinks}>
      <div>{provider.requiredEnvKeys.join(", ")}</div>
      {provider.setupLinks.length === 0 ? null : (
        <div className="setup-link-list">
          <div className="metric-label">{messages.settings.setupLinks}</div>
          {provider.setupLinks.map((link) => (
            <a className="inline-link" href={link.href} key={link.href} rel="noreferrer" target="_blank">
              <span>{link.label}</span>
              <span className="metric-meta">{link.valueHints.join(", ")}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function isLocalAiCliProvider(providerKey: string): boolean {
  return providerKey === "codex-cli" ||
    providerKey === "codex-app" ||
    providerKey === "claude-cli" ||
    providerKey === "claude-app" ||
    providerKey === "antigravity";
}

function dashboardMetricKeysForRow(
  row: OperationsRow,
  dashboard: OperationsDashboard,
): readonly string[] | undefined {
  return isLocalAiCliProvider(row.providerKey) ? dashboard.displayPreferences.localCliMetricKeys : undefined;
}

function usageMetric(
  summary: OperationsProvider["currentUsageSummary"],
  key: string,
): UsageMetric | undefined {
  return summary?.metrics.find((item) => item.key === key);
}

function rowTodayLiveLabel(row: OperationsRow, locale: Locale, messages: Messages): string {
  if (isLocalAiCliProvider(row.providerKey)) {
    const fiveHourRemaining = usageMetricValue(row.currentUsageSummary, "five_hour_remaining_tokens", locale);
    const weeklyRemaining = usageMetricValue(row.currentUsageSummary, "weekly_remaining_tokens", locale);
    const remaining = [
      fiveHourRemaining === undefined ? null : `${messages.services.fiveHourRemainingTokens}: ${fiveHourRemaining}`,
      weeklyRemaining === undefined ? null : `${messages.services.weeklyRemainingTokens}: ${weeklyRemaining}`,
    ].filter((value): value is string => value !== null);

    return remaining.length === 0 ? messages.services.noCurrentUsage : remaining.join(" / ");
  }

  return row.todayLiveAmountMinor === null
    ? messages.dashboard.noLiveValue
    : formatMinorAmount(row.todayLiveAmountMinor, row.currency, locale);
}

function usageMetricValue(
  summary: OperationsProvider["currentUsageSummary"],
  key: string,
  locale: Locale,
): string | undefined {
  const metric = usageMetric(summary, key);

  return metric === undefined ? undefined : formatUsageMetric(metric.value, metric.unit, locale);
}

function metricMeta(
  summary: OperationsProvider["currentUsageSummary"],
  key: string,
  locale: Locale,
  messages: Messages,
): string {
  const value = usageMetricValue(summary, key, locale);

  if (value === undefined) {
    return messages.services.noCurrentUsage;
  }

  return `${usageMetricLabel(key, messages)}: ${value}`;
}

function UsageSummaryBlock({
  summary,
  locale,
  messages,
}: {
  summary: OperationsProvider["currentUsageSummary"];
  locale: Locale;
  messages: Messages;
}) {
  return (
    <div>
      <div className="metric-label">{messages.services.currentUsage}</div>
      {summary === null ? (
        <div>{messages.services.noCurrentUsage}</div>
      ) : (
        <div className="usage-summary">
          <div className="metric-meta">{messages.services.currentPeriod}</div>
          {summary.metrics.map((metric, index) => (
            <div className="usage-metric" key={`${metric.key}:${index}`}>
              <span>{usageMetricLabel(metric.key, messages)}</span>
              <strong>{formatUsageMetricDisplayValue(metric, locale)}</strong>
            </div>
          ))}
          {summary.topServices.length === 0 ? null : (
            <div className="metric-meta">
              {messages.services.topServices}: {summary.topServices.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BadgeLine({ messages, states }: { messages: Messages; states: readonly string[] }) {
  return (
    <div className="badge-row">
      {states.map((state) => (
        <StatusBadge messages={messages} state={state} key={state} />
      ))}
    </div>
  );
}

function StatusBadge({ messages, state, text }: { messages: Messages; state: string; text?: string }) {
  return <span className={`badge ${badgeClassFor(state)}`}>{text ?? labelFor(messages, state)}</span>;
}

function renderUsageSummary(
  summary: OperationsProvider["currentUsageSummary"],
  locale: Locale,
  messages: Messages,
  visibleMetricKeys?: readonly string[],
): ReactNode {
  if (summary === null) {
    return <span className="muted">{messages.services.noCurrentUsage}</span>;
  }

  const visibleMetrics = visibleMetricKeys === undefined
    ? summary.metrics
    : visibleMetricKeys
        .map((key) => usageMetric(summary, key))
        .filter((metric): metric is UsageMetric =>
          metric !== undefined
        );

  if (visibleMetrics.length === 0) {
    return <span className="muted">{messages.services.noCurrentUsage}</span>;
  }

  return (
    <div className="usage-summary compact dashboard-usage-summary">
      {visibleMetrics.map((metric, index) => (
        <div className="usage-metric" key={`${metric.key}:${index}`}>
          <span>{usageMetricLabel(metric.key, messages)}</span>
          <strong>{formatUsageMetricDisplayValue(metric, locale)}</strong>
        </div>
      ))}
    </div>
  );
}

function usageMetricLabel(metric: string, messages: Messages): string {
  if (metric === "input_tokens") {
    return messages.services.inputTokens;
  }

  if (metric === "output_tokens") {
    return messages.services.outputTokens;
  }

  if (metric === "cache_tokens") {
    return messages.services.cacheTokens;
  }

  if (metric === "unblended_cost") {
    return messages.services.cost;
  }

  if (metric === "model_requests") {
    return messages.services.modelRequests;
  }

  if (metric === "sessions") {
    return messages.services.sessions;
  }

  if (metric === "turns") {
    return messages.services.turns;
  }

  if (metric === "tool_calls") {
    return messages.services.toolCalls;
  }

  if (metric === "log_files") {
    return messages.services.logFiles;
  }

  if (metric === "context_tokens") {
    return messages.services.contextTokens;
  }

  if (metric === "context_percent") {
    return messages.services.contextPercent;
  }

  if (metric === "five_hour_limit_percent") {
    return messages.services.fiveHourLimit;
  }

  if (metric === "weekly_limit_percent") {
    return messages.services.weeklyLimit;
  }

  if (metric === "five_hour_tokens") {
    return messages.services.fiveHourTokens;
  }

  if (metric === "five_hour_remaining_tokens") {
    return messages.services.fiveHourRemainingTokens;
  }

  if (metric === "weekly_tokens") {
    return messages.services.weeklyTokens;
  }

  if (metric === "weekly_remaining_tokens") {
    return messages.services.weeklyRemainingTokens;
  }

  if (metric === "usage_reset_credits") {
    return messages.services.usageResetCredits;
  }

  if (metric === "usage_reset_credit_total_earned") {
    return `${messages.services.usageResetCredits} total`;
  }

  if (metric === "usage_reset_credit") {
    return messages.services.usageResetCredit;
  }

  if (metric === "usage_reset_credit_estimate") {
    return messages.services.usageResetCreditEstimate;
  }

  if (metric === "last_request_tokens") {
    return messages.services.lastRequestTokens;
  }

  if (metric === "total_tokens") {
    return messages.services.totalTokens;
  }

  if (metric === "reasoning_tokens") {
    return messages.services.reasoningTokens;
  }

  return metric.replace(/[_-]+/g, " ");
}

function labelFor(messages: Messages, state: string): string {
  return messages.states[state] ?? state;
}

function badgeClassFor(state: string): string {
  if (state === "ok" || state === "fresh" || state === "live" || state === "low" || state === "read_only_ready") {
    return "badge-ok";
  }

  if (state === "critical" || state === "down" || state === "error" || state === "invalid") {
    return "badge-critical";
  }

  if (
    state === "warning"
    || state === "stale"
    || state === "missing"
    || state === "not_configured"
    || state === "locked"
    || state === "expired"
    || state === "emergency_planned"
  ) {
    return "badge-warn";
  }

  if (state === "provisional" || state === "daily_bucket" || state === "month_to_date" || state === "current_period") {
    return "badge-live";
  }

  return "badge-neutral";
}

function formatMinorAmount(amountMinor: number, currency: string, locale: Locale): string {
  if (currency === "MIXED") {
    return "Mixed";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function formatPercent(value: number, locale: Locale): string {
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatTrendValue(value: number, unit: string, locale: Locale): string {
  const normalizedUnit = unit.toUpperCase();

  if (isCurrencyUnit(normalizedUnit)) {
    return formatMajorCurrency(value, normalizedUnit, locale);
  }

  if (unit === "percent") {
    return formatPercent(value, locale);
  }

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);

  if (unit === "tokens") {
    return `${formatted} tok`;
  }

  if (unit === "count" || unit.trim().length === 0) {
    return formatted;
  }

  return `${formatted} ${unit}`;
}

function formatTrendAxisValue(value: number, unit: string, locale: Locale): string {
  const normalizedUnit = unit.toUpperCase();

  if (isCurrencyUnit(normalizedUnit)) {
    return formatMajorCurrency(value, normalizedUnit, locale, true);
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function formatMajorCurrency(value: number, currency: string, locale: Locale, compact = false): string {
  try {
    return new Intl.NumberFormat(locale, {
      currency,
      maximumFractionDigits: Math.abs(value) < 10 && !compact ? 2 : 1,
      notation: compact ? "compact" : "standard",
      style: "currency",
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat(locale).format(value)} ${currency}`;
  }
}

function isCurrencyUnit(unit: string): boolean {
  return /^[A-Z]{3}$/.test(unit);
}

function formatDateKey(dateKey: string, locale: Locale): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatUsageMetric(
  value: number,
  unit: "tokens" | "requests" | "sessions" | "turns" | "calls" | "files" | "percent" | "usd" | "count",
  locale: Locale,
): string {
  if (unit === "percent") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
  }

  if (unit === "usd") {
    return new Intl.NumberFormat(locale, {
      currency: "USD",
      maximumFractionDigits: 2,
      style: "currency",
    }).format(value);
  }

  const formatted = new Intl.NumberFormat(locale).format(value);

  return unit === "tokens" ? `${formatted} tok` : formatted;
}

function formatUsageMetricDisplayValue(metric: UsageMetric, locale: Locale): string {
  return isResetCreditExpiryMetric(metric)
    ? formatUsageResetRemaining(metric, locale)
    : formatUsageMetric(metric.value, metric.unit, locale);
}

function isResetCreditExpiryMetric(metric: Pick<UsageMetric, "key">): boolean {
  return metric.key === "usage_reset_credit" || metric.key === "usage_reset_credit_estimate";
}

function formatUsageResetRemaining(metric: Pick<UsageMetric, "resetAt" | "resetAtLatest">, locale: Locale): string {
  const expiresAt = parseUsageResetDate(metric.resetAt);

  if (expiresAt === null) {
    return "-";
  }

  const remainingMs = expiresAt.getTime() - Date.now();

  if (remainingMs <= 0) {
    return resetCreditExpiredLabel(locale);
  }

  return formatResetCreditDuration(remainingMs, locale);
}

function parseUsageResetDate(value: string | undefined): Date | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatResetCreditDuration(remainingMs: number, locale: Locale): string {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days >= 7) {
    return formatDurationDaysOnly(days, locale);
  }

  if (days >= 1) {
    return formatDurationDayHour(days, hours, locale);
  }

  if (hours >= 1) {
    return formatDurationHourMinute(hours, minutes, locale);
  }

  return formatDurationMinute(minutes, locale);
}

function formatDurationDaysOnly(days: number, locale: Locale): string {
  if (locale === "ko") {
    return `${days}일 남음`;
  }

  if (locale === "ja") {
    return `あと${days}日`;
  }

  return `${days} ${pluralize("day", days)} left`;
}

function formatDurationDayHour(days: number, hours: number, locale: Locale): string {
  if (locale === "ko") {
    return hours > 0 ? `${days}일 ${hours}시간 남음` : `${days}일 남음`;
  }

  if (locale === "ja") {
    return hours > 0 ? `あと${days}日${hours}時間` : `あと${days}日`;
  }

  return hours > 0
    ? `${days} ${pluralize("day", days)} ${hours} ${pluralize("hour", hours)} left`
    : `${days} ${pluralize("day", days)} left`;
}

function formatDurationHourMinute(hours: number, minutes: number, locale: Locale): string {
  if (locale === "ko") {
    return minutes > 0 ? `${hours}시간 ${minutes}분 남음` : `${hours}시간 남음`;
  }

  if (locale === "ja") {
    return minutes > 0 ? `あと${hours}時間${minutes}分` : `あと${hours}時間`;
  }

  return minutes > 0
    ? `${hours} ${pluralize("hour", hours)} ${minutes} ${pluralize("minute", minutes)} left`
    : `${hours} ${pluralize("hour", hours)} left`;
}

function formatDurationMinute(minutes: number, locale: Locale): string {
  if (locale === "ko") {
    return `${minutes}분 남음`;
  }

  if (locale === "ja") {
    return `あと${minutes}分`;
  }

  return `${minutes} ${pluralize("minute", minutes)} left`;
}

function resetCreditExpiredLabel(locale: Locale): string {
  if (locale === "ko") {
    return "만료됨";
  }

  if (locale === "ja") {
    return "期限切れ";
  }

  return "Expired";
}

function pluralize(label: string, value: number): string {
  return value === 1 ? label : `${label}s`;
}

function formatMonthLabel(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function liveAmountLabel(provider: OperationsProvider, locale: Locale, messages: Messages): string {
  return provider.todayLiveAmountMinor === null
    ? messages.dashboard.noLiveValue
    : formatMinorAmount(provider.todayLiveAmountMinor, provider.currency, locale);
}

function formatOptionalDate(value: string | null, locale: Locale, timezone: string, messages: Messages): string {
  if (value === null) {
    return labelFor(messages, "missing");
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatUsageResetAt(value: string | undefined, locale: Locale, timezone: string): string {
  if (value === undefined || value.trim().length === 0) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const sameDay = dateKeyInTimezone(date, timezone) === dateKeyInTimezone(new Date(), timezone);

  return new Intl.DateTimeFormat(locale, sameDay
    ? { hour: "numeric", minute: "2-digit", timeZone: timezone }
    : { day: "numeric", month: "long", timeZone: timezone }).format(date);
}

function dateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(date);
}
