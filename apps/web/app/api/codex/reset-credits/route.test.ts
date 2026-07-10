import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetCreditError } from "../../../../lib/codex-reset-credits/errors";
import type { ResetCreditStatus } from "../../../../lib/codex-reset-credits/types";

const fetchStatus = vi.hoisted(() => vi.fn<() => Promise<ResetCreditStatus>>());

vi.mock("../../../../lib/codex-reset-credits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/codex-reset-credits")>();
  return { ...actual, fetchCodexResetCreditStatus: fetchStatus };
});

import { GET } from "./route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.RESET_CREDIT_API_KEY;
  fetchStatus.mockReset();
  fetchStatus.mockResolvedValue(officialStatus());
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Codex reset credit compatibility API route", () => {
  it("returns schema v2 official App Server metadata", async () => {
    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      schemaVersion: 2,
      data: {
        schemaVersion: 2,
        source: "codex-app-server",
        accuracy: "official",
        availableCount: 3,
        detailsComplete: false,
      },
      meta: {
        schemaVersion: 2,
        timeZone: "Asia/Seoul",
        source: "codex-app-server",
        accuracy: "official",
      },
    });
    expect(JSON.stringify(payload)).not.toMatch(/auth\.json|OpenAI-Account|Bearer FAKE|account@example/i);
  });

  it("returns sanitized official-client failures", async () => {
    fetchStatus.mockRejectedValue(new ResetCreditError(
      "UPSTREAM_TIMEOUT",
      "Codex App Server 응답 시간이 초과됐습니다.",
      504,
    ));

    const response = await GET(request());
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      schemaVersion: 2,
      error: { code: "UPSTREAM_TIMEOUT" },
    });
    expect(response.status).toBe(504);
  });

  it("preserves RESET_CREDIT_API_KEY protection", async () => {
    process.env.RESET_CREDIT_API_KEY = "local-api-key";

    const rejected = await GET(request());
    const accepted = await GET(request({ authorization: "Bearer local-api-key" }));

    await expect(rejected.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "API_UNAUTHORIZED" },
    });
    expect(accepted.status).toBe(200);
  });
});

function officialStatus(): ResetCreditStatus {
  return {
    schemaVersion: 2,
    source: "codex-app-server",
    accuracy: "official",
    fetchedAtUtc: "2030-01-20T00:00:00.000Z",
    availableCount: 3,
    totalEarnedCount: null,
    detailsComplete: false,
    credits: [{
      index: 1,
      resetType: "codexRateLimits",
      providerStatus: "available",
      grantedAtUtc: null,
      expiresAtUtc: "2030-02-01T00:00:00.000Z",
      title: null,
      description: null,
      remainingSeconds: 60,
      status: "active",
    }],
  };
}

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3000/api/codex/reset-credits", { headers, method: "GET" });
}
