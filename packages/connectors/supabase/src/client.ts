import type {
  SupabaseApiCountsResponse,
  SupabaseApiRequestsCountResponse,
  SupabaseProject,
  SupabaseProjectHealth,
  SupabaseProjectUsage,
  SupabaseUsageHealthPayload,
  SupabaseUnavailableSurface,
} from "./normalize.js";

export interface SupabaseManagementClient {
  fetchUsageHealth(): Promise<SupabaseUsageHealthPayload>;
}

export type SupabaseManagementPath =
  | "/v1/projects"
  | `/v1/projects/${string}/analytics/endpoints/usage.api-counts`
  | `/v1/projects/${string}/analytics/endpoints/usage.api-requests-count`
  | `/v1/projects/${string}/health`;

export interface SupabaseManagementRequest {
  path: SupabaseManagementPath;
  query: Record<string, string | readonly string[]>;
  headers: {
    Authorization: string;
  };
}

export interface SupabaseManagementTransport {
  getJson(request: SupabaseManagementRequest): Promise<unknown>;
}

export interface CreateSupabaseManagementClientOptions {
  accessToken: string;
  transport?: SupabaseManagementTransport;
}

const SUPABASE_API_BASE_URL = "https://api.supabase.com";

const defaultSupabaseManagementTransport: SupabaseManagementTransport = {
  async getJson(request) {
    const url = new URL(request.path, SUPABASE_API_BASE_URL);

    for (const [key, value] of Object.entries(request.query)) {
      if (isReadonlyStringArray(value)) {
        for (const nestedValue of value) {
          url.searchParams.append(key, nestedValue);
        }

        continue;
      }

      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: request.headers,
    });

    if (!response.ok) {
      throw new Error(`Supabase Management API request failed with status ${response.status}.`);
    }

    return response.json();
  },
};

export function createSupabaseManagementClient(
  options: CreateSupabaseManagementClientOptions,
): SupabaseManagementClient {
  const accessToken = options.accessToken.trim();

  if (accessToken.length === 0) {
    throw new Error("SUPABASE_ACCESS_TOKEN must not be blank.");
  }

  const transport = options.transport ?? defaultSupabaseManagementTransport;

  return {
    async fetchUsageHealth() {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };
      const projects = coerceProjectList(
        await transport.getJson({
          path: "/v1/projects",
          query: {},
          headers,
        }),
      );
      const usage: SupabaseProjectUsage[] = [];
      const health: SupabaseProjectHealth[] = [];
      const unavailable: SupabaseUnavailableSurface[] = [];

      for (const project of projects) {
        const ref = readProjectRef(project);

        if (ref === undefined) {
          continue;
        }

        const encodedRef = encodeURIComponent(ref);
        const usageEntry: {
          ref: string;
          apiCounts?: SupabaseApiCountsResponse;
          apiRequestsCount?: SupabaseApiRequestsCountResponse;
        } = {
          ref,
        };
        const apiCounts = await tryFetchSurface<SupabaseApiCountsResponse>(
          transport,
          {
            path: `/v1/projects/${encodedRef}/analytics/endpoints/usage.api-counts`,
            query: {},
            headers,
          },
          unavailable,
          "usage.api-counts",
          ref,
        );

        if (apiCounts !== undefined) {
          usageEntry.apiCounts = apiCounts;
        }

        const apiRequestsCount = await tryFetchSurface<SupabaseApiRequestsCountResponse>(
          transport,
          {
            path: `/v1/projects/${encodedRef}/analytics/endpoints/usage.api-requests-count`,
            query: {},
            headers,
          },
          unavailable,
          "usage.api-requests-count",
          ref,
        );

        if (apiRequestsCount !== undefined) {
          usageEntry.apiRequestsCount = apiRequestsCount;
        }

        if (usageEntry.apiCounts !== undefined || usageEntry.apiRequestsCount !== undefined) {
          usage.push(usageEntry);
        }

        const healthPayload = await tryFetchSurface<Omit<SupabaseProjectHealth, "ref">>(
          transport,
          {
            path: `/v1/projects/${encodedRef}/health`,
            query: {},
            headers,
          },
          unavailable,
          "health",
          ref,
        );

        if (healthPayload !== undefined) {
          health.push({
            ref,
            ...healthPayload,
          });
        }
      }

      return {
        projects,
        usage,
        health,
        unavailable,
      };
    },
  };
}

export function createStaticSupabaseUsageHealthClient(
  payload: SupabaseUsageHealthPayload,
): SupabaseManagementClient {
  return {
    async fetchUsageHealth() {
      return payload;
    },
  };
}

async function tryFetchSurface<Response>(
  transport: SupabaseManagementTransport,
  request: SupabaseManagementRequest,
  unavailable: SupabaseUnavailableSurface[],
  surface: SupabaseUnavailableSurface["surface"],
  ref: string,
): Promise<Response | undefined> {
  try {
    return (await transport.getJson(request)) as Response;
  } catch {
    unavailable.push({
      surface,
      ref,
    });

    return undefined;
  }
}

function coerceProjectList(value: unknown): SupabaseProject[] {
  if (Array.isArray(value)) {
    return value as SupabaseProject[];
  }

  if (isRecord(value) && Array.isArray(value.projects)) {
    return value.projects as SupabaseProject[];
  }

  return [];
}

function readProjectRef(project: SupabaseProject): string | undefined {
  return readOptionalNonBlankString(project.id) ?? readOptionalNonBlankString(project.ref);
}

function readOptionalNonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isReadonlyStringArray(value: string | readonly string[]): value is readonly string[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
