import { access } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import {
  readLocalAiUsageHistory,
  saveLocalAiUsageDaily,
  type LocalAiUsageGranularity,
  type LocalAiUsageHistoryRow,
} from "../../../packages/db/src/index";
import {
  readLocalAiUsageDaily,
  type LocalAiUsageHistoryProviderKey,
} from "./local-tools";

const DEFAULT_DB_PATH = ".moneysiren/moneysiren.sqlite";
const DEFAULT_TIMEZONE = "Asia/Seoul";
const DEFAULT_HISTORY_DAYS = 400;
const MAX_HISTORY_DAYS = 4_000;
const PARSER_VERSION = "local-ai-history-v1";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface LocalAiUsageHistoryOptions {
  from?: string;
  to?: string;
  granularity?: LocalAiUsageGranularity;
  providerKeys?: readonly LocalAiUsageHistoryProviderKey[];
  timezone?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
}

export interface LocalAiUsageHistorySnapshot {
  generatedAt: string;
  from: string;
  to: string;
  granularity: LocalAiUsageGranularity;
  timezone: string;
  rows: LocalAiUsageHistoryRow[];
  localOnly: true;
  secretsReturned: false;
}

export async function readStoredLocalAiUsageHistory(
  options: LocalAiUsageHistoryOptions = {},
): Promise<LocalAiUsageHistorySnapshot> {
  const query = normalizeHistoryOptions(options);
  const dbPath = resolveDbPath(query.cwd, query.env.MONEYSIREN_DB_PATH);
  const rows = await pathExists(dbPath)
    ? await readLocalAiUsageHistory({
      dbPath,
      from: query.from,
      to: query.to,
      granularity: query.granularity,
      providerKeys: query.providerKeys,
    })
    : [];

  return safeSnapshot(query, rows.filter((row) => row.timezone === query.timezone));
}

export async function syncLocalAiUsageHistory(
  options: LocalAiUsageHistoryOptions = {},
): Promise<LocalAiUsageHistorySnapshot> {
  const query = normalizeHistoryOptions(options);
  const dbPath = resolveDbPath(query.cwd, query.env.MONEYSIREN_DB_PATH);
  const observedAt = query.now.toISOString();
  const rows = await readLocalAiUsageDaily({
    env: query.env,
    historyDays: historyDaysForSync(query),
    now: () => query.now,
    providerKeys: query.providerKeys,
    timezone: query.timezone,
  });

  await saveLocalAiUsageDaily({
    dbPath,
    rows: rows.map((row) => ({
      ...row,
      observedAt,
      parserVersion: PARSER_VERSION,
      localOnly: true,
      secretsReturned: false,
    })),
  });

  const storedRows = await readLocalAiUsageHistory({
    dbPath,
    from: query.from,
    to: query.to,
    granularity: query.granularity,
    providerKeys: query.providerKeys,
  });

  return safeSnapshot(query, storedRows.filter((row) => row.timezone === query.timezone));
}

interface NormalizedHistoryOptions {
  from: string;
  to: string;
  granularity: LocalAiUsageGranularity;
  providerKeys: readonly LocalAiUsageHistoryProviderKey[];
  timezone: string;
  cwd: string;
  env: Record<string, string | undefined>;
  now: Date;
}

function normalizeHistoryOptions(options: LocalAiUsageHistoryOptions): NormalizedHistoryOptions {
  const now = (options.now ?? (() => new Date()))();
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;
  const to = options.to ?? dateKeyInTimeZone(now, timezone);
  const from = options.from ?? shiftDate(to, -(DEFAULT_HISTORY_DAYS - 1));
  const granularity = options.granularity ?? "day";
  const providerKeys = options.providerKeys ?? ["codex-cli", "claude-cli"];

  assertTimeZone(timezone);
  assertDate(from, "from");
  assertDate(to, "to");

  if (from > to || inclusiveDayCount(from, to) > MAX_HISTORY_DAYS) {
    throw new Error("Local AI usage history range is invalid.");
  }

  if (granularity !== "day" && granularity !== "week" && granularity !== "month") {
    throw new Error("Local AI usage history granularity is invalid.");
  }

  if (providerKeys.length === 0 || providerKeys.some((key) => key !== "codex-cli" && key !== "claude-cli")) {
    throw new Error("Local AI usage history provider is invalid.");
  }

  return {
    from,
    to,
    granularity,
    providerKeys,
    timezone,
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    now,
  };
}

function safeSnapshot(
  query: NormalizedHistoryOptions,
  rows: readonly LocalAiUsageHistoryRow[],
): LocalAiUsageHistorySnapshot {
  return {
    generatedAt: query.now.toISOString(),
    from: query.from,
    to: query.to,
    granularity: query.granularity,
    timezone: query.timezone,
    rows: rows.map((row) => ({
      providerKey: row.providerKey,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      timezone: row.timezone,
      sourceScope: row.sourceScope,
      observedAt: row.observedAt,
      firstActivityAt: row.firstActivityAt,
      latestActivityAt: row.latestActivityAt,
      activityCount: row.activityCount,
      sessionCount: row.sessionCount,
      turnCount: row.turnCount,
      toolCallCount: row.toolCallCount,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cacheTokens: row.cacheTokens,
      reasoningTokens: row.reasoningTokens,
      totalTokens: row.totalTokens,
      coverage: row.coverage,
    })),
    localOnly: true,
    secretsReturned: false,
  };
}

function resolveDbPath(cwd: string, configuredPath: string | undefined): string {
  const rawPath = configuredPath === undefined || configuredPath.trim().length === 0
    ? DEFAULT_DB_PATH
    : configuredPath.trim();

  return isAbsolute(rawPath) ? rawPath : join(cwd, rawPath);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function inclusiveDayCount(from: string, to: string): number {
  return Math.floor((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / 86_400_000) + 1;
}

function historyDaysForSync(query: NormalizedHistoryOptions): number {
  const today = dateKeyInTimeZone(query.now, query.timezone);
  const historyDays = query.from > today ? 1 : inclusiveDayCount(query.from, today);

  if (historyDays > MAX_HISTORY_DAYS) {
    throw new Error("Local AI usage history scan range is invalid.");
  }

  return historyDays;
}

function shiftDate(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function assertDate(value: string, field: string): void {
  if (!DATE_PATTERN.test(value) || dateFromKey(value).toISOString().slice(0, 10) !== value) {
    throw new Error(`Local AI usage history ${field} is invalid.`);
  }
}

function assertTimeZone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error("Local AI usage history timezone is invalid.");
  }
}

function dateKeyInTimeZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}
