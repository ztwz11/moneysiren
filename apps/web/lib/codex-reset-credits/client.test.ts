import { describe, expect, it } from "vitest";
import type { CodexOfficialAccountMeasurements } from "../local-ai/codex/app-server-transport";
import { fetchCodexResetCreditStatus } from "./client";

const FETCHED_AT = "2030-01-20T00:00:00.000Z";

describe("deprecated official reset-credit adapter", () => {
  it("reads normalized App Server measurements without HTTP or auth inputs", async () => {
    const status = await fetchCodexResetCreditStatus({
      env: {
        CODEX_AUTH_FILE: "C:\\FAKE\\auth.json",
        CODEX_RESET_CREDIT_ENDPOINT: "https://example.invalid/internal",
      },
      now: () => new Date("2030-01-25T00:00:00.000Z"),
      readMeasurements: async () => measurements(),
    });

    expect(status.availableCount).toBe(2);
    expect(status.credits).toHaveLength(1);
    expect(JSON.stringify(status)).not.toContain("auth.json");
    expect(JSON.stringify(status)).not.toContain("example.invalid");
  });

  it("maps App Server login failure to the compatibility error code", async () => {
    await expect(fetchCodexResetCreditStatus({
      readMeasurements: async () => measurements("not-authenticated"),
    })).rejects.toMatchObject({
      code: "UPSTREAM_UNAUTHORIZED",
      status: 401,
    });
  });

  it("never exposes thrown RPC or auth material", async () => {
    let caught: unknown;

    try {
      await fetchCodexResetCreditStatus({
        readMeasurements: async () => {
          throw new Error("Bearer FAKE_RPC_SECRET account@example.com");
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(String(caught)).not.toContain("FAKE_RPC_SECRET");
    expect(String(caught)).not.toContain("account@example.com");
  });
});

function measurements(reason?: "not-authenticated"): CodexOfficialAccountMeasurements {
  return {
    rateLimits: reason === undefined
      ? {
          schemaVersion: 2,
          availability: "available",
          source: "codex-app-server-rate-limits",
          accuracy: "official",
          fetchedAt: FETCHED_AT,
          data: {
            primary: null,
            secondary: null,
            reachedType: null,
            resetCredits: {
              availableCount: 2,
              detailsComplete: false,
              details: [{
                resetType: "codexRateLimits",
                status: "available",
                grantedAt: null,
                expiresAt: "2030-02-01T00:00:00.000Z",
                title: null,
                description: null,
              }],
            },
          },
        }
      : {
          schemaVersion: 2,
          availability: "unavailable",
          source: "codex-app-server-rate-limits",
          accuracy: "unavailable",
          fetchedAt: FETCHED_AT,
          reason,
          message: "fixed safe message",
          data: null,
        },
    accountUsage: {
      schemaVersion: 2,
      availability: "unavailable",
      source: "codex-app-server-account-usage",
      accuracy: "unavailable",
      fetchedAt: FETCHED_AT,
      reason: "no-data",
      message: "fixed safe message",
      data: null,
    },
  };
}
