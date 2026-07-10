import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

const LOCK_PATH_ENV = "MONEYSIREN_NOTIFICATION_SCHEDULER_LOCK_PATH";
const DEFAULT_LOCK_PATH = ".moneysiren/notification-scheduler.lock";

export interface NotificationSchedulerLockOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  lockPath?: string;
  pid?: number;
  now?: () => Date;
  processAlive?: (pid: number) => boolean;
}

export interface NotificationSchedulerLockOwner {
  pid: number;
  acquiredAt: string;
  nonceHash: string;
}

export interface NotificationSchedulerLease {
  path: string;
  nonce: string;
}

export type NotificationSchedulerLockResult =
  | { acquired: true; lease: NotificationSchedulerLease }
  | { acquired: false; owner: NotificationSchedulerLockOwner };

export function resolveNotificationSchedulerLockPath(options: NotificationSchedulerLockOptions = {}): string {
  const selected = options.lockPath?.trim() || options.env?.[LOCK_PATH_ENV]?.trim() || DEFAULT_LOCK_PATH;
  return isAbsolute(selected) ? selected : join(options.cwd ?? process.cwd(), selected);
}

export async function acquireNotificationSchedulerLock(
  options: NotificationSchedulerLockOptions = {},
): Promise<NotificationSchedulerLockResult> {
  const path = resolveNotificationSchedulerLockPath(options);
  const pid = options.pid ?? process.pid;
  const now = options.now ?? (() => new Date());
  const processAlive = options.processAlive ?? defaultProcessAlive;

  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error("Notification scheduler PID must be a positive safe integer.");
  }

  await mkdir(dirname(path), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nonce = randomBytes(32).toString("hex");
    const owner: NotificationSchedulerLockOwner = {
      pid,
      acquiredAt: now().toISOString(),
      nonceHash: hashNonce(nonce),
    };

    try {
      const handle = await open(path, "wx");

      try {
        await handle.writeFile(`${JSON.stringify(owner, null, 2)}\n`, "utf8");
      } finally {
        await handle.close();
      }

      return {
        acquired: true,
        lease: { path, nonce },
      };
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;

      const existing = await readOwner(path);

      if (existing !== null && processAlive(existing.pid)) {
        return { acquired: false, owner: existing };
      }

      await rm(path, { force: true });
    }
  }

  throw new Error("Notification scheduler lock could not be acquired.");
}

export async function releaseNotificationSchedulerLock(lease: NotificationSchedulerLease): Promise<boolean> {
  const owner = await readOwner(lease.path);

  if (owner === null || owner.nonceHash !== hashNonce(lease.nonce)) {
    return false;
  }

  await rm(lease.path, { force: true });
  return true;
}

export async function readNotificationSchedulerLock(
  options: NotificationSchedulerLockOptions = {},
): Promise<NotificationSchedulerLockOwner | null> {
  return readOwner(resolveNotificationSchedulerLockPath(options));
}

async function readOwner(path: string): Promise<NotificationSchedulerLockOwner | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;

    if (!isRecord(parsed)) return null;
    const pid = parsed.pid;
    const acquiredAt = parsed.acquiredAt;
    const nonceHash = parsed.nonceHash;

    if (
      typeof pid !== "number" ||
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      typeof acquiredAt !== "string" ||
      !Number.isFinite(Date.parse(acquiredAt)) ||
      typeof nonceHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(nonceHash)
    ) {
      return null;
    }

    return { pid, acquiredAt, nonceHash };
  } catch {
    return null;
  }
}

function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

function defaultProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isNodeError(error) && error.code === "EPERM";
  }
}

function isAlreadyExists(error: unknown): boolean {
  return isNodeError(error) && error.code === "EEXIST";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
