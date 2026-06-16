import { describe, expect, it } from "vitest";
import {
  computeDigestFingerprint,
  evaluateNotificationDigest,
  isWithinQuietHours,
  pollNotificationDigestOnce,
  type NotificationDeliveryRecord,
} from "./notifications.js";
import type { LocalNotificationDigest } from "./local-api.js";

const DIGEST: LocalNotificationDigest = {
  generatedAt: "2026-06-10T00:00:00.000Z",
  localOnly: true,
  secretsReturned: false,
  title: "MoneySiren",
  body: "OpenAI today USD 3.20 | High risks 1",
  severity: "high",
  clickUrl: "http://127.0.0.1:47831/ko/dashboard/risks",
  suppressedReason: null,
  items: [
    {
      key: "openai_today_cost",
      label: "OpenAI today",
      value: "USD 3.20",
      severity: "medium",
      clickPath: "/ko/services/openai",
    },
  ],
};

describe("notification polling model", () => {
  it("delivers a digest when API and local suppression checks allow it", () => {
    const result = evaluateNotificationDigest(DIGEST, {
      now: new Date("2026-06-10T09:00:00.000Z"),
      notificationPermission: "granted",
    });

    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toBe("deliver");
    expect(result.deliveryRecord?.fingerprint).toBe(computeDigestFingerprint(DIGEST));
    expect(result.deliveryRecord?.bodyPreview).not.toContain("sk-");
  });

  it("respects API suppression, pause, quiet hours, and recent fingerprint state", () => {
    const now = new Date("2026-06-10T22:30:00.000Z");
    const recentDelivery: NotificationDeliveryRecord = {
      fingerprint: computeDigestFingerprint(DIGEST),
      deliveredAt: "2026-06-10T22:00:00.000Z",
      severity: "high",
      title: "MoneySiren",
      bodyPreview: "OpenAI today USD 3.20",
    };

    expect(evaluateNotificationDigest({
      ...DIGEST,
      suppressedReason: "quiet_hours",
    }, {
      now,
    }).reason).toBe("suppressed_by_api");

    expect(evaluateNotificationDigest(DIGEST, {
      now,
      pausedUntil: "2026-06-10T23:00:00.000Z",
    }).reason).toBe("paused");

    expect(evaluateNotificationDigest(DIGEST, {
      now,
      quietHours: {
        enabled: true,
        start: "22:00",
        end: "08:00",
      },
    }).reason).toBe("quiet_hours");

    expect(evaluateNotificationDigest(DIGEST, {
      now,
      recentDeliveries: [recentDelivery],
      fingerprintTtlMinutes: 180,
    }).reason).toBe("no_change");
  });

  it("supports quiet-hour windows crossing midnight", () => {
    expect(isWithinQuietHours(new Date(2026, 5, 10, 23, 30), {
      enabled: true,
      start: "22:00",
      end: "08:00",
    })).toBe(true);
    expect(isWithinQuietHours(new Date(2026, 5, 10, 12, 0), {
      enabled: true,
      start: "22:00",
      end: "08:00",
    })).toBe(false);
  });

  it("checks local API health before polling the digest", async () => {
    const result = await pollNotificationDigestOnce({
      getHealth: async () => ({
        generatedAt: "2026-06-10T00:00:00.000Z",
        localOnly: true,
        secretsReturned: false,
        status: "ok",
      }),
      getNotificationDigest: async () => DIGEST,
    }, {
      now: new Date("2026-06-10T09:00:00.000Z"),
    });

    expect(result.healthChecked).toBe(true);
    expect(result.shouldNotify).toBe(true);
  });
});
