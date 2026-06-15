import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeCostExplorerResponse, type AwsCostExplorerGetCostAndUsageOutput } from "./normalize.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json",
);

describe("normalizeCostExplorerResponse", () => {
  it("normalizes Cost Explorer totals and service-level grouping without raw AWS payloads", async () => {
    const response = await loadFixture();
    const snapshots = normalizeCostExplorerResponse({
      response,
      collectedAt: FIXED_NOW,
    });

    expect(snapshots).toEqual({
      usage: [
        {
          provider: "aws",
          collectedAt: FIXED_NOW,
          service: "Amazon Elastic Compute Cloud - Compute",
          metric: "unblended_cost",
          unit: "USD",
          value: 7.12,
        },
        {
          provider: "aws",
          collectedAt: FIXED_NOW,
          service: "Amazon Simple Storage Service",
          metric: "unblended_cost",
          unit: "USD",
          value: 3.34,
        },
        {
          provider: "aws",
          collectedAt: FIXED_NOW,
          service: "AWS Lambda",
          metric: "unblended_cost",
          unit: "USD",
          value: 1,
        },
        {
          provider: "aws",
          collectedAt: FIXED_NOW,
          service: "Amazon CloudWatch",
          metric: "unblended_cost",
          unit: "USD",
          value: 0.88,
        },
      ],
      billing: [
        {
          provider: "aws",
          collectedAt: FIXED_NOW,
          periodStart: "2026-06-01",
          periodEnd: "2026-07-01",
          amountMinor: 1234,
          currency: "USD",
          status: "estimated",
        },
      ],
      serviceHealth: [],
      costEstimates: [
        {
          provider: "aws",
          collectedAt: FIXED_NOW,
          periodStart: "2026-06-01",
          periodEnd: "2026-07-01",
          estimatedAmountMinor: 1234,
          currency: "USD",
          confidence: "medium",
        },
      ],
    });
    expect(JSON.stringify(snapshots)).not.toMatch(
      /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b/i,
    );
  });

  it("infers the period total from grouped service costs when Cost Explorer omits Total", async () => {
    const response = await loadFixture();
    const resultsByTime = response.ResultsByTime ?? [];
    const snapshots = normalizeCostExplorerResponse({
      response: {
        ResultsByTime: resultsByTime.map((result) => ({
          ...(result.TimePeriod === undefined ? {} : { TimePeriod: result.TimePeriod }),
          ...(result.Estimated === undefined ? {} : { Estimated: result.Estimated }),
          ...(result.Groups === undefined ? {} : { Groups: result.Groups }),
        })),
      },
      collectedAt: FIXED_NOW,
    });

    expect(snapshots.usage).toHaveLength(4);
    expect(snapshots.billing).toEqual([
      {
        provider: "aws",
        collectedAt: FIXED_NOW,
        periodStart: "2026-06-01",
        periodEnd: "2026-07-01",
        amountMinor: 1234,
        currency: "USD",
        status: "estimated",
      },
    ]);
    expect(snapshots.costEstimates[0]?.estimatedAmountMinor).toBe(1234);
  });

  it("rounds AWS decimal currency amounts to minor units", () => {
    const snapshots = normalizeCostExplorerResponse({
      collectedAt: FIXED_NOW,
      response: {
        ResultsByTime: [
          {
            TimePeriod: {
              Start: "2026-06-01",
              End: "2026-07-01",
            },
            Estimated: false,
            Total: {
              UnblendedCost: {
                Amount: "12.345",
                Unit: "USD",
              },
            },
            Groups: [],
          },
        ],
      },
    });

    expect(snapshots.billing[0]?.amountMinor).toBe(1235);
    expect(snapshots.costEstimates[0]?.estimatedAmountMinor).toBe(1235);
    expect(snapshots.costEstimates[0]?.confidence).toBe("high");
  });
});

async function loadFixture(): Promise<AwsCostExplorerGetCostAndUsageOutput> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as AwsCostExplorerGetCostAndUsageOutput;
}
