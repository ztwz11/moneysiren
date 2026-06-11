import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createCloudflareBillingUsageClient,
  createCloudflareBillingUsageConnector,
  createStaticCloudflareBillingUsageClient,
  type CloudflareBillingUsagePayload,
  type CloudflareApiRequest,
  type CloudflareApiTransport,
} from "./index.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/providers/cloudflare/billing-usage.json",
);
const FORBIDDEN_PROVIDER_DATA_PATTERN =
  /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b|FAKE_CLOUDFLARE|fake-zone\.invalid|card_|payment_/i;

describe("createCloudflareBillingUsageConnector", () => {
  it("uses an injectable Cloudflare client and reports restricted billing APIs as partial alerts", async () => {
    const connector = createCloudflareBillingUsageConnector({
      client: createStaticCloudflareBillingUsageClient(await loadFixture()),
    });
    const result = await connector.collect({ now: () => new Date(FIXED_NOW) });

    expect(connector.kind).toBe("cloudflare");
    expect(connector.displayName).toBe("Cloudflare Billing/Usage Experimental");
    expect(connector.access).toBe("read-only");
    expect(result.status).toBe("partial");
    expect(result.snapshots.usage).toHaveLength(2);
    expect(result.snapshots.billing).toHaveLength(1);
    expect(result.snapshots.serviceHealth).toHaveLength(2);
    expect(result.snapshots.costEstimates).toHaveLength(1);
    expect(result.alerts).toEqual([
      {
        provider: "cloudflare",
        createdAt: FIXED_NOW,
        severity: "warning",
        category: "provider-sync",
        title: "Cloudflare billable usage surface unavailable",
        message: "Cloudflare billable usage API was restricted or unavailable; normalized sync continued with available data.",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(FORBIDDEN_PROVIDER_DATA_PATTERN);
  });

  it("builds read-only Cloudflare API requests through an injectable transport", async () => {
    const requests: CloudflareApiRequest[] = [];
    const transport: CloudflareApiTransport = {
      async getJson(request) {
        requests.push(request);

        if (request.path.endsWith("/billable/usage")) {
          throw new Error("FAKE restricted fixture error");
        }

        if (request.path.endsWith("/paygo-usage")) {
          return [
            {
              BillingAccountId: "FAKE_CLOUDFLARE_ACCOUNT_ALPHA",
              BillingCurrency: "USD",
              ChargePeriodStart: "2026-06-01T00:00:00Z",
              ChargePeriodEnd: "2026-06-02T00:00:00Z",
              ContractedCost: "0.02",
              ConsumedQuantity: "12",
              ConsumedUnit: "GB-seconds",
              ServiceName: "Workers KV",
            },
          ];
        }

        throw new Error(`Unexpected request path: ${request.path}`);
      },
    };
    const client = createCloudflareBillingUsageClient({
      apiToken: "FAKE_CLOUDFLARE_API_TOKEN_FOR_TESTS",
      accountIds: ["FAKE_CLOUDFLARE_ACCOUNT_ALPHA"],
      transport,
    });
    const payload = await client.fetchBillingUsage();

    expect(payload.billableUsage).toEqual([]);
    expect(payload.paygoUsage).toHaveLength(1);
    expect(payload.unavailable).toEqual([
      {
        surface: "billable-usage",
        accountId: "FAKE_CLOUDFLARE_ACCOUNT_ALPHA",
        reason: "restricted-or-unavailable",
      },
    ]);
    expect(requests).toEqual([
      {
        path: "/accounts/FAKE_CLOUDFLARE_ACCOUNT_ALPHA/billable/usage",
        query: {},
        headers: {
          Authorization: "Bearer FAKE_CLOUDFLARE_API_TOKEN_FOR_TESTS",
        },
      },
      {
        path: "/accounts/FAKE_CLOUDFLARE_ACCOUNT_ALPHA/paygo-usage",
        query: {},
        headers: {
          Authorization: "Bearer FAKE_CLOUDFLARE_API_TOKEN_FOR_TESTS",
        },
      },
    ]);
  });

  it("falls back to PayGo when billable usage returns an empty record set", async () => {
    const requests: CloudflareApiRequest[] = [];
    const transport: CloudflareApiTransport = {
      async getJson(request) {
        requests.push(request);

        if (request.path.endsWith("/billable/usage")) {
          return {
            result: [],
          };
        }

        if (request.path.endsWith("/paygo-usage")) {
          return [
            {
              BillingAccountId: "FAKE_CLOUDFLARE_ACCOUNT_EMPTY_BILLABLE",
              BillingCurrency: "USD",
              ChargePeriodStart: "2026-06-01T00:00:00Z",
              ChargePeriodEnd: "2026-06-02T00:00:00Z",
              ContractedCost: "0.03",
              ConsumedQuantity: "42",
              ConsumedUnit: "GB-seconds",
              ServiceName: "Workers KV",
            },
          ];
        }

        throw new Error(`Unexpected request path: ${request.path}`);
      },
    };
    const client = createCloudflareBillingUsageClient({
      apiToken: "FAKE_CLOUDFLARE_API_TOKEN_FOR_TESTS",
      accountIds: ["FAKE_CLOUDFLARE_ACCOUNT_EMPTY_BILLABLE"],
      transport,
    });
    const payload = await client.fetchBillingUsage();

    expect(payload.billableUsage).toEqual([]);
    expect(payload.paygoUsage).toHaveLength(1);
    expect(payload.unavailable).toEqual([]);
    expect(requests).toEqual([
      {
        path: "/accounts/FAKE_CLOUDFLARE_ACCOUNT_EMPTY_BILLABLE/billable/usage",
        query: {},
        headers: {
          Authorization: "Bearer FAKE_CLOUDFLARE_API_TOKEN_FOR_TESTS",
        },
      },
      {
        path: "/accounts/FAKE_CLOUDFLARE_ACCOUNT_EMPTY_BILLABLE/paygo-usage",
        query: {},
        headers: {
          Authorization: "Bearer FAKE_CLOUDFLARE_API_TOKEN_FOR_TESTS",
        },
      },
    ]);
  });

  it("returns a sanitized alert when Cloudflare collection fails before normalization", async () => {
    const connector = createCloudflareBillingUsageConnector({
      client: {
        async fetchBillingUsage() {
          throw new Error("FAKE_CLOUDFLARE_API_TOKEN_FOR_TESTS rejected");
        },
      },
    });
    const result = await connector.collect({ now: () => new Date(FIXED_NOW) });

    expect(result.status).toBe("error");
    expect(result.snapshots.usage).toEqual([]);
    expect(result.alerts).toEqual([
      {
        provider: "cloudflare",
        createdAt: FIXED_NOW,
        severity: "warning",
        category: "provider-sync",
        title: "Cloudflare billing/usage sync failed",
        message: "Cloudflare billing/usage request failed before normalized snapshots were collected.",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(FORBIDDEN_PROVIDER_DATA_PATTERN);
  });
});

async function loadFixture(): Promise<CloudflareBillingUsagePayload> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as CloudflareBillingUsagePayload;
}
