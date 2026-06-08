import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  MoreVertical,
} from "lucide-react";
import type { Messages, Locale } from "../lib/i18n";
import { ConnectionCard } from "./ConnectionCard";
import { LiveRefreshButton } from "./LiveRefreshButton";
import { ProviderIcon } from "./ProviderIcon";
import { RefreshPageButton } from "./RefreshPageButton";
import type {
  OperationsDashboard,
  OperationsProvider,
  OperationsProviderConnection,
} from "../lib/operations-data";
import type { ProviderCatalogItem } from "../lib/provider-catalog";

export type DashboardGrouping = "service" | "connection";

interface ViewProps {
  dashboard: OperationsDashboard;
  locale: Locale;
  messages: Messages;
  grouping?: DashboardGrouping;
  groupingBasePath?: string | undefined;
}

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
  return (
    <div className="stack">
      <DashboardMeta dashboard={dashboard} locale={locale} messages={messages} />
      <section className="metric-grid">
        <MetricCard
          label={messages.dashboard.monthForecast}
          value={formatMinorAmount(dashboard.summary.monthForecastAmountMinor, dashboard.summary.currency, locale)}
          meta={`${messages.dashboard.canonicalCoverage}: ${dashboard.summary.canonicalCoverageDate ?? labelFor(messages, "missing")}`}
          progress={forecastCoveragePercent(dashboard)}
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
      <div className="view-switch-row">
        <GroupingToggle
          basePath={groupingBasePath}
          grouping={grouping}
          messages={messages}
          wide
        />
      </div>
      <DashboardServicesTable
        dashboard={dashboard}
        locale={locale}
        messages={messages}
        grouping={grouping}
      />
      <DashboardInsightPanels dashboard={dashboard} locale={locale} messages={messages} />
    </div>
  );
}

export function TodayLiveView({ dashboard, locale, messages, grouping = "service", groupingBasePath }: ViewProps) {
  const rows = serviceRowsFor(dashboard, grouping);
  const liveStats = summarizeLiveRows(rows);

  return (
    <div className="ops-grid">
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
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{messages.table.provider}</th>
                <th>{messages.dashboard.todayLive}</th>
                <th>{messages.services.currentUsage}</th>
                <th>{messages.services.liveFreshness}</th>
                <th>{messages.services.liveGranularity}</th>
                <th>{messages.services.latestLiveCheck}</th>
                <th>{messages.services.confidence}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>{messages.empty.noProviders}</td>
                </tr>
              ) : (
                rows.map((provider) => (
                  <tr key={rowKey(provider)}>
                    <td>
                      <strong>{provider.displayName}</strong>
                      <div className="muted">{rowSubLabel(provider)}</div>
                    </td>
                    <td>
                      {provider.todayLiveAmountMinor === null
                        ? messages.dashboard.noLiveValue
                        : formatMinorAmount(provider.todayLiveAmountMinor, provider.currency, locale)}
                      <div className="badge-row">
                        <StatusBadge messages={messages} state="provisional" text={messages.dashboard.provisional} />
                        {!provider.todayLiveIncluded ? (
                          <StatusBadge messages={messages} state="stale" text={messages.dashboard.partial} />
                        ) : null}
                      </div>
                    </td>
                    <td>{renderUsageSummary(provider.currentUsageSummary, locale, messages)}</td>
                    <td><StatusBadge messages={messages} state={provider.liveFreshness} /></td>
                    <td>{labelFor(messages, provider.liveGranularity)}</td>
                    <td>{formatOptionalDate(provider.latestLiveCheck, locale, dashboard.timezone, messages)}</td>
                    <td>{provider.liveConfidence}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <TodayLiveRail dashboard={dashboard} rows={rows} locale={locale} messages={messages} />
    </div>
  );
}

export function ForecastView({ dashboard, locale, messages, grouping = "service", groupingBasePath }: ViewProps) {
  return (
    <div className="stack">
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
      <div className="ops-grid">
        <ProviderSummaryTable
          dashboard={dashboard}
          locale={locale}
          messages={messages}
          grouping={grouping}
          groupingBasePath={groupingBasePath}
        />
        <ForecastBreakdownPanel dashboard={dashboard} locale={locale} messages={messages} />
      </div>
    </div>
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

  return (
    <div className="stack">
      <RiskSummaryCards rows={rows} messages={messages} />
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
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
  return (
    <div className="stack">
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
          <p className="muted">{messages.services.emergencyPlanned}</p>
          <div className="badge-row">
            <StatusBadge messages={messages} state={provider.emergencyAccessState} />
          </div>
          <Link className="ghost-button" href={`/${locale}/settings/connections#${provider.providerKey}`}>
            {messages.services.viewRequirements}
          </Link>
        </InfoPanel>
      </div>
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
  return (
    <div className="catalog-grid">
      {providers.map((provider) => (
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

export function ConnectionsView({ dashboard, messages }: ViewProps) {
  return (
    <div className="stack">
      <div className="connection-card-list">
        {dashboard.providers.map((provider) => (
          <ConnectionCard key={provider.providerKey} messages={messages} provider={provider} />
        ))}
      </div>
    </div>
  );
}

export function PreferencesView({ dashboard, locale, messages }: ViewProps) {
  return (
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

function RiskSummaryCards({ rows, messages }: { rows: readonly OperationsRow[]; messages: Messages }) {
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

function DashboardServicesTable({
  dashboard,
  locale,
  messages,
  grouping = "service",
}: ViewProps) {
  const rows = serviceRowsFor(dashboard, grouping);

  return (
    <div className="panel panel-table-only">
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
              <th>{messages.table.risk}</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>{messages.empty.noProviders}</td>
              </tr>
            ) : (
              rows.map((provider) => {
                const ratio = provider.monthForecastAmountMinor <= 0
                  ? 0
                  : Math.min(100, Math.round((provider.confirmedAmountMinor / provider.monthForecastAmountMinor) * 100));

                return (
                  <tr key={rowKey(provider)}>
                    <td>
                      <div className="service-name-cell">
                        <ProviderIcon
                          className={`provider-swatch provider-swatch-${provider.providerKey}`}
                          providerKey={provider.providerKey}
                        />
                        <strong>{provider.displayName}</strong>
                      </div>
                    </td>
                    <td>{rowSubLabel(provider)}</td>
                    <td>
                      <span className="status-dot-line">
                        <span className={`tiny-dot tiny-dot-${provider.healthStatus}`} aria-hidden="true" />
                        {labelFor(messages, provider.healthStatus)}
                      </span>
                    </td>
                    <td>{formatMinorAmount(provider.monthForecastAmountMinor, provider.currency, locale)}</td>
                    <td>{formatMinorAmount(provider.confirmedAmountMinor, provider.currency, locale)}</td>
                    <td>
                      {provider.todayLiveAmountMinor === null
                        ? messages.dashboard.noLiveValue
                        : formatMinorAmount(provider.todayLiveAmountMinor, provider.currency, locale)}
                    </td>
                    <td>
                      <div className="table-progress-cell">
                        <span>{ratio}%</span>
                        <ProgressBar value={ratio} state={provider.riskLevel} />
                      </div>
                    </td>
                    <td className="table-action-cell">
                      <Link
                        aria-label={`${provider.displayName} ${messages.services.serviceTitle}`}
                        className="icon-button"
                        href={`/${locale}/services/${provider.providerKey}`}
                      >
                        <MoreVertical size={15} strokeWidth={1.8} />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{messages.services.title}: {rows.length}</span>
        <span className="pager-dots">‹ 1 ›</span>
      </div>
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

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{messages.services.title}</h2>
        <div className="panel-actions">
          <GroupingToggle
            basePath={groupingBasePath}
            grouping={grouping}
            messages={messages}
          />
          <StatusBadge messages={messages} state={dashboard.summary.providersNeedingAttention > 0 ? "warning" : "ok"} />
        </div>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{messages.table.provider}</th>
              <th>{messages.table.month}</th>
              <th>{messages.table.today}</th>
              <th>{messages.services.canonicalFreshness}</th>
              <th>{messages.services.liveFreshness}</th>
              <th>{messages.table.health}</th>
              <th>{messages.table.risk}</th>
              <th>{messages.table.latest}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>{messages.empty.noProviders}</td>
              </tr>
            ) : (
              rows.map((provider) => (
                <tr key={rowKey(provider)}>
                  <td>
                    {serviceLinks ? (
                      <Link href={`/${locale}/services/${provider.providerKey}`}>
                        <strong>{provider.displayName}</strong>
                      </Link>
                    ) : (
                      <strong>{provider.displayName}</strong>
                    )}
                    <div className="muted">{rowSubLabel(provider)}</div>
                  </td>
                  <td>{formatMinorAmount(provider.monthForecastAmountMinor, provider.currency, locale)}</td>
                  <td>{provider.todayLiveAmountMinor === null ? messages.dashboard.noLiveValue : formatMinorAmount(provider.todayLiveAmountMinor, provider.currency, locale)}</td>
                  <td><StatusBadge messages={messages} state={provider.canonicalFreshness} /></td>
                  <td><StatusBadge messages={messages} state={provider.liveFreshness} /></td>
                  <td><StatusBadge messages={messages} state={provider.healthStatus} /></td>
                  <td><StatusBadge messages={messages} state={provider.riskLevel} /></td>
                  <td>{formatOptionalDate(provider.latestCanonicalSync, locale, dashboard.timezone, messages)}</td>
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
                    {provider.todayLiveAmountMinor === null
                      ? messages.dashboard.noLiveValue
                      : formatMinorAmount(provider.todayLiveAmountMinor, provider.currency, locale)}
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

type OperationsRow = OperationsProvider | OperationsProviderConnection;

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

function isConnectionRow(row: OperationsRow): row is OperationsProviderConnection {
  return "connectionId" in row;
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
          <span>{messages.app.generated}: {dashboard.generatedAt}</span>
        </>
      }
    />
  );
}

function MetricCard({
  label,
  value,
  meta,
  progress,
  warning = false,
}: {
  label: string;
  value: string;
  meta: string;
  progress?: number;
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
      {progress === undefined ? null : <ProgressBar value={progress} state="low" />}
    </article>
  );
}

function ProgressBar({ value, state }: { value: number; state: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <span className="progress-track" aria-hidden="true">
      <span
        className={state === "critical" || state === "high" ? "progress-bar progress-bar-critical" : state === "warning" || state === "medium" ? "progress-bar progress-bar-warn" : "progress-bar"}
        style={{ width: `${safeValue}%` }}
      />
    </span>
  );
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
          {summary.metrics.map((metric) => (
            <div className="usage-metric" key={metric.key}>
              <span>{usageMetricLabel(metric.key, messages)}</span>
              <strong>{formatUsageMetric(metric.value, metric.unit, locale)}</strong>
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
): ReactNode {
  if (summary === null) {
    return <span className="muted">{messages.services.noCurrentUsage}</span>;
  }

  return (
    <div className="usage-summary compact">
      {summary.metrics.map((metric) => (
        <div className="usage-metric" key={metric.key}>
          <span>{usageMetricLabel(metric.key, messages)}</span>
          <strong>{formatUsageMetric(metric.value, metric.unit, locale)}</strong>
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

  return messages.services.modelRequests;
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

function formatUsageMetric(value: number, unit: "tokens" | "requests", locale: Locale): string {
  const formatted = new Intl.NumberFormat(locale).format(value);

  return unit === "tokens" ? `${formatted} tok` : formatted;
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
