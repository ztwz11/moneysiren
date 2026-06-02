import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeOpenAiUsageCosts, openAiAmountToMinorUnits, type OpenAiUsageCostsPayload } from "./normalize.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/providers/openai/usage-costs.json",
);

describe("normalizeOpenAiUsageCosts", () => {
  it("normalizes OpenAI usage and costs without persisting raw provider payloads", async () => {
    const payload = await loadFixture();
    const snapshots = normalizeOpenAiUsageCosts({
      payload,
      collectedAt: FIXED_NOW,
    });

    expect(snapshots).toEqual({
      usage: [
        {
          provider: "openai",
          collectedAt: FIXED_NOW,
          service: "completions:gpt-4.1-mini",
          metric: "input_tokens",
          unit: "tokens",
          value: 2000000,
        },
        {
          provider: "openai",
          collectedAt: FIXED_NOW,
          service: "completions:gpt-4.1-mini",
          metric: "output_tokens",
          unit: "tokens",
          value: 150000,
        },
        {
          provider: "openai",
          collectedAt: FIXED_NOW,
          service: "completions:gpt-4.1-mini",
          metric: "model_requests",
          unit: "requests",
          value: 420,
        },
        {
          provider: "openai",
          collectedAt: FIXED_NOW,
          service: "embeddings:text-embedding-3-small",
          metric: "input_tokens",
          unit: "tokens",
          value: 500000,
        },
        {
          provider: "openai",
          collectedAt: FIXED_NOW,
          service: "embeddings:text-embedding-3-small",
          metric: "model_requests",
          unit: "requests",
          value: 80,
        },
      ],
      billing: [
        {
          provider: "openai",
          collectedAt: FIXED_NOW,
          periodStart: "2026-06-01",
          periodEnd: "2026-06-02",
          amountMinor: 1300,
          currency: "USD",
          status: "estimated",
        },
      ],
      serviceHealth: [],
      costEstimates: [
        {
          provider: "openai",
          collectedAt: FIXED_NOW,
          periodStart: "2026-06-01",
          periodEnd: "2026-06-02",
          estimatedAmountMinor: 1300,
          currency: "USD",
          confidence: "medium",
        },
      ],
    });
    expect(JSON.stringify(snapshots)).not.toMatch(
      /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b/i,
    );
  });

  it("rounds OpenAI decimal amounts to minor units", () => {
    expect(openAiAmountToMinorUnits(12.345)).toBe(1235);
    expect(openAiAmountToMinorUnits("0.004")).toBe(0);
    expect(openAiAmountToMinorUnits("0.005")).toBe(1);
  });
});

async function loadFixture(): Promise<OpenAiUsageCostsPayload> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as OpenAiUsageCostsPayload;
}
