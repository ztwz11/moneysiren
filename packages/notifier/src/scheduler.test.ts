import { describe, expect, it } from "vitest";
import {
  computeBackoffMinutes,
  computeNextNotificationRun,
  runNotificationSchedulerCycle,
} from "./scheduler.js";

describe("notification scheduler", () => {
  it("does not call providers before explicit enablement", async () => {
    let calls = 0;
    const result = await runNotificationSchedulerCycle({
      enabled: false,
      now: new Date("2026-07-10T00:00:00.000Z"),
      quietStart: "22:00",
      quietEnd: "08:00",
      cooldownMinutes: 60,
      recent: [],
      providers: [{
        providerKey: "openai",
        async collect() {
          calls += 1;
          return { providerKey: "openai", alerts: [] };
        },
      }],
    });

    expect(result.skipped).toBe(true);
    expect(calls).toBe(0);
  });

  it("continues after one provider fails", async () => {
    let secondCalls = 0;
    const result = await runNotificationSchedulerCycle({
      enabled: true,
      now: new Date("2026-07-10T12:00:00.000Z"),
      quietStart: "22:00",
      quietEnd: "08:00",
      cooldownMinutes: 60,
      recent: [],
      providers: [{
        providerKey: "broken",
        async collect() {
          throw new Error("fake raw provider failure");
        },
      }, {
        providerKey: "openai",
        async collect() {
          secondCalls += 1;
          return {
            providerKey: "openai",
            alerts: [{
              providerKey: "openai",
              category: "budget",
              severity: "warning",
              occurredAt: "2026-07-10T11:59:00.000Z",
            }],
          };
        },
      }],
    });

    expect(secondCalls).toBe(1);
    expect(result.providerFailures).toEqual([{
      providerKey: "broken",
      errorCode: "PROVIDER_COLLECTION_FAILED",
    }]);
    expect(JSON.stringify(result)).not.toContain("fake raw provider failure");
  });

  it("applies provider minimums, bounded jitter, and exponential backoff", () => {
    expect(computeNextNotificationRun({
      now: new Date("2026-07-10T00:00:00.000Z"),
      intervalMinutes: 15,
      providerMinimumMinutes: [30],
      jitterSeconds: 90,
      random: () => 1,
    })).toBe("2026-07-10T00:31:30.000Z");
    expect(computeNextNotificationRun({
      now: new Date("2026-07-10T00:00:00.000Z"),
      intervalMinutes: 15,
      providerMinimumMinutes: [15],
      jitterSeconds: 90,
      random: () => Number.NaN,
    })).toBe("2026-07-10T00:15:00.000Z");
    expect(computeBackoffMinutes(0)).toBe(15);
    expect(computeBackoffMinutes(5)).toBe(360);
  });
});
