import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

  it("does not delete an untrusted pre-existing file", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-notifier-lock-"));
    const path = join(cwd, "scheduler.lock");
    await writeFile(path, "not a MoneySiren lock", "utf8");

    await expect(acquireNotificationSchedulerLock({
      cwd,
      lockPath: "scheduler.lock",
    })).rejects.toThrow("NOTIFICATION_SCHEDULER_LOCK_UNTRUSTED");
    expect(await readFile(path, "utf8")).toBe("not a MoneySiren lock");
  });

  it("allows exactly one winner when two processes clean a valid stale lock", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-notifier-lock-"));
    const stale = await acquireNotificationSchedulerLock({
      cwd,
      lockPath: "scheduler.lock",
      pid: 1234,
      processAlive: () => true,
    });
    expect(stale.acquired).toBe(true);

    const contenders = await Promise.all([
      acquireNotificationSchedulerLock({
        cwd,
        lockPath: "scheduler.lock",
        pid: 5678,
        processAlive: (pid) => pid !== 1234,
      }),
      acquireNotificationSchedulerLock({
        cwd,
        lockPath: "scheduler.lock",
        pid: 6789,
        processAlive: (pid) => pid !== 1234,
      }),
    ]);
    const winners = contenders.filter((result) => result.acquired);

    expect(winners).toHaveLength(1);
    const winner = winners[0];
    if (winner?.acquired) {
      expect(await releaseNotificationSchedulerLock(winner.lease)).toBe(true);
    }
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
