import { createHash } from "node:crypto";

const SUPABASE_PROVIDER = "supabase";
const PROJECT_REF_HASH_PREFIX = "supabase-project";

export interface SupabaseUsageHealthPayload {
  projects?: readonly SupabaseProject[];
  usage?: readonly SupabaseProjectUsage[];
  health?: readonly SupabaseProjectHealth[];
  unavailable?: readonly SupabaseUnavailableSurface[];
}

export interface SupabaseProject {
  id?: string;
  ref?: string;
  name?: string;
  region?: string;
  status?: string;
  organization_id?: string;
}

export interface SupabaseProjectUsage {
  ref?: string;
  projectRef?: string;
  apiCounts?: SupabaseApiCountsResponse;
  apiRequestsCount?: SupabaseApiRequestsCountResponse;
}

export interface SupabaseApiCountsResponse {
  result?: readonly SupabaseApiCountsRow[];
  data?: readonly SupabaseApiCountsRow[];
}

export interface SupabaseApiCountsRow {
  timestamp?: string;
  total_auth_requests?: number | string;
  total_realtime_requests?: number | string;
  total_rest_requests?: number | string;
  total_storage_requests?: number | string;
}

export interface SupabaseApiRequestsCountResponse {
  result?: readonly SupabaseApiRequestsCountRow[];
  data?: readonly SupabaseApiRequestsCountRow[];
}

export interface SupabaseApiRequestsCountRow {
  count?: number | string;
}

export interface SupabaseProjectHealth {
  ref?: string;
  projectRef?: string;
  services?: readonly SupabaseProjectHealthService[];
  result?: readonly SupabaseProjectHealthService[] | Record<string, unknown>;
  data?: readonly SupabaseProjectHealthService[] | Record<string, unknown>;
}

export interface SupabaseProjectHealthService {
  name?: string;
  service?: string;
  status?: string;
  message?: string;
  error?: string;
}

export interface SupabaseUnavailableSurface {
  surface: "projects" | "usage.api-counts" | "usage.api-requests-count" | "health";
  ref?: string;
}

export interface SupabaseNormalizedSnapshotBundle {
  usage: readonly SupabaseUsageSnapshot[];
  billing: readonly SupabaseBillingSnapshot[];
  serviceHealth: readonly SupabaseServiceHealthSnapshot[];
  costEstimates: readonly SupabaseCostEstimate[];
}

export interface SupabaseUsageSnapshot {
  provider: typeof SUPABASE_PROVIDER;
  collectedAt: string;
  providerAccountRef: string;
  service: string;
  metric:
    | "api_requests"
    | "auth_requests"
    | "realtime_requests"
    | "rest_requests"
    | "storage_requests";
  unit: "requests";
  value: number;
}

export interface SupabaseBillingSnapshot {
  provider: typeof SUPABASE_PROVIDER;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface SupabaseServiceHealthSnapshot {
  provider: typeof SUPABASE_PROVIDER;
  collectedAt: string;
  service: string;
  region?: string;
  status: "ok" | "degraded" | "down" | "unknown";
  message?: string;
}

export interface SupabaseCostEstimate {
  provider: typeof SUPABASE_PROVIDER;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "low" | "medium" | "high";
}

export interface NormalizeSupabaseUsageHealthInput {
  payload: SupabaseUsageHealthPayload;
  collectedAt: string;
}

interface UsageCounterDefinition {
  metric: SupabaseUsageSnapshot["metric"];
  servicePrefix: string;
  field: keyof SupabaseApiCountsRow;
}

const API_COUNT_COUNTERS: readonly UsageCounterDefinition[] = [
  {
    metric: "auth_requests",
    servicePrefix: "auth",
    field: "total_auth_requests",
  },
  {
    metric: "realtime_requests",
    servicePrefix: "realtime",
    field: "total_realtime_requests",
  },
  {
    metric: "rest_requests",
    servicePrefix: "rest",
    field: "total_rest_requests",
  },
  {
    metric: "storage_requests",
    servicePrefix: "storage",
    field: "total_storage_requests",
  },
];

export function normalizeSupabaseUsageHealth(
  input: NormalizeSupabaseUsageHealthInput,
): SupabaseNormalizedSnapshotBundle {
  return {
    usage: normalizeUsage(input.payload.usage ?? [], input.collectedAt),
    billing: [],
    serviceHealth: normalizeHealth(input.payload, input.collectedAt),
    costEstimates: [],
  };
}

export function redactedSupabaseProjectRef(ref: string): string {
  const trimmedRef = requireNonBlankString(ref, "Supabase project ref");
  const digest = createHash("sha256").update(`supabase:${trimmedRef}`).digest("hex").slice(0, 16);

  return `${PROJECT_REF_HASH_PREFIX}:${digest}`;
}

function normalizeUsage(
  projectUsages: readonly SupabaseProjectUsage[],
  collectedAt: string,
): SupabaseUsageSnapshot[] {
  const snapshots: SupabaseUsageSnapshot[] = [];

  for (const projectUsage of projectUsages) {
    const ref = readPayloadProjectRef(projectUsage);
    const projectRef = redactedSupabaseProjectRef(ref);
    const apiRequestCount = sumApiRequestsCount(projectUsage.apiRequestsCount);

    pushUsageSnapshot(snapshots, {
      collectedAt,
      projectRef,
      servicePrefix: "api",
      metric: "api_requests",
      value: apiRequestCount,
    });

    for (const counter of API_COUNT_COUNTERS) {
      pushUsageSnapshot(snapshots, {
        collectedAt,
        projectRef,
        servicePrefix: counter.servicePrefix,
        metric: counter.metric,
        value: sumApiCounts(projectUsage.apiCounts, counter.field),
      });
    }
  }

  return snapshots;
}

function normalizeHealth(
  payload: SupabaseUsageHealthPayload,
  collectedAt: string,
): SupabaseServiceHealthSnapshot[] {
  const snapshots: SupabaseServiceHealthSnapshot[] = [];
  const projectsByRef = new Map<string, SupabaseProject>();

  for (const project of payload.projects ?? []) {
    const ref = readProjectRef(project);

    if (ref === undefined) {
      continue;
    }

    projectsByRef.set(ref, project);
    snapshots.push(buildProjectHealthSnapshot(project, ref, collectedAt));
  }

  for (const projectHealth of payload.health ?? []) {
    const ref = readPayloadProjectRef(projectHealth);
    const project = projectsByRef.get(ref);
    const projectRef = redactedSupabaseProjectRef(ref);
    const region = readOptionalNonBlankString(project?.region);

    for (const service of readHealthServices(projectHealth)) {
      const serviceName = normalizeServiceName(readServiceName(service));
      const status = mapServiceStatus(readOptionalNonBlankString(service.status));
      const message = sanitizeHealthMessage(readServiceMessage(service), ref);

      snapshots.push({
        provider: SUPABASE_PROVIDER,
        collectedAt,
        service: `${serviceName}:${projectRef}`,
        ...(region === undefined ? {} : { region }),
        status,
        ...(message === undefined ? {} : { message }),
      });
    }
  }

  return snapshots;
}

function buildProjectHealthSnapshot(
  project: SupabaseProject,
  ref: string,
  collectedAt: string,
): SupabaseServiceHealthSnapshot {
  const status = mapProjectStatus(readOptionalNonBlankString(project.status));
  const region = readOptionalNonBlankString(project.region);
  const message = projectStatusMessage(readOptionalNonBlankString(project.status));

  return {
    provider: SUPABASE_PROVIDER,
    collectedAt,
    service: `project:${redactedSupabaseProjectRef(ref)}`,
    ...(region === undefined ? {} : { region }),
    status,
    ...(message === undefined ? {} : { message }),
  };
}

function pushUsageSnapshot(
  snapshots: SupabaseUsageSnapshot[],
  input: {
    collectedAt: string;
    projectRef: string;
    servicePrefix: string;
    metric: SupabaseUsageSnapshot["metric"];
    value: number | undefined;
  },
): void {
  if (input.value === undefined || input.value <= 0) {
    return;
  }

  snapshots.push({
    provider: SUPABASE_PROVIDER,
    collectedAt: input.collectedAt,
    providerAccountRef: input.projectRef,
    service: `${input.servicePrefix}:${input.projectRef}`,
    metric: input.metric,
    unit: "requests",
    value: input.value,
  });
}

function sumApiRequestsCount(response: SupabaseApiRequestsCountResponse | undefined): number | undefined {
  const rows = response?.result ?? response?.data ?? [];
  let total = 0;
  let sawValue = false;

  for (const row of rows) {
    const value = readOptionalFiniteNumber(row.count, "Supabase usage.api-requests-count count");

    if (value !== undefined) {
      total += value;
      sawValue = true;
    }
  }

  return sawValue ? total : undefined;
}

function sumApiCounts(
  response: SupabaseApiCountsResponse | undefined,
  field: keyof SupabaseApiCountsRow,
): number | undefined {
  const rows = response?.result ?? response?.data ?? [];
  let total = 0;
  let sawValue = false;

  for (const row of rows) {
    const value = readOptionalFiniteNumber(row[field], `Supabase ${String(field)}`);

    if (value !== undefined) {
      total += value;
      sawValue = true;
    }
  }

  return sawValue ? total : undefined;
}

function readHealthServices(projectHealth: SupabaseProjectHealth): SupabaseProjectHealthService[] {
  if (Array.isArray(projectHealth.services)) {
    return [...projectHealth.services];
  }

  if (Array.isArray(projectHealth.result)) {
    return [...projectHealth.result];
  }

  if (Array.isArray(projectHealth.data)) {
    return [...projectHealth.data];
  }

  const objectResult = isRecord(projectHealth.result) ? projectHealth.result : projectHealth.data;

  if (!isRecord(objectResult)) {
    return [];
  }

  return Object.entries(objectResult).map(([name, value]) => {
    if (isRecord(value)) {
      const status = readOptionalNonBlankString(value.status);
      const message = readOptionalNonBlankString(value.message);
      const error = readOptionalNonBlankString(value.error);

      return {
        name,
        ...(status === undefined ? {} : { status }),
        ...(message === undefined ? {} : { message }),
        ...(error === undefined ? {} : { error }),
      };
    }

    return {
      name,
      status: typeof value === "string" ? value : "unknown",
    };
  });
}

function readProjectRef(project: SupabaseProject): string | undefined {
  const ref = readOptionalNonBlankString(project.id) ?? readOptionalNonBlankString(project.ref);

  return ref;
}

function readPayloadProjectRef(value: { ref?: string; projectRef?: string }): string {
  return requireNonBlankString(value.ref ?? value.projectRef, "Supabase project ref");
}

function readServiceName(service: SupabaseProjectHealthService): string {
  return requireNonBlankString(service.name ?? service.service, "Supabase service name");
}

function readServiceMessage(service: SupabaseProjectHealthService): string | undefined {
  return readOptionalNonBlankString(service.message) ?? readOptionalNonBlankString(service.error);
}

function normalizeServiceName(serviceName: string): string {
  return serviceName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "service";
}

function mapProjectStatus(status: string | undefined): SupabaseServiceHealthSnapshot["status"] {
  const normalizedStatus = status?.trim().toLowerCase();

  if (normalizedStatus === undefined) {
    return "unknown";
  }

  if (["active", "available", "healthy", "ok", "running"].includes(normalizedStatus)) {
    return "ok";
  }

  if (["paused", "inactive", "restoring", "upgrading"].includes(normalizedStatus)) {
    return "degraded";
  }

  if (["failed", "unhealthy", "down", "error"].includes(normalizedStatus)) {
    return "down";
  }

  return "unknown";
}

function projectStatusMessage(status: string | undefined): string | undefined {
  return status?.trim().toLowerCase() === "paused" ? "Project is paused." : undefined;
}

function mapServiceStatus(status: string | undefined): SupabaseServiceHealthSnapshot["status"] {
  const normalizedStatus = status?.trim().toLowerCase();

  if (normalizedStatus === undefined) {
    return "unknown";
  }

  if (["active", "available", "healthy", "ok", "running", "operational"].includes(normalizedStatus)) {
    return "ok";
  }

  if (["degraded", "warning", "limited"].includes(normalizedStatus)) {
    return "degraded";
  }

  if (["failed", "unhealthy", "down", "error", "unavailable"].includes(normalizedStatus)) {
    return "down";
  }

  return "unknown";
}

function sanitizeHealthMessage(message: string | undefined, rawProjectRef: string): string | undefined {
  const trimmedMessage = readOptionalNonBlankString(message);

  if (trimmedMessage === undefined) {
    return undefined;
  }

  return trimmedMessage
    .replaceAll(rawProjectRef, "[REDACTED:supabase_project]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED:email]")
    .replace(/\b(?:proj|project)[_-][A-Za-z0-9_-]+\b/gi, "[REDACTED:project]")
    .slice(0, 240);
}

function readOptionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return numberValue;
}

function requireNonBlankString(value: unknown, label: string): string {
  const trimmedValue = readOptionalNonBlankString(value);

  if (trimmedValue === undefined) {
    throw new Error(`${label} must be a non-blank string.`);
  }

  return trimmedValue;
}

function readOptionalNonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
