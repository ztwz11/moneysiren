import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  normalizeSupabaseUsageHealth,
  redactedSupabaseProjectRef,
  type SupabaseUsageHealthPayload,
} from "./normalize.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/providers/supabase/usage-health.json",
);
const FORBIDDEN_NORMALIZED_PROVIDER_DATA_PATTERN =
  /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b|fake-supabase-ref|fake-supabase-org/i;

describe("normalizeSupabaseUsageHealth", () => {
  it("normalizes Supabase usage and health while redacting project identifiers", async () => {
    const payload = await loadFixture();
    const alphaRef = redactedSupabaseProjectRef("fake-supabase-ref-alpha");
    const betaRef = redactedSupabaseProjectRef("fake-supabase-ref-beta");
    const snapshots = normalizeSupabaseUsageHealth({
      payload,
      collectedAt: FIXED_NOW,
    });

    expect(snapshots).toEqual({
      usage: [
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          service: `api:${alphaRef}`,
          metric: "api_requests",
          unit: "requests",
          value: 5082,
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          service: `auth:${alphaRef}`,
          metric: "auth_requests",
          unit: "requests",
          value: 1200,
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          service: `realtime:${alphaRef}`,
          metric: "realtime_requests",
          unit: "requests",
          value: 32,
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          service: `rest:${alphaRef}`,
          metric: "rest_requests",
          unit: "requests",
          value: 3400,
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          providerAccountRef: alphaRef,
          service: `storage:${alphaRef}`,
          metric: "storage_requests",
          unit: "requests",
          value: 450,
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          providerAccountRef: betaRef,
          service: `api:${betaRef}`,
          metric: "api_requests",
          unit: "requests",
          value: 11,
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          providerAccountRef: betaRef,
          service: `rest:${betaRef}`,
          metric: "rest_requests",
          unit: "requests",
          value: 10,
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          providerAccountRef: betaRef,
          service: `storage:${betaRef}`,
          metric: "storage_requests",
          unit: "requests",
          value: 1,
        },
      ],
      billing: [],
      serviceHealth: [
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          service: `project:${alphaRef}`,
          region: "ap-northeast-2",
          status: "ok",
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          service: `project:${betaRef}`,
          region: "us-east-1",
          status: "degraded",
          message: "Project is paused.",
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          service: `db:${alphaRef}`,
          region: "ap-northeast-2",
          status: "ok",
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          service: `auth:${alphaRef}`,
          region: "ap-northeast-2",
          status: "degraded",
          message: "FAKE degraded fixture message",
        },
        {
          provider: "supabase",
          collectedAt: FIXED_NOW,
          service: `storage:${alphaRef}`,
          region: "ap-northeast-2",
          status: "ok",
        },
      ],
      costEstimates: [],
    });
    expect(JSON.stringify(snapshots)).not.toMatch(FORBIDDEN_NORMALIZED_PROVIDER_DATA_PATTERN);
  });
});

async function loadFixture(): Promise<SupabaseUsageHealthPayload> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as SupabaseUsageHealthPayload;
}
