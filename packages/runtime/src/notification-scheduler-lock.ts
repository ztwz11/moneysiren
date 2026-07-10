import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const LOCK_PATH_ENV = "MONEYSIREN_NOTIFICATION_SCHEDULER_LOCK_PATH";
const DEFAULT_LOCK_PATH = ".moneysiren/notification-scheduler.lock";
const LOCK_KIND = "moneysiren-notification-scheduler-lock-v1";
const MAX_LOCK_BYTES = 4_096;
const MUTATION_GUARD_SUFFIX = ".mutation";
const MUTATION_GUARD_ATTEMPTS = 100;
const MUTATION_GUARD_RETRY_MS = 2;
const REMOVE_ATTEMPTS = 5;
const REMOVE_RETRY_MS = 10;

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

  for (let attempt = 0; attempt < MUTATION_GUARD_ATTEMPTS; attempt += 1) {
    const mutationGuard = await tryAcquireMutationGuard(path);

    if (mutationGuard === null) {
      await delay(MUTATION_GUARD_RETRY_MS);
      continue;
    }

    try {
      const nonce = randomBytes(32).toString("hex");
      const owner: NotificationSchedulerLockOwner = {
        pid,
        acquiredAt: now().toISOString(),
        nonceHash: hashNonce(nonce),
      };

      try {
        const handle = await open(path, "wx");

        try {
          await handle.writeFile(`${JSON.stringify({ kind: LOCK_KIND, ...owner }, null, 2)}\n`, "utf8");
        } finally {
          await handle.close();
        }

        return {
          acquired: true,
          lease: { path, nonce },
        };
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;

        const inspected = await inspectOwner(path);

        if (inspected.kind === "untrusted") {
          throw new Error("NOTIFICATION_SCHEDULER_LOCK_UNTRUSTED");
        }

        if (inspected.kind === "missing") {
          continue;
        }

        if (processAlive(inspected.owner.pid)) {
          return { acquired: false, owner: inspected.owner };
        }

        await removePathWithRetry(path);
      }
    } finally {
      await removePathWithRetry(mutationGuard);
    }
  }

  throw new Error("NOTIFICATION_SCHEDULER_MUTATION_GUARD_BUSY");
}

export async function releaseNotificationSchedulerLock(lease: NotificationSchedulerLease): Promise<boolean> {
  for (let attempt = 0; attempt < MUTATION_GUARD_ATTEMPTS; attempt += 1) {
    const mutationGuard = await tryAcquireMutationGuard(lease.path);

    if (mutationGuard === null) {
      await delay(MUTATION_GUARD_RETRY_MS);
      continue;
    }

    try {
      const owner = await readOwner(lease.path);

      if (owner === null || owner.nonceHash !== hashNonce(lease.nonce)) {
        return false;
      }

      await removePathWithRetry(lease.path);
      return true;
    } finally {
      await removePathWithRetry(mutationGuard);
    }
  }

  throw new Error("NOTIFICATION_SCHEDULER_MUTATION_GUARD_BUSY");
}

export async function readNotificationSchedulerLock(
  options: NotificationSchedulerLockOptions = {},
): Promise<NotificationSchedulerLockOwner | null> {
  return readOwner(resolveNotificationSchedulerLockPath(options));
}

async function readOwner(path: string): Promise<NotificationSchedulerLockOwner | null> {
  const inspected = await inspectOwner(path);
  return inspected.kind === "valid" ? inspected.owner : null;
}

async function tryAcquireMutationGuard(path: string): Promise<string | null> {
  const mutationGuard = `${path}${MUTATION_GUARD_SUFFIX}`;

  try {
    const handle = await open(mutationGuard, "wx");
    await handle.close();
    return mutationGuard;
  } catch (error) {
    if (isAlreadyExists(error)) {
      return null;
    }

    throw error;
  }
}

async function removePathWithRetry(path: string): Promise<void> {
  for (let attempt = 0; attempt < REMOVE_ATTEMPTS; attempt += 1) {
    try {
      await rm(path, { force: true });
      return;
    } catch (error) {
      if (!isTransientRemoveError(error) || attempt === REMOVE_ATTEMPTS - 1) {
        throw error;
      }

      await delay(REMOVE_RETRY_MS);
    }
  }
}

async function inspectOwner(path: string): Promise<
  | { kind: "missing" }
  | { kind: "untrusted" }
  | { kind: "valid"; owner: NotificationSchedulerLockOwner }
> {
  try {
    const details = await lstat(path);

    if (!details.isFile() || details.size <= 0 || details.size > MAX_LOCK_BYTES) {
      return { kind: "untrusted" };
    }

    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;

    if (!isRecord(parsed) || parsed.kind !== LOCK_KIND) return { kind: "untrusted" };
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
      return { kind: "untrusted" };
    }

    return { kind: "valid", owner: { pid, acquiredAt, nonceHash } };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { kind: "missing" };
    }

    return { kind: "untrusted" };
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

function isTransientRemoveError(error: unknown): boolean {
  return isNodeError(error) && (error.code === "EBUSY" || error.code === "EPERM");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
