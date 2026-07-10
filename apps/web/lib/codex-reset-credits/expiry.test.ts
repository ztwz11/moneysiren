import { describe, expect, it } from "vitest";
import { runResetCreditAlerts } from "../notifications/alert-service";
import type { ResetCreditNotifier } from "../notifications/types";
import type { AlertHistoryRepository } from "../alert-history/repository";
import { buildResetCreditAlerts } from "./expiry";
import type { AlertThreshold, CreditAlert, ResetCreditStatus } from "./types";

const NOW = new Date("2026-06-19T00:00:00.000Z");

describe("codex reset credit alert logic", () => {
  it.each([
    ["7d", "2026-06-25T23:59:59.000Z"],
    ["3d", "2026-06-21T23:59:59.000Z"],
    ["1d", "2026-06-19T23:59:59.000Z"],
    ["6h", "2026-06-19T05:59:59.000Z"],
  ] as const)("selects %s threshold alerts", (threshold, expiresAtUtc) => {
    const alerts = buildResetCreditAlerts(statusWithExpiry(expiresAtUtc), NOW);

    expect(alerts.map((alert) => alert.threshold)).toContain(threshold);
  });

  it("selects expired alerts", () => {
    const alerts = buildResetCreditAlerts(statusWithExpiry("2026-06-18T23:59:59.000Z"), NOW);

    expect(alerts.map((alert) => alert.threshold)).toEqual(["expired"]);
  });

  it("does not select a threshold just before the boundary", () => {
    const alerts = buildResetCreditAlerts(statusWithExpiry("2026-06-26T00:00:01.000Z"), NOW);

    expect(alerts.map((alert) => alert.threshold)).not.toContain("7d");
  });

  it("selects a threshold at the boundary", () => {
    const alerts = buildResetCreditAlerts(statusWithExpiry("2026-06-26T00:00:00.000Z"), NOW);

    expect(alerts.map((alert) => alert.threshold)).toContain("7d");
  });

  it("skips duplicate notifications through history repository", async () => {
    const sent: CreditAlert[] = [];
    const repository = new MemoryAlertHistoryRepository();
    const notifier: ResetCreditNotifier = {
      async send(alert) {
        sent.push(alert);
      },
    };

    await runResetCreditAlerts(statusWithExpiry("2026-06-19T05:59:59.000Z"), {
      now: NOW,
      repository,
      notifier,
    });
    const second = await runResetCreditAlerts(statusWithExpiry("2026-06-19T05:59:59.000Z"), {
      now: NOW,
      repository,
      notifier,
    });

    expect(sent.length).toBeGreaterThan(0);
    expect(second.notificationsSent).toBe(0);
    expect(second.skippedDuplicates).toBeGreaterThan(0);
  });
});

function statusWithExpiry(expiresAtUtc: string): ResetCreditStatus {
  return {
    schemaVersion: 2,
    source: "codex-app-server",
    accuracy: "official",
    fetchedAtUtc: NOW.toISOString(),
    availableCount: 1,
    totalEarnedCount: null,
    detailsComplete: true,
    credits: [{
      index: 1,
      resetType: "codexRateLimits",
      providerStatus: "available",
      grantedAtUtc: null,
      expiresAtUtc,
      title: null,
      description: null,
      remainingSeconds: Math.max(0, Math.floor((Date.parse(expiresAtUtc) - NOW.getTime()) / 1000)),
      status: Date.parse(expiresAtUtc) <= NOW.getTime() ? "expired" : "active",
    }],
  };
}

class MemoryAlertHistoryRepository implements AlertHistoryRepository {
  private readonly sent = new Set<string>();

  async hasSent(creditKey: string, threshold: AlertThreshold): Promise<boolean> {
    return this.sent.has(`${creditKey}:${threshold}`);
  }

  async markSent(creditKey: string, threshold: AlertThreshold): Promise<void> {
    this.sent.add(`${creditKey}:${threshold}`);
  }
}
