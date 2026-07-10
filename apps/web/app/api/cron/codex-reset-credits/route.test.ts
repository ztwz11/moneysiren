import { describe, expect, it } from "vitest";
import type { ResetCreditStatus } from "../../../../lib/codex-reset-credits/types";
import { alertableResetCreditStatus, requireCronSecret } from "./route";

describe("Codex reset-credit cron compatibility boundary", () => {
  it("passes only supplied details with real expiries to alert evaluation", () => {
    const filtered = alertableResetCreditStatus(status());

    expect(filtered.availableCount).toBe(3);
    expect(filtered.detailsComplete).toBe(false);
    expect(filtered.credits).toHaveLength(1);
    expect(filtered.credits[0]?.expiresAtUtc).toBe("2030-02-01T00:00:00.000Z");
  });

  it("does not expand authoritative count into synthetic alert rows", () => {
    const filtered = alertableResetCreditStatus({ ...status(), credits: [] });
    expect(filtered.availableCount).toBe(3);
    expect(filtered.credits).toEqual([]);
  });

  it("preserves CRON_SECRET bearer protection", () => {
    expect(() => requireCronSecret(request(), {})).toThrow("CRON_SECRET");
    expect(() => requireCronSecret(request(), { CRON_SECRET: "local-cron-secret" })).toThrow();
    expect(() => requireCronSecret(
      request({ authorization: "Bearer local-cron-secret" }),
      { CRON_SECRET: "local-cron-secret" },
    )).not.toThrow();
  });
});

function status(): ResetCreditStatus {
  return {
    schemaVersion: 2,
    source: "codex-app-server",
    accuracy: "official",
    fetchedAtUtc: "2030-01-20T00:00:00.000Z",
    availableCount: 3,
    totalEarnedCount: null,
    detailsComplete: false,
    credits: [credit(1, "2030-02-01T00:00:00.000Z"), credit(2, null)],
  };
}

function credit(index: number, expiresAtUtc: string | null) {
  return {
    index,
    resetType: "codexRateLimits" as const,
    providerStatus: "available" as const,
    grantedAtUtc: null,
    expiresAtUtc,
    title: null,
    description: null,
    remainingSeconds: expiresAtUtc === null ? null : 60,
    status: expiresAtUtc === null ? "unknown" as const : "active" as const,
  };
}

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3000/api/cron/codex-reset-credits", { headers, method: "POST" });
}
