import { HealthSection } from "../components/HealthSection.js";
import { ProviderTable } from "../components/ProviderTable.js";
import { RecentAlerts } from "../components/RecentAlerts.js";
import { RiskSection } from "../components/RiskSection.js";
import { SummaryCards } from "../components/SummaryCards.js";
import { readDashboardSnapshot } from "../lib/dashboard-data.js";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboard = await readDashboardSnapshot();

  return (
    <main style={mainStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>StackSpend</h1>
          <p style={subtitleStyle}>Local dashboard for normalized SQLite snapshots.</p>
        </div>
        <div style={statusStyle}>
          <span>Source: {dashboard.source}</span>
          <span>Generated: {dashboard.generatedAt}</span>
        </div>
      </header>
      {dashboard.database.available ? null : (
        <section style={emptyNoticeStyle}>
          Run the CLI sync pipeline to create local dashboard data. The dashboard is using a safe empty state.
        </section>
      )}
      <SummaryCards summary={dashboard.summary} />
      <ProviderTable providers={dashboard.providers} />
      <RiskSection usage={dashboard.usage} risks={dashboard.risks} />
      <HealthSection health={dashboard.health} />
      <RecentAlerts alerts={dashboard.alerts} />
    </main>
  );
}

const mainStyle = {
  display: "grid",
  gap: "1.25rem",
  margin: "0 auto",
  maxWidth: "1120px",
  padding: "2rem",
} as const;

const headerStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: "1rem",
  justifyContent: "space-between",
} as const;

const titleStyle = {
  fontSize: "2rem",
  lineHeight: 1.1,
  margin: 0,
} as const;

const subtitleStyle = {
  color: "#5f6b7a",
  margin: "0.35rem 0 0",
} as const;

const statusStyle = {
  color: "#5f6b7a",
  display: "grid",
  fontSize: "0.82rem",
  gap: "0.25rem",
  textAlign: "right",
} as const;

const emptyNoticeStyle = {
  background: "#fff7df",
  border: "1px solid #f0d78a",
  borderRadius: "8px",
  color: "#725300",
  padding: "0.85rem 1rem",
} as const;
