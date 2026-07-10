import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeLocalStore } from "./local-store.js";
import { resolveSqliteBin, SQLITE_BIN_ENV_KEY } from "./sqlite-bin.js";

const requireNodeModule = createRequire(import.meta.url);
const EMPTY_METADATA_JSON = "{}";

export type NotificationDeliveryTarget = "desktop" | "slack";
export type NotificationDeliveryOutcome = "attempted" | "delivered" | "suppressed" | "error";
export type NotificationDeliveryReasonCode =
  | "delivery_requested"
  | "delivered"
  | "notifications_disabled"
  | "quiet_hours"
  | "cooldown"
  | "no_alerts"
  | "permission_denied"
  | "desktop_unavailable"
  | "slack_unavailable"
  | "delivery_failed"
  | "provider_failed";
export type NotificationSchedulerErrorCode =
  | "SCHEDULER_LOCKED"
  | "PROVIDER_COLLECTION_FAILED"
  | "DESKTOP_PERMISSION_DENIED"
  | "DESKTOP_UNAVAILABLE"
  | "SLACK_DELIVERY_FAILED"
  | "DELIVERY_FAILED";

export interface NotificationSchedulerState {
  enabled: boolean;
  intervalMinutes: number;
  jitterSeconds: number;
  quietStart: string;
  quietEnd: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastErrorCode?: NotificationSchedulerErrorCode;
  consecutiveFailures: number;
  updatedAt: string;
}

export interface NotificationSchedulerStateInput extends NotificationSchedulerState {
  dbPath: string;
}

export interface NotificationDeliveryRecord {
  id: string;
  fingerprint: string;
  providerKey?: string;
  target: NotificationDeliveryTarget;
  outcome: NotificationDeliveryOutcome;
  reasonCode: NotificationDeliveryReasonCode;
  attemptedAt: string;
  nextRetryAt?: string;
  metadataJson: Record<string, never>;
}

export interface NotificationDeliveryInput {
  dbPath: string;
  fingerprint: string;
  providerKey?: string;
  target: NotificationDeliveryTarget;
  outcome: NotificationDeliveryOutcome;
  reasonCode: NotificationDeliveryReasonCode;
  attemptedAt: string;
  nextRetryAt?: string;
}

const TARGETS = new Set<NotificationDeliveryTarget>(["desktop", "slack"]);
const OUTCOMES = new Set<NotificationDeliveryOutcome>(["attempted", "delivered", "suppressed", "error"]);
const REASONS = new Set<NotificationDeliveryReasonCode>([
  "delivery_requested",
  "delivered",
  "notifications_disabled",
  "quiet_hours",
  "cooldown",
  "no_alerts",
  "permission_denied",
  "desktop_unavailable",
  "slack_unavailable",
  "delivery_failed",
  "provider_failed",
]);
const SCHEDULER_ERRORS = new Set<NotificationSchedulerErrorCode>([
  "SCHEDULER_LOCKED",
  "PROVIDER_COLLECTION_FAILED",
  "DESKTOP_PERMISSION_DENIED",
  "DESKTOP_UNAVAILABLE",
  "SLACK_DELIVERY_FAILED",
  "DELIVERY_FAILED",
]);

export async function readNotificationSchedulerState(dbPath: string): Promise<NotificationSchedulerState> {
  await initializeLocalStore({ dbPath });
  const rows = queryRows<SchedulerRow>(dbPath, `
    SELECT
      enabled,
      interval_minutes AS intervalMinutes,
      jitter_seconds AS jitterSeconds,
      quiet_start AS quietStart,
      quiet_end AS quietEnd,
      last_run_at AS lastRunAt,
      next_run_at AS nextRunAt,
      last_error_code AS lastErrorCode,
      consecutive_failures AS consecutiveFailures,
      updated_at AS updatedAt
    FROM notification_scheduler_state
    WHERE singleton_id = 1;
  `);
  const row = rows[0];

  if (row === undefined) {
    throw new Error("Notification scheduler state is unavailable.");
  }

  if (row.lastErrorCode !== null && !SCHEDULER_ERRORS.has(row.lastErrorCode as NotificationSchedulerErrorCode)) {
    throw new Error("Notification scheduler state contains an invalid error code.");
  }

  return {
    enabled: row.enabled === 1,
    intervalMinutes: row.intervalMinutes,
    jitterSeconds: row.jitterSeconds,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
    consecutiveFailures: row.consecutiveFailures,
    updatedAt: row.updatedAt,
    ...(row.lastRunAt === null ? {} : { lastRunAt: row.lastRunAt }),
    ...(row.nextRunAt === null ? {} : { nextRunAt: row.nextRunAt }),
    ...(row.lastErrorCode === null ? {} : { lastErrorCode: row.lastErrorCode as NotificationSchedulerErrorCode }),
  };
}

export async function writeNotificationSchedulerState(input: NotificationSchedulerStateInput): Promise<void> {
  validateSchedulerState(input);
  await initializeLocalStore({ dbPath: input.dbPath });
  executeSql(input.dbPath, `
    INSERT INTO notification_scheduler_state (
      singleton_id, enabled, interval_minutes, jitter_seconds, quiet_start, quiet_end,
      last_run_at, next_run_at, last_error_code, consecutive_failures, updated_at
    )
    VALUES (
      1,
      ${input.enabled ? 1 : 0},
      ${input.intervalMinutes},
      ${input.jitterSeconds},
      ${sqlString(input.quietStart)},
      ${sqlString(input.quietEnd)},
      ${sqlNullableString(input.lastRunAt)},
      ${sqlNullableString(input.nextRunAt)},
      ${sqlNullableString(input.lastErrorCode)},
      ${input.consecutiveFailures},
      ${sqlString(input.updatedAt)}
    )
    ON CONFLICT(singleton_id) DO UPDATE SET
      enabled = excluded.enabled,
      interval_minutes = excluded.interval_minutes,
      jitter_seconds = excluded.jitter_seconds,
      quiet_start = excluded.quiet_start,
      quiet_end = excluded.quiet_end,
      last_run_at = excluded.last_run_at,
      next_run_at = excluded.next_run_at,
      last_error_code = excluded.last_error_code,
      consecutive_failures = excluded.consecutive_failures,
      updated_at = excluded.updated_at;
  `);
}

export async function recordNotificationDelivery(input: NotificationDeliveryInput): Promise<void> {
  validateDelivery(input);
  await initializeLocalStore({ dbPath: input.dbPath });
  executeSql(input.dbPath, `
    INSERT INTO notification_delivery_runs (
      id, fingerprint, provider_key, target, outcome, reason_code, attempted_at, next_retry_at, metadata_json
    )
    VALUES (
      ${sqlString(randomUUID())},
      ${sqlString(input.fingerprint)},
      ${sqlNullableString(input.providerKey)},
      ${sqlString(input.target)},
      ${sqlString(input.outcome)},
      ${sqlString(input.reasonCode)},
      ${sqlString(input.attemptedAt)},
      ${sqlNullableString(input.nextRetryAt)},
      ${sqlString(EMPTY_METADATA_JSON)}
    );
  `);
}

export async function readRecentNotificationDeliveries(
  dbPath: string,
  options: { since?: string; limit?: number } = {},
): Promise<NotificationDeliveryRecord[]> {
  await initializeLocalStore({ dbPath });
  const limit = options.limit ?? 200;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("Notification delivery limit must be between 1 and 1000.");
  }

  if (options.since !== undefined) {
    assertIsoTimestamp(options.since, "since");
  }

  const rows = queryRows<DeliveryRow>(dbPath, `
    SELECT
      id,
      fingerprint,
      provider_key AS providerKey,
      target,
      outcome,
      reason_code AS reasonCode,
      attempted_at AS attemptedAt,
      next_retry_at AS nextRetryAt,
      metadata_json AS metadataJson
    FROM notification_delivery_runs
    ${options.since === undefined ? "" : `WHERE attempted_at >= ${sqlString(options.since)}`}
    ORDER BY attempted_at DESC, id DESC
    LIMIT ${limit};
  `);

  return rows.map((row) => {
    if (!TARGETS.has(row.target) || !OUTCOMES.has(row.outcome) || !REASONS.has(row.reasonCode)) {
      throw new Error("Notification delivery state contains an invalid enum value.");
    }

    if (row.metadataJson !== EMPTY_METADATA_JSON) {
      throw new Error("Notification delivery metadata must remain empty.");
    }

    return {
      id: row.id,
      fingerprint: row.fingerprint,
      target: row.target,
      outcome: row.outcome,
      reasonCode: row.reasonCode,
      attemptedAt: row.attemptedAt,
      metadataJson: {},
      ...(row.providerKey === null ? {} : { providerKey: row.providerKey }),
      ...(row.nextRetryAt === null ? {} : { nextRetryAt: row.nextRetryAt }),
    };
  });
}

function validateSchedulerState(input: NotificationSchedulerStateInput): void {
  if (!Number.isSafeInteger(input.intervalMinutes) || input.intervalMinutes < 15 || input.intervalMinutes > 1440) {
    throw new Error("Notification interval must be between 15 and 1440 minutes.");
  }

  if (!Number.isSafeInteger(input.jitterSeconds) || input.jitterSeconds < 0 || input.jitterSeconds > 300) {
    throw new Error("Notification jitter must be between 0 and 300 seconds.");
  }

  if (!isClock(input.quietStart) || !isClock(input.quietEnd)) {
    throw new Error("Notification quiet hours must use HH:MM.");
  }

  if (!Number.isSafeInteger(input.consecutiveFailures) || input.consecutiveFailures < 0) {
    throw new Error("Notification failure count must be a non-negative safe integer.");
  }

  assertIsoTimestamp(input.updatedAt, "updatedAt");
  if (input.lastRunAt !== undefined) assertIsoTimestamp(input.lastRunAt, "lastRunAt");
  if (input.nextRunAt !== undefined) assertIsoTimestamp(input.nextRunAt, "nextRunAt");

  if (input.lastErrorCode !== undefined && !SCHEDULER_ERRORS.has(input.lastErrorCode)) {
    throw new Error("Unknown notification scheduler error code.");
  }
}

function validateDelivery(input: NotificationDeliveryInput): void {
  if (!/^[a-f0-9]{64}$/.test(input.fingerprint)) {
    throw new Error("Notification fingerprint must be a SHA-256 digest.");
  }

  if (input.providerKey !== undefined && !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(input.providerKey)) {
    throw new Error("Notification provider key is invalid.");
  }

  if (!TARGETS.has(input.target) || !OUTCOMES.has(input.outcome) || !REASONS.has(input.reasonCode)) {
    throw new Error("Notification delivery enum value is invalid.");
  }

  assertIsoTimestamp(input.attemptedAt, "attemptedAt");
  if (input.nextRetryAt !== undefined) assertIsoTimestamp(input.nextRetryAt, "nextRetryAt");
}

function isClock(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function assertIsoTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new Error(`Notification ${field} must be an ISO timestamp.`);
  }
}

function executeSql(dbPath: string, sql: string): void {
  try {
    execFileSync(resolveSqliteBin(), [dbPath], {
      input: sqliteInput(sql),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
  } catch (caught) {
    if (!shouldFallback(caught)) throw caught;
    const database = createNodeDatabase(dbPath);
    try {
      database.exec(sqliteInput(sql));
    } finally {
      database.close();
    }
  }
}

function queryRows<T>(dbPath: string, sql: string): T[] {
  try {
    const output = execFileSync(resolveSqliteBin(), ["-json", dbPath, sql], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    }).trim();
    return output.length === 0 ? [] : JSON.parse(output) as T[];
  } catch (caught) {
    if (!shouldFallback(caught)) throw caught;
    const database = createNodeDatabase(dbPath);
    try {
      database.exec("PRAGMA foreign_keys = ON;");
      return database.prepare(sql).all() as T[];
    } finally {
      database.close();
    }
  }
}

function createNodeDatabase(dbPath: string): NodeSqliteDatabase {
  const nodeSqlite = requireNodeModule("node:sqlite") as {
    DatabaseSync: new (path: string) => NodeSqliteDatabase;
  };
  return new nodeSqlite.DatabaseSync(dbPath);
}

function shouldFallback(caught: unknown): boolean {
  if (process.env[SQLITE_BIN_ENV_KEY]?.trim()) return false;
  const error = caught as { code?: unknown; message?: unknown };
  return error.code === "ENOENT" || (typeof error.message === "string" && /spawnSync .*ENOENT/i.test(error.message));
}

function sqliteInput(sql: string): string {
  return `PRAGMA foreign_keys = ON;\n${sql.trim()}\n`;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullableString(value: string | undefined): string {
  return value === undefined ? "NULL" : sqlString(value);
}

interface SchedulerRow {
  enabled: 0 | 1;
  intervalMinutes: number;
  jitterSeconds: number;
  quietStart: string;
  quietEnd: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastErrorCode: string | null;
  consecutiveFailures: number;
  updatedAt: string;
}

interface DeliveryRow {
  id: string;
  fingerprint: string;
  providerKey: string | null;
  target: NotificationDeliveryTarget;
  outcome: NotificationDeliveryOutcome;
  reasonCode: NotificationDeliveryReasonCode;
  attemptedAt: string;
  nextRetryAt: string | null;
  metadataJson: string;
}

interface NodeSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): { all(): unknown[] };
  close(): void;
}
