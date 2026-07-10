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
          metric: "cached_input_tokens",
          unit: "tokens",
          value: 400000,
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

  it("keeps GPT-5.6 model IDs and cached input tokens separate across a paginated page", () => {
    const payload: OpenAiUsageCostsPayload = {
      usage: {
        data: [{
          results: [
            {
              object: "organization.usage.completions.result",
              model: "gpt-5.6-sol",
              input_tokens: 100,
              output_tokens: 20,
              num_model_requests: 1,
            },
            {
              object: "organization.usage.completions.result",
              model: "gpt-5.6-terra",
              input_tokens: 70,
              input_cached_tokens: 0,
              output_tokens: 3,
              num_model_requests: 1,
            },
            {
              object: "organization.usage.completions.result",
              model: "gpt-5.6-luna",
              input_tokens: 50,
              input_cached_tokens: 11,
              output_tokens: 2,
              num_model_requests: 1,
            },
          ],
        }],
        has_more: true,
        next_page: "FAKE_OPENAI_USAGE_PAGE_2",
      },
      costs: {
        data: [],
        has_more: false,
        next_page: null,
      },
    };

    const snapshots = normalizeOpenAiUsageCosts({ payload, collectedAt: FIXED_NOW });
    const cached = snapshots.usage.filter((snapshot) => snapshot.metric === "cached_input_tokens");

    expect(cached).toEqual([
      expect.objectContaining({ service: "completions:gpt-5.6-terra", value: 0 }),
      expect.objectContaining({ service: "completions:gpt-5.6-luna", value: 11 }),
    ]);
    expect(snapshots.usage.filter((snapshot) => snapshot.metric === "input_tokens").map((snapshot) => snapshot.value))
      .toEqual([100, 70, 50]);
    expect(snapshots.billing).toEqual([]);
    expect(snapshots.costEstimates).toEqual([]);
    expect(JSON.stringify(snapshots)).not.toContain("FAKE_OPENAI_USAGE_PAGE_2");
  });

  it("rejects malformed cached input token values", () => {
    const payload: OpenAiUsageCostsPayload = {
      usage: {
        data: [{
          results: [{
            model: "gpt-5.6-sol",
            input_cached_tokens: Number.NaN,
          }],
        }],
      },
      costs: { data: [] },
    };

    expect(() => normalizeOpenAiUsageCosts({ payload, collectedAt: FIXED_NOW }))
      .toThrow("completions:gpt-5.6-sol input_cached_tokens must be a finite number.");
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
