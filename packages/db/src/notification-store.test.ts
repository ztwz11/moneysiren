import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  readNotificationSchedulerState,
  readRecentNotificationDeliveries,
  recordNotificationDelivery,
  writeNotificationSchedulerState,
} from "./notification-store.js";

describe("notification state persistence", () => {
  it("defaults to disabled and uses an ISO UTC timestamp", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-notification-state-"));
    const dbPath = join(cwd, "state.sqlite");
    const state = await readNotificationSchedulerState(dbPath);

    expect(state.enabled).toBe(false);
    expect(state.intervalMinutes).toBe(15);
    expect(state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("persists only sanitized scheduler and delivery fields", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-notification-state-"));
    const dbPath = join(cwd, "state.sqlite");
    const timestamp = "2026-07-10T05:00:00.000Z";

    await writeNotificationSchedulerState({
      dbPath,
      enabled: true,
      intervalMinutes: 15,
      jitterSeconds: 90,
      quietStart: "22:00",
      quietEnd: "08:00",
      nextRunAt: "2026-07-10T05:15:00.000Z",
      consecutiveFailures: 0,
      updatedAt: timestamp,
    });
    await recordNotificationDelivery({
      dbPath,
      fingerprint: "a".repeat(64),
      providerKey: "openai",
      target: "slack",
      outcome: "error",
      reasonCode: "delivery_failed",
      attemptedAt: timestamp,
      nextRetryAt: "2026-07-10T05:30:00.000Z",
    });

    const state = await readNotificationSchedulerState(dbPath);
    const deliveries = await readRecentNotificationDeliveries(dbPath);
    const raw = await readFile(dbPath);

    expect(state.enabled).toBe(true);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      providerKey: "openai",
      target: "slack",
      outcome: "error",
      reasonCode: "delivery_failed",
      metadataJson: {},
    });
    expect(raw.includes(Buffer.from("hooks.slack.com"))).toBe(false);
    expect(raw.includes(Buffer.from("rawPayload"))).toBe(false);
  });
});
