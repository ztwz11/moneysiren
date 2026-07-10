import { describe, expect, it } from "vitest";
import type {
  CollectedProviderSnapshots,
  ProviderKind,
} from "../../../../packages/core/src/index.js";
import {
  createCollectionSyncResult,
  createSyncFailure,
  renderSyncResult,
  syncResultExitCode,
} from "./sync-result.js";

const COLLECTED_AT = "2026-07-10T00:00:00.000Z";

describe("sync result contract", () => {
  it("maps ok to exit 0 and renders one stable summary", () => {
    const result = createCollectionSyncResult(collection("mock", "ok", { usage: 1 }));
    const rendered = renderSyncResult(result);

    expect(syncResultExitCode(result)).toBe(0);
    expect(rendered.summary).toBe(
      "Sync mock: ok usage=1 billing=0 health=0 estimates=0 alerts=0",
    );
    expect(rendered.diagnostic).toBeUndefined();
  });

  it("maps partial usable data to exit 2", () => {
    const result = createCollectionSyncResult(
      collection("supabase", "partial", {
        usage: 1,
        alerts: 1,
        errors: ["synthetic upstream detail that must not be rendered"],
      }),
    );
    const rendered = renderSyncResult(result);

    expect(syncResultExitCode(result)).toBe(2);
    expect(rendered.summary).toContain("Sync supabase: partial");
    expect(rendered.diagnostic).toContain("SYNC_PARTIAL");
    expect(JSON.stringify(rendered)).not.toContain("synthetic upstream detail");
  });

  it("downgrades partial without usable snapshots to error", () => {
    const result = createCollectionSyncResult(
      collection("cloudflare", "partial", { alerts: 1 }),
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("SYNC_NO_USABLE_DATA");
    expect(syncResultExitCode(result)).toBe(1);
  });

  it("maps provider error to exit 1 without exposing connector errors", () => {
    const result = createCollectionSyncResult(
      collection("openai", "error", {
        alerts: 1,
        errors: ["synthetic raw upstream response"],
      }),
    );
    const rendered = renderSyncResult(result);

    expect(syncResultExitCode(result)).toBe(1);
    expect(rendered.summary).toContain("Sync openai: error");
    expect(rendered.diagnostic).toContain("SYNC_COLLECTION");
    expect(JSON.stringify(rendered)).not.toContain("synthetic raw upstream response");
  });

  it("maps configuration failure to exit 1", () => {
    const result = createSyncFailure(
      "aws",
      "SYNC_CONFIGURATION",
      "AWS sync configuration is missing.",
    );

    expect(syncResultExitCode(result)).toBe(1);
    expect(renderSyncResult(result).diagnostic).toBe(
      "Sync aws SYNC_CONFIGURATION: AWS sync configuration is missing.",
    );
  });
});

function collection(
  provider: ProviderKind,
  status: CollectedProviderSnapshots["status"],
  options: {
    usage?: number;
    billing?: number;
    health?: number;
    estimates?: number;
    alerts?: number;
    errors?: readonly string[];
  } = {},
): CollectedProviderSnapshots {
  const usage = Array.from({ length: options.usage ?? 0 }, () => ({
    provider,
    collectedAt: COLLECTED_AT,
    service: "synthetic-service",
    metric: "requests",
    unit: "count",
    value: 1,
  }));
  const billing = Array.from({ length: options.billing ?? 0 }, () => ({
    provider,
    collectedAt: COLLECTED_AT,
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    amountMinor: 100,
    currency: "USD",
    status: "estimated",
  }));
  const serviceHealth = Array.from({ length: options.health ?? 0 }, () => ({
    provider,
    collectedAt: COLLECTED_AT,
    service: "synthetic-service",
    status: "ok" as const,
  }));
  const costEstimates = Array.from({ length: options.estimates ?? 0 }, () => ({
    provider,
    collectedAt: COLLECTED_AT,
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    estimatedAmountMinor: 100,
    currency: "USD",
    confidence: "medium" as const,
  }));
  const alerts = Array.from({ length: options.alerts ?? 0 }, () => ({
    provider,
    createdAt: COLLECTED_AT,
    severity: "warning" as const,
    category: "provider-sync",
    title: "Synthetic provider warning",
    message: "Synthetic sanitized warning.",
  }));
  const base = {
    provider,
    collectedAt: COLLECTED_AT,
    status,
    snapshots: { usage, billing, serviceHealth, costEstimates },
    alerts,
  };

  return options.errors === undefined ? base : { ...base, errors: options.errors };
}
