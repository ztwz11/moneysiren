import type { DashboardProviderRow } from "../lib/dashboard-data";

interface ProviderTableProps {
  providers: readonly DashboardProviderRow[];
}

export function ProviderTable({ providers }: ProviderTableProps) {
  return (
    <section aria-labelledby="providers-heading">
      <h2 id="providers-heading" style={sectionHeadingStyle}>
        Provider Costs
      </h2>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Provider</Th>
              <Th>Expected</Th>
              <Th>Billed</Th>
              <Th>Usage</Th>
              <Th>Health</Th>
              <Th>Sync</Th>
              <Th>Risk</Th>
              <Th>Latest</Th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 ? (
              <tr>
                <td colSpan={8} style={emptyCellStyle}>
                  No local provider data yet.
                </td>
              </tr>
            ) : (
              providers.map((provider) => (
                <tr key={provider.providerKey}>
                  <Td>
                    <strong>{provider.displayName}</strong>
                    <br />
                    <span style={mutedStyle}>{provider.providerKey}</span>
                  </Td>
                  <Td>{formatMinorAmount(provider.estimatedAmountMinor, provider.currency)}</Td>
                  <Td>{formatMinorAmount(provider.billingAmountMinor, provider.currency)}</Td>
                  <Td>{provider.usageSnapshotCount}</Td>
                  <Td>{provider.healthStatus}</Td>
                  <Td>
                    {provider.freshness.status}
                    {provider.freshness.lastRefreshFailed ? (
                      <>
                        <br />
                        <span style={mutedStyle}>last attempt failed</span>
                      </>
                    ) : null}
                  </Td>
                  <Td>{provider.riskLevel}</Td>
                  <Td>{provider.latestCollectedAt ?? "none"}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
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

const tableWrapStyle = {
  background: "#ffffff",
  border: "1px solid #d9dee8",
  borderRadius: "8px",
  overflowX: "auto",
} as const;

const tableStyle = {
  borderCollapse: "collapse",
  minWidth: "840px",
  width: "100%",
} as const;

const thStyle = {
  borderBottom: "1px solid #d9dee8",
  color: "#5f6b7a",
  fontSize: "0.78rem",
  padding: "0.75rem",
  textAlign: "left",
  textTransform: "uppercase",
} as const;

const tdStyle = {
  borderBottom: "1px solid #edf0f5",
  fontSize: "0.9rem",
  padding: "0.75rem",
  verticalAlign: "top",
} as const;

const emptyCellStyle = {
  color: "#687386",
  padding: "1rem",
  textAlign: "center",
} as const;

const mutedStyle = {
  color: "#687386",
  fontSize: "0.8rem",
} as const;
