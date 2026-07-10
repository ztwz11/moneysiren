import { describe, expect, it } from "vitest";
import { evaluateNormalizedNotification, notificationFingerprint } from "./evaluator.js";

const ALERTS = [{
  providerKey: "openai",
  category: "budget",
  severity: "critical" as const,
  occurredAt: "2026-07-10T01:00:00.000Z",
}];

describe("notification evaluator", () => {
  it("uses normalized fields and emits a bounded summary without raw text", () => {
    const result = evaluateNormalizedNotification(ALERTS, {
      enabled: true,
      now: new Date(2026, 6, 10, 12, 0),
      quietStart: "22:00",
      quietEnd: "08:00",
      cooldownMinutes: 60,
      recent: [],
    });

    expect(result.outcome).toBe("deliver");
    expect(result.body).toBe("1 alert across 1 provider (1 critical).");
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain("hooks.slack.com");
  });

  it("suppresses disabled, quiet-hour, and cooldown delivery deterministically", () => {
    const fingerprint = notificationFingerprint(ALERTS);
    const policy = {
      now: new Date(2026, 6, 10, 23, 0),
      quietStart: "22:00",
      quietEnd: "08:00",
      cooldownMinutes: 60,
      recent: [],
    };

    expect(evaluateNormalizedNotification(ALERTS, { ...policy, enabled: false }).reason)
      .toBe("notifications_disabled");
    expect(evaluateNormalizedNotification(ALERTS, { ...policy, enabled: true }).reason)
      .toBe("quiet_hours");
    expect(evaluateNormalizedNotification(ALERTS, {
      ...policy,
      enabled: true,
      now: new Date("2026-07-10T03:30:00.000Z"),
      quietStart: "04:00",
      quietEnd: "05:00",
      recent: [{
        fingerprint,
        outcome: "delivered",
        attemptedAt: "2026-07-10T03:00:00.000Z",
      }],
    }).reason).toBe("cooldown");
  });
});
