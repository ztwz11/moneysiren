import {
  normalizeCloudflareBillingUsage,
  type CloudflareNormalizedSnapshotBundle,
  type CloudflareUnavailableSurface,
} from "./normalize.js";

export {
  createCloudflareBillingUsageClient,
  createStaticCloudflareBillingUsageClient,
  type CloudflareApiPath,
  type CloudflareApiRequest,
  type CloudflareApiTransport,
  type CloudflareBillingUsageClient,
  type CreateCloudflareBillingUsageClientOptions,
} from "./client.js";
export {
  cloudflareAmountToMinorUnits,
  normalizeCloudflareBillingUsage,
  redactedCloudflareAccountId,
  type CloudflareAccount,
  type CloudflareBillableUsageRecord,
  type CloudflareBillingSnapshot,
  type CloudflareBillingUsagePayload,
  type CloudflareCostEstimate,
  type CloudflareNormalizedSnapshotBundle,
  type CloudflarePaygoUsageRecord,
  type CloudflareServiceHealthSnapshot,
  type CloudflareStatusSignal,
  type CloudflareUnavailableSurface,
  type CloudflareUsageSnapshot,
  type NormalizeCloudflareBillingUsageInput,
} from "./normalize.js";
import type { CloudflareBillingUsageClient } from "./client.js";

export interface CloudflareProviderCollectionContext {
  now(): Date;
}

export interface CloudflareProviderConnector {
  kind: "cloudflare";
  displayName: "Cloudflare Billing/Usage Experimental";
  access: "read-only";
  collect(context: CloudflareProviderCollectionContext): Promise<CloudflareProviderCollectionResult>;
}

export interface CloudflareProviderCollectionResult {
  collectedAt: string;
  status: "ok" | "partial" | "error";
  snapshots: CloudflareNormalizedSnapshotBundle;
  alerts: readonly CloudflareProviderAlert[];
  errors?: readonly string[];
}

export interface CloudflareProviderAlert {
  provider: "cloudflare";
  createdAt: string;
  severity: "warning";
  category: "provider-sync";
  title:
    | "Cloudflare billing/usage sync failed"
    | "Cloudflare billable usage surface unavailable"
    | "Cloudflare PayGo usage surface unavailable"
    | "Cloudflare subscriptions surface unavailable";
  message:
    | "Cloudflare billing/usage request failed before normalized snapshots were collected."
    | "Cloudflare billable usage API was restricted or unavailable; normalized sync continued with available data."
    | "Cloudflare PayGo usage API was restricted or unavailable; normalized sync continued with available data."
    | "Cloudflare subscriptions API was restricted or unavailable; normalized sync continued with available data.";
}

export interface CloudflareBillingUsageConnectorOptions {
  client: CloudflareBillingUsageClient;
}

const EMPTY_CLOUDFLARE_SNAPSHOTS: CloudflareNormalizedSnapshotBundle = {
  usage: [],
  billing: [],
  serviceHealth: [],
  costEstimates: [],
};

export function createCloudflareBillingUsageConnector(
  options: CloudflareBillingUsageConnectorOptions,
): CloudflareProviderConnector {
  return {
    kind: "cloudflare",
    displayName: "Cloudflare Billing/Usage Experimental",
    access: "read-only",
    async collect(context) {
      const collectedAt = context.now().toISOString();

      try {
        const payload = await options.client.fetchBillingUsage();
        const alerts = unavailableSurfaceAlerts(payload.unavailable ?? [], collectedAt);

        return {
          collectedAt,
          status: alerts.length === 0 ? "ok" : "partial",
          snapshots: normalizeCloudflareBillingUsage({
            payload,
            collectedAt,
          }),
          alerts,
          ...(alerts.length === 0 ? {} : { errors: alerts.map((alert) => alert.message) }),
        };
      } catch {
        return {
          collectedAt,
          status: "error",
          snapshots: EMPTY_CLOUDFLARE_SNAPSHOTS,
          alerts: [
            {
              provider: "cloudflare",
              createdAt: collectedAt,
              severity: "warning",
              category: "provider-sync",
              title: "Cloudflare billing/usage sync failed",
              message: "Cloudflare billing/usage request failed before normalized snapshots were collected.",
            },
          ],
          errors: ["Cloudflare billing/usage request failed."],
        };
      }
    },
  };
}

function unavailableSurfaceAlerts(
  surfaces: readonly CloudflareUnavailableSurface[],
  collectedAt: string,
): CloudflareProviderAlert[] {
  const uniqueSurfaces = new Set(surfaces.map((surface) => surface.surface));

  return [...uniqueSurfaces].sort().map((surface) => ({
    provider: "cloudflare",
    createdAt: collectedAt,
    severity: "warning",
    category: "provider-sync",
    title: unavailableSurfaceTitle(surface),
    message: unavailableSurfaceMessage(surface),
  }));
}

function unavailableSurfaceTitle(surface: CloudflareUnavailableSurface["surface"]): CloudflareProviderAlert["title"] {
  if (surface === "billable-usage") {
    return "Cloudflare billable usage surface unavailable";
  }

  if (surface === "paygo-usage") {
    return "Cloudflare PayGo usage surface unavailable";
  }

  return "Cloudflare subscriptions surface unavailable";
}

function unavailableSurfaceMessage(
  surface: CloudflareUnavailableSurface["surface"],
): CloudflareProviderAlert["message"] {
  if (surface === "billable-usage") {
    return "Cloudflare billable usage API was restricted or unavailable; normalized sync continued with available data.";
  }

  if (surface === "paygo-usage") {
    return "Cloudflare PayGo usage API was restricted or unavailable; normalized sync continued with available data.";
  }

  return "Cloudflare subscriptions API was restricted or unavailable; normalized sync continued with available data.";
}
