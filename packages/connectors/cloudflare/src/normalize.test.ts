import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cloudflareAmountToMinorUnits,
  normalizeCloudflareBillingUsage,
  redactedCloudflareAccountId,
  type CloudflareBillingUsagePayload,
} from "./normalize.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/providers/cloudflare/billing-usage.json",
);
const FORBIDDEN_NORMALIZED_PROVIDER_DATA_PATTERN =
  /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b|FAKE_CLOUDFLARE|fake-zone\.invalid|card_|payment_/i;

describe("normalizeCloudflareBillingUsage", () => {
  it("normalizes billable usage, billing totals, health, and restricted API fallbacks without identifiers", async () => {
    const payload = await loadFixture();
    const alphaRef = redactedCloudflareAccountId("FAKE_CLOUDFLARE_ACCOUNT_ALPHA");
    const restrictedRef = redactedCloudflareAccountId("FAKE_CLOUDFLARE_ACCOUNT_RESTRICTED");
    const snapshots = normalizeCloudflareBillingUsage({
      payload,
      collectedAt: FIXED_NOW,
    });

    expect(snapshots).toEqual({
      usage: [
        {
          provider: "cloudflare",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          service: `R2:${alphaRef}`,
          metric: "billable_quantity",
          unit: "GB",
          value: 128.5,
        },
        {
          provider: "cloudflare",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          service: `Workers:${alphaRef}`,
          metric: "billable_quantity",
          unit: "requests",
          value: 2500,
        },
      ],
      billing: [
        {
          provider: "cloudflare",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          periodStart: "2026-06-01",
          periodEnd: "2026-06-02",
          amountMinor: 1236,
          currency: "USD",
          status: "estimated",
        },
      ],
      serviceHealth: [
        {
          provider: "cloudflare",
          collectedAt: FIXED_NOW,
          service: `billing_usage_api:${alphaRef}`,
          status: "ok",
          message: "Cloudflare billing usage API available.",
        },
        {
          provider: "cloudflare",
          collectedAt: FIXED_NOW,
          service: `billable_usage_api:${restrictedRef}`,
          status: "degraded",
          message: "Cloudflare billing usage API unavailable for this account.",
        },
      ],
      costEstimates: [
        {
          provider: "cloudflare",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          periodStart: "2026-06-01",
          periodEnd: "2026-06-02",
          estimatedAmountMinor: 1236,
          currency: "USD",
          confidence: "low",
        },
      ],
    });
    expect(JSON.stringify(snapshots)).not.toMatch(FORBIDDEN_NORMALIZED_PROVIDER_DATA_PATTERN);
  });

  it("falls back to PayGo usage records when billable usage is unavailable", () => {
    const accountRef = redactedCloudflareAccountId("FAKE_CLOUDFLARE_ACCOUNT_PAYGO_ONLY");
    const snapshots = normalizeCloudflareBillingUsage({
      collectedAt: FIXED_NOW,
      payload: {
        paygoUsage: [
          {
            BillingAccountId: "FAKE_CLOUDFLARE_ACCOUNT_PAYGO_ONLY",
            BillingCurrency: "USD",
            ChargePeriodStart: "2026-06-01T00:00:00Z",
            ChargePeriodEnd: "2026-06-02T00:00:00Z",
            ContractedCost: 0.029,
            ConsumedQuantity: 42,
            ConsumedUnit: "GB-seconds",
            ServiceName: "Workers KV",
          },
        ],
      },
    });

    expect(snapshots.usage).toEqual([
      {
        provider: "cloudflare",
        collectedAt: FIXED_NOW,
        providerAccountRef: accountRef,
        service: `Workers KV:${accountRef}`,
        metric: "billable_quantity",
        unit: "GB-seconds",
        value: 42,
      },
    ]);
    expect(snapshots.billing).toEqual([
      {
        provider: "cloudflare",
        collectedAt: FIXED_NOW,
        providerAccountRef: accountRef,
        periodStart: "2026-06-01",
        periodEnd: "2026-06-02",
        amountMinor: 3,
        currency: "USD",
        status: "estimated",
      },
    ]);
  });
});

describe("cloudflareAmountToMinorUnits", () => {
  it("rounds decimal currency amounts to minor units", () => {
    expect(cloudflareAmountToMinorUnits("12.345")).toBe(1235);
    expect(cloudflareAmountToMinorUnits(0.01)).toBe(1);
    expect(cloudflareAmountToMinorUnits("-0.015")).toBe(-2);
  });
});

async function loadFixture(): Promise<CloudflareBillingUsagePayload> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as CloudflareBillingUsagePayload;
}
