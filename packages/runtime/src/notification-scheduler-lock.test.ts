import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  acquireNotificationSchedulerLock,
  readNotificationSchedulerLock,
  releaseNotificationSchedulerLock,
} from "./notification-scheduler-lock.js";

describe("notification scheduler runtime lock", () => {
  it("allows one owner and keeps only a nonce hash on disk", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-notifier-lock-"));
    const options = {
      cwd,
      lockPath: "scheduler.lock",
      pid: 1234,
      now: () => new Date("2026-07-10T05:00:00.000Z"),
      processAlive: () => true,
    };
    const first = await acquireNotificationSchedulerLock(options);
    const second = await acquireNotificationSchedulerLock(options);

    expect(first.acquired).toBe(true);
    expect(second).toMatchObject({
      acquired: false,
      owner: {
        pid: 1234,
        acquiredAt: "2026-07-10T05:00:00.000Z",
      },
    });
    const raw = await readFile(join(cwd, "scheduler.lock"), "utf8");
    expect(raw).toContain("nonceHash");
    expect(raw).not.toContain(first.acquired ? first.lease.nonce : "unreachable");

    if (first.acquired) {
      expect(await releaseNotificationSchedulerLock(first.lease)).toBe(true);
    }
    expect(await readNotificationSchedulerLock(options)).toBeNull();
  });

  it("replaces a stale owner without exposing its contents", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-notifier-lock-"));
    const first = await acquireNotificationSchedulerLock({
      cwd,
      lockPath: "scheduler.lock",
      pid: 1234,
      processAlive: () => true,
    });
    expect(first.acquired).toBe(true);

    const replacement = await acquireNotificationSchedulerLock({
      cwd,
      lockPath: "scheduler.lock",
      pid: 5678,
      processAlive: (pid) => pid === 5678,
    });

    expect(replacement.acquired).toBe(true);
    if (replacement.acquired) {
      expect(await releaseNotificationSchedulerLock(replacement.lease)).toBe(true);
    }
  });
});
