import type { DashboardAlertItem } from "../lib/dashboard-data.js";

interface RecentAlertsProps {
  alerts: readonly DashboardAlertItem[];
}

export function RecentAlerts({ alerts }: RecentAlertsProps) {
  return (
    <section aria-labelledby="alerts-heading">
      <h2 id="alerts-heading" style={sectionHeadingStyle}>
        Recent Alerts
      </h2>
      <div style={panelStyle}>
        {alerts.length === 0 ? (
          <p style={emptyTextStyle}>No local alerts found.</p>
        ) : (
          <ul style={listStyle}>
            {alerts.map((alert) => (
              <li key={`${alert.severity}:${alert.title}:${alert.createdAt}`} style={itemStyle}>
                <strong>
                  {alert.severity}: {alert.title}
                </strong>
                <span style={mutedBlockStyle}>
                  {alert.displayName ?? "StackSpend"} · {alert.category} · {alert.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const sectionHeadingStyle = {
  fontSize: "1rem",
  margin: "0 0 0.75rem",
} as const;

const panelStyle = {
  background: "#ffffff",
  border: "1px solid #d9dee8",
  borderRadius: "8px",
  padding: "1rem",
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
