import type { DashboardHealthItem } from "../lib/dashboard-data.js";

interface HealthSectionProps {
  health: readonly DashboardHealthItem[];
}

export function HealthSection({ health }: HealthSectionProps) {
  return (
    <section aria-labelledby="health-heading">
      <h2 id="health-heading" style={sectionHeadingStyle}>
        Health Status
      </h2>
      <div style={panelStyle}>
        {health.length === 0 ? (
          <p style={emptyTextStyle}>No health snapshots found.</p>
        ) : (
          <ul style={listStyle}>
            {health.map((item) => (
              <li key={`${item.providerKey}:${item.service}:${item.collectedAt}`} style={itemStyle}>
                <strong>
                  {item.displayName} · {item.service}
                </strong>
                <span style={mutedBlockStyle}>
                  {item.status}
                  {item.region === null ? "" : ` · ${item.region}`}
                  {item.message === null ? "" : ` · ${item.message}`}
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
