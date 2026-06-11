import type {
  CloudflareBillableUsageRecord,
  CloudflareBillingUsagePayload,
  CloudflarePaygoUsageRecord,
  CloudflareUnavailableSurface,
} from "./normalize.js";

export interface CloudflareBillingUsageClient {
  fetchBillingUsage(): Promise<CloudflareBillingUsagePayload>;
}

export type CloudflareApiPath =
  | `/accounts/${string}/billable/usage`
  | `/accounts/${string}/paygo-usage`;

export interface CloudflareApiRequest {
  path: CloudflareApiPath;
  query: Record<string, string | readonly string[]>;
  headers: {
    Authorization: string;
  };
}

export interface CloudflareApiTransport {
  getJson(request: CloudflareApiRequest): Promise<unknown>;
}

export interface CreateCloudflareBillingUsageClientOptions {
  apiToken: string;
  accountIds: readonly string[];
  transport?: CloudflareApiTransport;
}

const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";

const defaultCloudflareApiTransport: CloudflareApiTransport = {
  async getJson(request) {
    const url = new URL(request.path, CLOUDFLARE_API_BASE_URL);

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
      throw new Error(`Cloudflare API request failed with status ${response.status}.`);
    }

    return response.json();
  },
};

export function createCloudflareBillingUsageClient(
  options: CreateCloudflareBillingUsageClientOptions,
): CloudflareBillingUsageClient {
  const apiToken = options.apiToken.trim();

  if (apiToken.length === 0) {
    throw new Error("CLOUDFLARE_API_TOKEN must not be blank.");
  }

  const accountIds = [...new Set(options.accountIds.map((accountId) => accountId.trim()).filter(Boolean))];

  if (accountIds.length === 0) {
    throw new Error("Cloudflare account IDs must not be empty.");
  }

  const transport = options.transport ?? defaultCloudflareApiTransport;

  return {
    async fetchBillingUsage() {
      const headers = {
        Authorization: `Bearer ${apiToken}`,
      };
      const billableUsage: CloudflareBillableUsageRecord[] = [];
      const paygoUsage: CloudflarePaygoUsageRecord[] = [];
      const unavailable: CloudflareUnavailableSurface[] = [];

      for (const accountId of accountIds) {
        const encodedAccountId = encodeURIComponent(accountId);
        const billableRecords = await tryFetchSurface<CloudflareBillableUsageRecord>(
          transport,
          {
            path: `/accounts/${encodedAccountId}/billable/usage`,
            query: {},
            headers,
          },
          unavailable,
          "billable-usage",
          accountId,
        );

        if (billableRecords !== undefined) {
          billableUsage.push(...billableRecords);

          if (billableRecords.length > 0) {
            continue;
          }
        }

        const paygoRecords = await tryFetchSurface<CloudflarePaygoUsageRecord>(
          transport,
          {
            path: `/accounts/${encodedAccountId}/paygo-usage`,
            query: {},
            headers,
          },
          unavailable,
          "paygo-usage",
          accountId,
        );

        if (paygoRecords !== undefined) {
          paygoUsage.push(...paygoRecords);
        }
      }

      return {
        billableUsage,
        paygoUsage,
        unavailable,
      };
    },
  };
}

export function createStaticCloudflareBillingUsageClient(
  payload: CloudflareBillingUsagePayload,
): CloudflareBillingUsageClient {
  return {
    async fetchBillingUsage() {
      return payload;
    },
  };
}

async function tryFetchSurface<RecordType>(
  transport: CloudflareApiTransport,
  request: CloudflareApiRequest,
  unavailable: CloudflareUnavailableSurface[],
  surface: CloudflareUnavailableSurface["surface"],
  accountId: string,
): Promise<RecordType[] | undefined> {
  try {
    return coerceCloudflareResultList<RecordType>(await transport.getJson(request));
  } catch {
    unavailable.push({
      surface,
      accountId,
      reason: "restricted-or-unavailable",
    });

    return undefined;
  }
}

function coerceCloudflareResultList<RecordType>(value: unknown): RecordType[] {
  if (Array.isArray(value)) {
    return value as RecordType[];
  }

  if (isRecord(value) && Array.isArray(value.result)) {
    return value.result as RecordType[];
  }

  return [];
}

function isReadonlyStringArray(value: string | readonly string[]): value is readonly string[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
