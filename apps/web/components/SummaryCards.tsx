import type { DashboardSummary } from "../lib/dashboard-data.js";

interface SummaryCardsProps {
  summary: DashboardSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: "Expected spend",
      value: formatMinorAmount(summary.totalEstimatedAmountMinor, summary.currency),
      meta: `${summary.costEstimateCount} estimates`,
    },
    {
      label: "Current billed",
      value: formatMinorAmount(summary.totalBillingAmountMinor, summary.currency),
      meta: `${summary.providerCount} providers`,
    },
    {
      label: "Usage snapshots",
      value: String(summary.usageSnapshotCount),
      meta: "normalized local rows",
    },
    {
      label: "Health",
      value: summary.healthStatus,
      meta: `${summary.alertCount} alerts, ${summary.criticalAlertCount} critical`,
    },
  ];

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" style={sectionHeadingStyle}>
        Summary
      </h2>
      <div style={cardGridStyle}>
        {cards.map((card) => (
          <article key={card.label} style={cardStyle}>
            <p style={labelStyle}>{card.label}</p>
            <p style={valueStyle}>{card.value}</p>
            <p style={metaStyle}>{card.meta}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatMinorAmount(amountMinor: number, currency: string): string {
  if (currency === "MIXED") {
    return "Mixed";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

const sectionHeadingStyle = {
  fontSize: "1rem",
  margin: "0 0 0.75rem",
} as const;

const cardGridStyle = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
} as const;

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #d9dee8",
  borderRadius: "8px",
  padding: "1rem",
} as const;

const labelStyle = {
  color: "#5f6b7a",
  fontSize: "0.82rem",
  margin: 0,
} as const;

const valueStyle = {
  fontSize: "1.55rem",
  fontWeight: 700,
  margin: "0.35rem 0",
} as const;

const metaStyle = {
  color: "#687386",
  fontSize: "0.82rem",
  margin: 0,
} as const;
