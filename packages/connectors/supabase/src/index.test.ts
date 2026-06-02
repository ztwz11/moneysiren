import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createStaticSupabaseUsageHealthClient,
  createSupabaseManagementClient,
  createSupabaseUsageHealthConnector,
  type SupabaseManagementRequest,
  type SupabaseManagementTransport,
  type SupabaseUsageHealthPayload,
} from "./index.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/providers/supabase/usage-health.json",
);
const FORBIDDEN_PROVIDER_DATA_PATTERN =
  /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b|fake-supabase-ref|fake-supabase-org|sbp_/i;

describe("createSupabaseUsageHealthConnector", () => {
  it("uses an injectable read-only Supabase client without network calls", async () => {
    const payload = await loadFixture();
    const connector = createSupabaseUsageHealthConnector({
      client: createStaticSupabaseUsageHealthClient(payload),
    });
    const result = await connector.collect({ now: () => new Date(FIXED_NOW) });

    expect(connector.kind).toBe("supabase");
    expect(connector.access).toBe("read-only");
    expect(result.status).toBe("partial");
    expect(result.snapshots.usage).toHaveLength(8);
    expect(result.snapshots.billing).toHaveLength(0);
    expect(result.snapshots.serviceHealth).toHaveLength(5);
    expect(result.snapshots.costEstimates).toHaveLength(0);
    expect(result.alerts).toEqual([
      {
        provider: "supabase",
        createdAt: FIXED_NOW,
        severity: "warning",
        category: "provider-sync",
        title: "Supabase health surface unavailable",
        message: "Supabase health request failed before normalized snapshots were collected.",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(FORBIDDEN_PROVIDER_DATA_PATTERN);
  });

  it("builds read-only Supabase Management API requests through an injectable transport", async () => {
    const requests: SupabaseManagementRequest[] = [];
    const transport: SupabaseManagementTransport = {
      async getJson(request) {
        requests.push(request);

        if (request.path === "/v1/projects") {
          return [
            {
              id: "fake-supabase-ref-alpha",
              name: "FAKE StackSpend Alpha",
              region: "ap-northeast-2",
              status: "ACTIVE",
            },
          ];
        }

        if (request.path.endsWith("/analytics/endpoints/usage.api-counts")) {
          return {
            result: [
              {
                total_rest_requests: 7,
              },
            ],
          };
        }

        if (request.path.endsWith("/analytics/endpoints/usage.api-requests-count")) {
          return {
            result: [
              {
                count: 7,
              },
            ],
          };
        }

        if (request.path.endsWith("/health")) {
          return {
            services: [
              {
                name: "db",
                status: "HEALTHY",
              },
            ],
          };
        }

        throw new Error(`Unexpected request path: ${request.path}`);
      },
    };
    const client = createSupabaseManagementClient({
      accessToken: "FAKE_SUPABASE_ACCESS_TOKEN_FOR_TESTS",
      transport,
    });
    const payload = await client.fetchUsageHealth();

    expect(payload.projects).toHaveLength(1);
    expect(payload.usage).toHaveLength(1);
    expect(payload.health).toHaveLength(1);
    expect(payload.unavailable).toEqual([]);
    expect(requests).toEqual([
      {
        path: "/v1/projects",
        query: {},
        headers: {
          Authorization: "Bearer FAKE_SUPABASE_ACCESS_TOKEN_FOR_TESTS",
        },
      },
      {
        path: "/v1/projects/fake-supabase-ref-alpha/analytics/endpoints/usage.api-counts",
        query: {},
        headers: {
          Authorization: "Bearer FAKE_SUPABASE_ACCESS_TOKEN_FOR_TESTS",
        },
      },
      {
        path: "/v1/projects/fake-supabase-ref-alpha/analytics/endpoints/usage.api-requests-count",
        query: {},
        headers: {
          Authorization: "Bearer FAKE_SUPABASE_ACCESS_TOKEN_FOR_TESTS",
        },
      },
      {
        path: "/v1/projects/fake-supabase-ref-alpha/health",
        query: {},
        headers: {
          Authorization: "Bearer FAKE_SUPABASE_ACCESS_TOKEN_FOR_TESTS",
        },
      },
    ]);
  });

  it("returns a sanitized alert when Supabase collection fails before normalization", async () => {
    const connector = createSupabaseUsageHealthConnector({
      client: {
        async fetchUsageHealth() {
          throw new Error("FAKE_SUPABASE_ACCESS_TOKEN_FOR_TESTS rejected");
        },
      },
    });
    const result = await connector.collect({ now: () => new Date(FIXED_NOW) });

    expect(result.status).toBe("error");
    expect(result.snapshots.usage).toEqual([]);
    expect(result.alerts).toEqual([
      {
        provider: "supabase",
        createdAt: FIXED_NOW,
        severity: "warning",
        category: "provider-sync",
        title: "Supabase usage/health sync failed",
        message: "Supabase usage/health request failed before normalized snapshots were collected.",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(FORBIDDEN_PROVIDER_DATA_PATTERN);
  });
});

async function loadFixture(): Promise<SupabaseUsageHealthPayload> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as SupabaseUsageHealthPayload;
}
