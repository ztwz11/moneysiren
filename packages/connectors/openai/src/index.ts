import {
  normalizeOpenAiUsageCosts,
  type OpenAiCostsPage,
  type OpenAiNormalizedSnapshotBundle,
  type OpenAiUsageCostsPayload,
  type OpenAiUsagePage,
} from "./normalize.js";

export {
  normalizeOpenAiUsageCosts,
  openAiAmountToMinorUnits,
  type OpenAiBillingSnapshot,
  type OpenAiCostAmount,
  type OpenAiCostEstimate,
  type OpenAiCostsBucket,
  type OpenAiCostsPage,
  type OpenAiCostsResult,
  type OpenAiNormalizedSnapshotBundle,
  type OpenAiServiceHealthSnapshot,
  type OpenAiUsageBucket,
  type OpenAiUsageCostsPayload,
  type OpenAiUsagePage,
  type OpenAiUsageResult,
  type OpenAiUsageSnapshot,
} from "./normalize.js";

export interface OpenAiUsageCostsPeriod {
  startTime: number;
  endTime: number;
}

export interface OpenAiUsageCostsClient {
  fetchUsageCosts(period: OpenAiUsageCostsPeriod): Promise<OpenAiUsageCostsPayload>;
}

export interface OpenAiUsageCostsRequest {
  path: "/v1/organization/usage/completions" | "/v1/organization/costs";
  query: Record<string, string | readonly string[]>;
  headers: {
    Authorization: string;
  };
}

export interface OpenAiUsageCostsTransport {
  getJson(request: OpenAiUsageCostsRequest): Promise<unknown>;
}

export interface CreateOpenAiUsageCostsClientOptions {
  adminKey: string;
  transport?: OpenAiUsageCostsTransport;
}

export interface OpenAiProviderCollectionContext {
  now(): Date;
}

export interface OpenAiProviderConnector {
  kind: "openai";
  displayName: "OpenAI Usage/Costs";
  access: "read-only";
  collect(context: OpenAiProviderCollectionContext): Promise<OpenAiProviderCollectionResult>;
}

export interface OpenAiProviderCollectionResult {
  collectedAt: string;
  status: "ok" | "error";
  snapshots: OpenAiNormalizedSnapshotBundle;
  alerts: readonly OpenAiProviderAlert[];
  errors?: readonly string[];
}

export interface OpenAiProviderAlert {
  provider: "openai";
  createdAt: string;
  severity: "warning";
  category: "provider-sync";
  title: "OpenAI Usage/Costs sync failed";
  message: "OpenAI Usage/Costs request failed before normalized snapshots were collected.";
}

export interface OpenAiUsageCostsConnectorOptions {
  client: OpenAiUsageCostsClient;
}

const OPENAI_API_BASE_URL = "https://api.openai.com";
type OpenAiPaginatedPage = OpenAiCostsPage | OpenAiUsagePage;

const EMPTY_OPENAI_SNAPSHOTS: OpenAiNormalizedSnapshotBundle = {
  usage: [],
  billing: [],
  serviceHealth: [],
  costEstimates: [],
};

const defaultOpenAiUsageCostsTransport: OpenAiUsageCostsTransport = {
  async getJson(request) {
    const url = new URL(request.path, OPENAI_API_BASE_URL);

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
      throw new Error(`OpenAI Usage/Costs request failed with status ${response.status}.`);
    }

    return response.json();
  },
};

export function createOpenAiUsageCostsClient(
  options: CreateOpenAiUsageCostsClientOptions,
): OpenAiUsageCostsClient {
  const adminKey = options.adminKey.trim();

  if (adminKey.length === 0) {
    throw new Error("OPENAI_ADMIN_KEY must not be blank.");
  }

  const transport = options.transport ?? defaultOpenAiUsageCostsTransport;

  return {
    async fetchUsageCosts(period) {
      const headers = {
        Authorization: `Bearer ${adminKey}`,
      };

      const usage = await fetchOpenAiPaginatedPage<OpenAiUsagePage>(transport, {
        path: "/v1/organization/usage/completions",
        query: {
          start_time: String(period.startTime),
          end_time: String(period.endTime),
          bucket_width: "1d",
          group_by: ["model"],
        },
        headers,
      });
      const costs = await fetchOpenAiPaginatedPage<OpenAiCostsPage>(transport, {
        path: "/v1/organization/costs",
        query: {
          start_time: String(period.startTime),
          end_time: String(period.endTime),
          bucket_width: "1d",
          group_by: ["line_item"],
        },
        headers,
      });

      return {
        usage: usage as OpenAiUsageCostsPayload["usage"],
        costs: costs as OpenAiUsageCostsPayload["costs"],
      };
    },
  };
}

async function fetchOpenAiPaginatedPage<Page extends OpenAiPaginatedPage>(
  transport: OpenAiUsageCostsTransport,
  request: OpenAiUsageCostsRequest,
): Promise<Page> {
  const data: unknown[] = [];
  const seenPageTokens = new Set<string>();
  let currentRequest = request;
  let lastPage: Page | undefined;

  while (true) {
    const page = await transport.getJson(currentRequest) as Page;

    data.push(...(page.data ?? []));
    lastPage = page;

    if (page.has_more !== true) {
      break;
    }

    const nextPage = requireOpenAiNextPageToken(page.next_page, request.path);

    if (seenPageTokens.has(nextPage)) {
      throw new Error(`OpenAI Usage/Costs ${request.path} pagination returned a repeated next_page token.`);
    }

    seenPageTokens.add(nextPage);
    currentRequest = {
      ...request,
      query: {
        ...request.query,
        page: nextPage,
      },
    };
  }

  if (lastPage === undefined) {
    throw new Error(`OpenAI Usage/Costs ${request.path} pagination did not return a page.`);
  }

  return {
    ...lastPage,
    data,
  } as Page;
}

function requireOpenAiNextPageToken(value: string | null | undefined, path: OpenAiUsageCostsRequest["path"]): string {
  const nextPage = value?.trim();

  if (nextPage === undefined || nextPage.length === 0) {
    throw new Error(`OpenAI Usage/Costs ${path} response has has_more=true without next_page.`);
  }

  return nextPage;
}

export function createStaticOpenAiUsageCostsClient(
  payload: OpenAiUsageCostsPayload,
): OpenAiUsageCostsClient {
  return {
    async fetchUsageCosts() {
      return payload;
    },
  };
}

export function createOpenAiUsageCostsConnector(
  options: OpenAiUsageCostsConnectorOptions,
): OpenAiProviderConnector {
  return {
    kind: "openai",
    displayName: "OpenAI Usage/Costs",
    access: "read-only",
    async collect(context) {
      const collectedAt = context.now().toISOString();
      const period = createCurrentOpenAiUsageCostsPeriod(context.now());

      try {
        const payload = await options.client.fetchUsageCosts(period);

        return {
          collectedAt,
          status: "ok",
          snapshots: normalizeOpenAiUsageCosts({
            payload,
            collectedAt,
          }),
          alerts: [],
        };
      } catch {
        return {
          collectedAt,
          status: "error",
          snapshots: EMPTY_OPENAI_SNAPSHOTS,
          alerts: [
            {
              provider: "openai",
              createdAt: collectedAt,
              severity: "warning",
              category: "provider-sync",
              title: "OpenAI Usage/Costs sync failed",
              message: "OpenAI Usage/Costs request failed before normalized snapshots were collected.",
            },
          ],
          errors: ["OpenAI Usage/Costs request failed."],
        };
      }
    },
  };
}

export function createCurrentOpenAiUsageCostsPeriod(now: Date): OpenAiUsageCostsPeriod {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000;

  return {
    startTime: start,
    endTime: end,
  };
}

function isReadonlyStringArray(value: string | readonly string[]): value is readonly string[] {
  return Array.isArray(value);
}
