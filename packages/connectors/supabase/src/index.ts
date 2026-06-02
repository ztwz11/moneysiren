import {
  normalizeSupabaseUsageHealth,
  type SupabaseNormalizedSnapshotBundle,
  type SupabaseUnavailableSurface,
  type SupabaseUsageHealthPayload,
} from "./normalize.js";

export {
  createStaticSupabaseUsageHealthClient,
  createSupabaseManagementClient,
  type CreateSupabaseManagementClientOptions,
  type SupabaseManagementClient,
  type SupabaseManagementPath,
  type SupabaseManagementRequest,
  type SupabaseManagementTransport,
} from "./client.js";
export {
  normalizeSupabaseUsageHealth,
  redactedSupabaseProjectRef,
  type NormalizeSupabaseUsageHealthInput,
  type SupabaseApiCountsResponse,
  type SupabaseApiCountsRow,
  type SupabaseApiRequestsCountResponse,
  type SupabaseApiRequestsCountRow,
  type SupabaseBillingSnapshot,
  type SupabaseCostEstimate,
  type SupabaseNormalizedSnapshotBundle,
  type SupabaseProject,
  type SupabaseProjectHealth,
  type SupabaseProjectHealthService,
  type SupabaseProjectUsage,
  type SupabaseServiceHealthSnapshot,
  type SupabaseUnavailableSurface,
  type SupabaseUsageHealthPayload,
  type SupabaseUsageSnapshot,
} from "./normalize.js";
import type { SupabaseManagementClient } from "./client.js";

export interface SupabaseProviderCollectionContext {
  now(): Date;
}

export interface SupabaseProviderConnector {
  kind: "supabase";
  displayName: "Supabase Usage/Health";
  access: "read-only";
  collect(context: SupabaseProviderCollectionContext): Promise<SupabaseProviderCollectionResult>;
}

export interface SupabaseProviderCollectionResult {
  collectedAt: string;
  status: "ok" | "partial" | "error";
  snapshots: SupabaseNormalizedSnapshotBundle;
  alerts: readonly SupabaseProviderAlert[];
  errors?: readonly string[];
}

export interface SupabaseProviderAlert {
  provider: "supabase";
  createdAt: string;
  severity: "warning";
  category: "provider-sync";
  title:
    | "Supabase usage/health sync failed"
    | "Supabase projects surface unavailable"
    | "Supabase usage.api-counts surface unavailable"
    | "Supabase usage.api-requests-count surface unavailable"
    | "Supabase health surface unavailable";
  message:
    | "Supabase usage/health request failed before normalized snapshots were collected."
    | "Supabase projects request failed before normalized snapshots were collected."
    | "Supabase usage.api-counts request failed before normalized snapshots were collected."
    | "Supabase usage.api-requests-count request failed before normalized snapshots were collected."
    | "Supabase health request failed before normalized snapshots were collected.";
}

export interface SupabaseUsageHealthConnectorOptions {
  client: SupabaseManagementClient;
}

const EMPTY_SUPABASE_SNAPSHOTS: SupabaseNormalizedSnapshotBundle = {
  usage: [],
  billing: [],
  serviceHealth: [],
  costEstimates: [],
};

export function createSupabaseUsageHealthConnector(
  options: SupabaseUsageHealthConnectorOptions,
): SupabaseProviderConnector {
  return {
    kind: "supabase",
    displayName: "Supabase Usage/Health",
    access: "read-only",
    async collect(context) {
      const collectedAt = context.now().toISOString();

      try {
        const payload = await options.client.fetchUsageHealth();
        const alerts = unavailableSurfaceAlerts(payload.unavailable ?? [], collectedAt);

        return {
          collectedAt,
          status: alerts.length === 0 ? "ok" : "partial",
          snapshots: normalizeSupabaseUsageHealth({
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
          snapshots: EMPTY_SUPABASE_SNAPSHOTS,
          alerts: [
            {
              provider: "supabase",
              createdAt: collectedAt,
              severity: "warning",
              category: "provider-sync",
              title: "Supabase usage/health sync failed",
              message: "Supabase usage/health request failed before normalized snapshots were collected.",
            },
          ],
          errors: ["Supabase usage/health request failed."],
        };
      }
    },
  };
}

function unavailableSurfaceAlerts(
  surfaces: readonly SupabaseUnavailableSurface[],
  collectedAt: string,
): SupabaseProviderAlert[] {
  const uniqueSurfaces = new Set(surfaces.map((surface) => surface.surface));

  return [...uniqueSurfaces].sort().map((surface) => ({
    provider: "supabase",
    createdAt: collectedAt,
    severity: "warning",
    category: "provider-sync",
    title: unavailableSurfaceTitle(surface),
    message: unavailableSurfaceMessage(surface),
  }));
}

function unavailableSurfaceTitle(surface: SupabaseUnavailableSurface["surface"]): SupabaseProviderAlert["title"] {
  if (surface === "projects") {
    return "Supabase projects surface unavailable";
  }

  if (surface === "usage.api-counts") {
    return "Supabase usage.api-counts surface unavailable";
  }

  if (surface === "usage.api-requests-count") {
    return "Supabase usage.api-requests-count surface unavailable";
  }

  return "Supabase health surface unavailable";
}

function unavailableSurfaceMessage(surface: SupabaseUnavailableSurface["surface"]): SupabaseProviderAlert["message"] {
  if (surface === "projects") {
    return "Supabase projects request failed before normalized snapshots were collected.";
  }

  if (surface === "usage.api-counts") {
    return "Supabase usage.api-counts request failed before normalized snapshots were collected.";
  }

  if (surface === "usage.api-requests-count") {
    return "Supabase usage.api-requests-count request failed before normalized snapshots were collected.";
  }

  return "Supabase health request failed before normalized snapshots were collected.";
}
