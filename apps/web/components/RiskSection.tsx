import type { DashboardRiskItem, DashboardUsageSummary } from "../lib/dashboard-data.js";

interface RiskSectionProps {
  usage: DashboardUsageSummary;
  risks: readonly DashboardRiskItem[];
}

export function RiskSection({ usage, risks }: RiskSectionProps) {
  return (
    <section aria-labelledby="usage-risk-heading">
      <h2 id="usage-risk-heading" style={sectionHeadingStyle}>
        Usage And Risk
      </h2>
      <div style={gridStyle}>
        <div style={panelStyle}>
          <h3 style={panelHeadingStyle}>Usage</h3>
          {usage.topMetrics.length === 0 ? (
            <p style={emptyTextStyle}>No usage snapshots found.</p>
          ) : (
            <ul style={listStyle}>
              {usage.topMetrics.map((metric) => (
                <li key={`${metric.providerKey}:${metric.service}:${metric.metric}:${metric.collectedAt}`} style={itemStyle}>
                  <strong>{metric.displayName}</strong>
                  <span style={mutedBlockStyle}>
                    {metric.service} · {metric.metric}: {metric.value} {metric.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={panelStyle}>
          <h3 style={panelHeadingStyle}>Risks</h3>
          {risks.length === 0 ? (
            <p style={emptyTextStyle}>No warning or critical local alerts.</p>
          ) : (
            <ul style={listStyle}>
              {risks.map((risk) => (
                <li key={`${risk.severity}:${risk.title}:${risk.createdAt}`} style={itemStyle}>
                  <strong>
                    {risk.severity}: {risk.title}
                  </strong>
                  <span style={mutedBlockStyle}>{risk.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const sectionHeadingStyle = {
  fontSize: "1rem",
  margin: "0 0 0.75rem",
} as const;

const gridStyle = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
} as const;

const panelStyle = {
  background: "#ffffff",
  border: "1px solid #d9dee8",
  borderRadius: "8px",
  padding: "1rem",
} as const;

const panelHeadingStyle = {
  fontSize: "0.95rem",
  margin: "0 0 0.75rem",
} as const;

const listStyle = {
  display: "grid",
  gap: "0.65rem",
  listStyle: "none",
  margin: 0,
  padding: 0,
} as const;

const itemStyle = {
  borderTop: "1px solid #edf0f5",
  paddingTop: "0.65rem",
} as const;

const emptyTextStyle = {
  color: "#687386",
  margin: 0,
} as const;

const mutedBlockStyle = {
  color: "#687386",
  display: "block",
  fontSize: "0.85rem",
  marginTop: "0.2rem",
} as const;
