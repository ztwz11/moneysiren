import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createOpenAiUsageCostsClient,
  createOpenAiUsageCostsConnector,
  createStaticOpenAiUsageCostsClient,
  type OpenAiUsageCostsPayload,
  type OpenAiUsageCostsRequest,
  type OpenAiUsageCostsTransport,
} from "./index.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/providers/openai/usage-costs.json",
);

describe("createOpenAiUsageCostsConnector", () => {
  it("uses an injectable read-only OpenAI usage/costs client without network calls", async () => {
    const payload = await loadFixture();
    const requestedPeriods: Array<{ startTime: number; endTime: number }> = [];
    const connector = createOpenAiUsageCostsConnector({
      client: {
        async fetchUsageCosts(period) {
          requestedPeriods.push(period);
          return payload;
        },
      },
    });
    const result = await connector.collect({ now: () => new Date(FIXED_NOW) });

    expect(connector.kind).toBe("openai");
    expect(connector.access).toBe("read-only");
    expect(requestedPeriods).toEqual([
      {
        startTime: 1780272000,
        endTime: 1782864000,
      },
    ]);
    expect(result.status).toBe("ok");
    expect(result.snapshots.usage).toHaveLength(5);
    expect(result.snapshots.billing).toHaveLength(1);
    expect(result.snapshots.costEstimates).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(
      /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b/i,
    );
  });

  it("builds Usage and Costs Admin API requests through an injectable transport", async () => {
    const payload = await loadFixture();
    const requests: OpenAiUsageCostsRequest[] = [];
    const transport: OpenAiUsageCostsTransport = {
      async getJson(request) {
        requests.push(request);
        return request.path === "/v1/organization/costs" ? payload.costs : payload.usage;
      },
    };
    const client = createOpenAiUsageCostsClient({
      adminKey: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      transport,
    });

    await expect(client.fetchUsageCosts({ startTime: 1780272000, endTime: 1782864000 })).resolves.toEqual(payload);
    expect(requests).toEqual([
      {
        path: "/v1/organization/usage/completions",
        query: {
          start_time: "1780272000",
          end_time: "1782864000",
          bucket_width: "1d",
          group_by: ["model"],
        },
        headers: {
          Authorization: "Bearer FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
        },
      },
      {
        path: "/v1/organization/costs",
        query: {
          start_time: "1780272000",
          end_time: "1782864000",
          bucket_width: "1d",
          group_by: ["line_item"],
        },
        headers: {
          Authorization: "Bearer FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
        },
      },
    ]);
  });

  it("supports fixture mode through a static client", async () => {
    const payload = await loadFixture();
    const connector = createOpenAiUsageCostsConnector({
      client: createStaticOpenAiUsageCostsClient(payload),
    });
    const result = await connector.collect({ now: () => new Date(FIXED_NOW) });

    expect(result.status).toBe("ok");
    expect(result.snapshots.billing[0]?.amountMinor).toBe(1300);
    expect(result.alerts).toEqual([]);
  });
});

async function loadFixture(): Promise<OpenAiUsageCostsPayload> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as OpenAiUsageCostsPayload;
}
