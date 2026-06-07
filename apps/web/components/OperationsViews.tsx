import Link from "next/link";
import type { ReactNode } from "react";
import type { Messages, Locale } from "../lib/i18n";
import { CredentialControls } from "./CredentialControls";
import { LiveRefreshButton } from "./LiveRefreshButton";
import type {
  OperationsDashboard,
  OperationsProvider,
} from "../lib/operations-data";
import type { ProviderCatalogItem } from "../lib/provider-catalog";

interface ViewProps {
  dashboard: OperationsDashboard;
  locale: Locale;
  messages: Messages;
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

export function DashboardTabs({ locale, messages, active }: { locale: Locale; messages: Messages; active: string }) {
  const items = [
    { key: "overview", href: `/${locale}/dashboard/overview`, label: messages.nav.overview },
    { key: "today", href: `/${locale}/dashboard/today`, label: messages.nav.today },
    { key: "forecast", href: `/${locale}/dashboard/forecast`, label: messages.nav.forecast },
    { key: "risks", href: `/${locale}/dashboard/risks`, label: messages.nav.risks },
  ];

  return (
    <nav className="tabs" aria-label={messages.nav.dashboard}>
      {items.map((item) => (
        <Link className={active === item.key ? "tab tab-active" : "tab"} href={item.href} key={item.key}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function OverviewView({ dashboard, locale, messages }: ViewProps) {
  return (
    <div className="stack">
      <DashboardMeta dashboard={dashboard} messages={messages} />
      <DatabaseNotice dashboard={dashboard} messages={messages} />
      <section className="metric-grid">
        <MetricCard
          label={messages.dashboard.monthForecast}
          value={formatMinorAmount(dashboard.summary.monthForecastAmountMinor, dashboard.summary.currency, locale)}
          meta={`${messages.dashboard.canonicalCoverage}: ${dashboard.summary.canonicalCoverageDate ?? labelFor(messages, "missing")}`}
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
        />
      </section>
      <ProviderSummaryTable dashboard={dashboard} locale={locale} messages={messages} />
    </div>
  );
}

export function TodayLiveView({ dashboard, locale, messages }: ViewProps) {
  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{messages.dashboard.todayTitle}</h2>
          <LiveRefreshButton label={messages.dashboard.refresh} />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{messages.table.provider}</th>
                <th>{messages.dashboard.todayLive}</th>
                <th>{messages.services.liveFreshness}</th>
                <th>{messages.services.liveGranularity}</th>
                <th>{messages.services.latestLiveCheck}</th>
                <th>{messages.services.confidence}</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.providers.map((provider) => (
                <tr key={provider.providerKey}>
                  <td>
                    <strong>{provider.displayName}</strong>
                    <div className="muted">{provider.providerKey}</div>
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
                  <td><StatusBadge messages={messages} state={provider.liveFreshness} /></td>
                  <td>{labelFor(messages, provider.liveGranularity)}</td>
                  <td>{formatOptionalDate(provider.latestLiveCheck, locale, dashboard.timezone, messages)}</td>
                  <td>{provider.liveConfidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ForecastView({ dashboard, locale, messages }: ViewProps) {
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
      <ProviderSummaryTable dashboard={dashboard} locale={locale} messages={messages} />
    </div>
  );
}

export function RisksView({ dashboard, messages }: ViewProps) {
  const riskProviders = dashboard.providers.filter(
    (provider) =>
      provider.riskLevel !== "low"
      || provider.healthStatus !== "ok"
      || provider.canonicalFreshness !== "fresh"
      || provider.liveFreshness !== "live",
  );

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{messages.dashboard.risksTitle}</h2>
          <StatusBadge messages={messages} state={riskProviders.length > 0 ? "warning" : "ok"} />
        </div>
        <div className="panel-body">
          {riskProviders.length === 0 ? (
            <p className="muted">{messages.empty.noRisks}</p>
          ) : (
            <div className="stack">
              {riskProviders.map((provider) => (
                <div className="panel" key={provider.providerKey}>
                  <div className="panel-body">
                    <strong>{provider.displayName}</strong>
                    <div className="badge-row">
                      <StatusBadge messages={messages} state={provider.riskLevel} />
                      <StatusBadge messages={messages} state={provider.healthStatus} />
                      <StatusBadge messages={messages} state={provider.canonicalFreshness} />
                      <StatusBadge messages={messages} state={provider.liveFreshness} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ServicesOverview({ dashboard, locale, messages }: ViewProps) {
  return <ProviderSummaryTable dashboard={dashboard} locale={locale} messages={messages} serviceLinks />;
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
          <KeyValue label={messages.settings.requiredEnv} value={provider.requiredEnvKeys.join(", ")} />
          <KeyValue label={messages.settings.credentialSource} value={labelFor(messages, provider.connectionState)} />
          <KeyValue label={messages.settings.readOnlyTest} value={labelFor(messages, provider.readOnlyTestState)} />
        </InfoPanel>
        <InfoPanel title={messages.services.emergencyActions}>
          <p className="muted">{messages.services.emergencyPlanned}</p>
          <div className="badge-row">
            <StatusBadge messages={messages} state={provider.emergencyAccessState} />
          </div>
          <button className="ghost-button" disabled type="button">
            {messages.services.viewRequirements}
          </button>
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
          <div>
            <h2 className="panel-title">{provider.name}</h2>
            <p className="metric-meta">{provider.category}</p>
          </div>
          <div className="badge-row">
            <StatusBadge messages={messages} state={provider.status} />
            <StatusBadge messages={messages} state={provider.liveGranularity} />
          </div>
          <KeyValue label={messages.catalog.auth} value={provider.authMethods.join(", ")} />
          <KeyValue label={messages.catalog.data} value={provider.dataSurfaces.join(", ")} />
          {provider.status === "available" && provider.availableProviderKey !== undefined ? (
            <Link className="primary-button" href={`/${locale}/settings/connections#${provider.availableProviderKey}`}>
              {messages.catalog.connect}
            </Link>
          ) : (
            <button className="ghost-button" disabled type="button">
              {messages.catalog.viewRoadmap}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

export function ConnectionsView({ dashboard, locale, messages }: ViewProps) {
  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{messages.settings.connectionsTitle}</h2>
          <Link className="primary-button" href={`/${locale}/providers`}>
            {messages.catalog.addProvider}
          </Link>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{messages.table.provider}</th>
                <th>{messages.settings.authMethod}</th>
                <th>{messages.settings.credentialSource}</th>
                <th>{messages.settings.readOnlyTest}</th>
                <th>{messages.settings.emergencyAccess}</th>
                <th>{messages.settings.requiredEnv}</th>
                <th>{messages.settings.actions}</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.providers.map((provider) => (
                <tr id={provider.providerKey} key={provider.providerKey}>
                  <td>
                    <strong>{provider.displayName}</strong>
                    <div className="muted">{provider.providerKey}</div>
                  </td>
                  <td>{provider.authMethod}</td>
                  <td><StatusBadge messages={messages} state={provider.connectionState} /></td>
                  <td><StatusBadge messages={messages} state={provider.readOnlyTestState} /></td>
                  <td><StatusBadge messages={messages} state={provider.emergencyAccessState} /></td>
                  <td>{provider.requiredEnvKeys.join(", ")}</td>
                  <td>
                    <CredentialControls
                      providerKey={provider.providerKey}
                      labels={{
                        credentialSecret: messages.settings.credentialSecret,
                        accountIds: messages.settings.accountIds,
                        saveCredential: messages.settings.saveCredential,
                        removeCredential: messages.settings.removeCredential,
                        startOAuth: messages.settings.startOAuth,
                        awsManaged: messages.settings.awsManaged,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PreferencesView({ dashboard, locale, messages }: ViewProps) {
  return (
    <div className="two-column">
      <InfoPanel title={messages.settings.preferencesTitle}>
        <KeyValue label={messages.settings.defaultLocale} value={locale.toUpperCase()} />
        <KeyValue label={messages.settings.dashboardTimezone} value={dashboard.timezone} />
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

function ProviderSummaryTable({
  dashboard,
  locale,
  messages,
  serviceLinks = false,
}: ViewProps & { serviceLinks?: boolean }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{messages.services.title}</h2>
        <StatusBadge messages={messages} state={dashboard.summary.providersNeedingAttention > 0 ? "warning" : "ok"} />
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
            {dashboard.providers.length === 0 ? (
              <tr>
                <td colSpan={8}>{messages.empty.noProviders}</td>
              </tr>
            ) : (
              dashboard.providers.map((provider) => (
                <tr key={provider.providerKey}>
                  <td>
                    {serviceLinks ? (
                      <Link href={`/${locale}/services/${provider.providerKey}`}>
                        <strong>{provider.displayName}</strong>
                      </Link>
                    ) : (
                      <strong>{provider.displayName}</strong>
                    )}
                    <div className="muted">{provider.providerKey}</div>
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

function DashboardMeta({ dashboard, messages }: { dashboard: OperationsDashboard; messages: Messages }) {
  return (
    <PageHeader
      title={messages.dashboard.overviewTitle}
      subtitle={messages.dashboard.overviewSubtitle}
      meta={
        <>
          <span>{messages.app.source}: {dashboard.source}</span>
          <span>{messages.app.generated}: {dashboard.generatedAt}</span>
        </>
      }
    />
  );
}

function DatabaseNotice({ dashboard, messages }: { dashboard: OperationsDashboard; messages: Messages }) {
  return dashboard.database.available ? null : <section className="notice">{messages.empty.noDatabase}</section>;
}

function MetricCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-meta">{meta}</p>
    </article>
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
