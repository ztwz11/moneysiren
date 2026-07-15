"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "../lib/i18n";
import { createLocalDashboardSession } from "../lib/local-client";

type Granularity = "day" | "week" | "month";
type ProviderKey = "codex-cli" | "claude-cli";

interface UsageHistoryRow {
  providerKey: ProviderKey;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  sourceScope: "dedicated" | "shared_fallback";
  observedAt: string;
  firstActivityAt: string | null;
  latestActivityAt: string | null;
  activityCount: number;
  sessionCount: number;
  turnCount: number;
  toolCallCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  coverage: "complete" | "partial";
}

interface UsageHistoryResponse {
  rows: UsageHistoryRow[];
  localOnly: true;
  secretsReturned: false;
}

interface Copy {
  title: string;
  description: string;
  day: string;
  week: string;
  month: string;
  sync: string;
  syncing: string;
  loading: string;
  empty: string;
  error: string;
  period: string;
  provider: string;
  activity: string;
  sessions: string;
  turns: string;
  tools: string;
  input: string;
  output: string;
  cache: string;
  reasoning: string;
  total: string;
  coverage: string;
  latest: string;
  complete: string;
  partial: string;
}

const COPY = {
  en: {
    title: "Saved usage history",
    description: "Local numeric buckets only. Prompts, commands, paths, auth data, and raw logs are never stored.",
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
    sync: "Scan and save",
    syncing: "Saving…",
    loading: "Loading saved usage…",
    empty: "No saved usage in this period. Scan local usage to create safe numeric buckets.",
    error: "Usage history is unavailable.",
    period: "Period",
    provider: "Provider",
    activity: "Activity",
    sessions: "Sessions",
    turns: "Turns",
    tools: "Tools",
    input: "Input",
    output: "Output",
    cache: "Cache",
    reasoning: "Reasoning",
    total: "Total",
    coverage: "Coverage",
    latest: "Latest",
    complete: "Complete",
    partial: "Partial",
  },
  ko: {
    title: "저장된 사용량 이력",
    description: "로컬 숫자 버킷만 저장합니다. 프롬프트, 명령문, 경로, 인증 정보, 원본 로그는 저장하지 않습니다.",
    day: "일별",
    week: "주별",
    month: "월별",
    sync: "스캔 후 저장",
    syncing: "저장 중…",
    loading: "저장된 사용량을 불러오는 중…",
    empty: "이 기간에 저장된 사용량이 없습니다. 로컬 사용량을 스캔해 안전한 숫자 버킷을 만드세요.",
    error: "사용량 이력을 불러올 수 없습니다.",
    period: "기간",
    provider: "제공자",
    activity: "활동",
    sessions: "세션",
    turns: "턴",
    tools: "도구",
    input: "입력",
    output: "출력",
    cache: "캐시",
    reasoning: "추론",
    total: "합계",
    coverage: "수집 범위",
    latest: "최근 활동",
    complete: "완전",
    partial: "부분",
  },
  ja: {
    title: "保存された使用履歴",
    description: "ローカルの数値バケットだけを保存します。プロンプト、コマンド、パス、認証情報、生ログは保存しません。",
    day: "日別",
    week: "週別",
    month: "月別",
    sync: "スキャンして保存",
    syncing: "保存中…",
    loading: "保存済み使用量を読み込み中…",
    empty: "この期間に保存された使用量はありません。ローカル使用量をスキャンしてください。",
    error: "使用履歴を取得できません。",
    period: "期間",
    provider: "プロバイダー",
    activity: "アクティビティ",
    sessions: "セッション",
    turns: "ターン",
    tools: "ツール",
    input: "入力",
    output: "出力",
    cache: "キャッシュ",
    reasoning: "推論",
    total: "合計",
    coverage: "収集範囲",
    latest: "最新",
    complete: "完全",
    partial: "部分",
  },
} satisfies Partial<Record<Locale, Copy>>;

export function LocalAiUsageHistory({
  locale,
  providerKey,
  timezone,
}: {
  locale: Locale;
  providerKey: ProviderKey;
  timezone: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.en;
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [rows, setRows] = useState<UsageHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);
  const range = useMemo(() => historyRange(timezone), [timezone]);
  const query = useMemo(() => new URLSearchParams({
    from: range.from,
    granularity,
    provider: providerKey,
    timezone,
    to: range.to,
  }).toString(), [granularity, providerKey, range, timezone]);

  const loadSaved = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);

    try {
      const response = await fetch(`/api/local-ai/usage-history?${query}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: signal ?? null,
      });

      if (!response.ok) {
        throw new Error("Local AI usage history request failed.");
      }

      const payload = parseResponse(await response.json());
      setRows(payload.rows);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFailed(true);
      }
    } finally {
      if (signal?.aborted !== true) {
        setLoading(false);
      }
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSaved(controller.signal);
    return () => controller.abort();
  }, [loadSaved]);

  async function syncUsage(): Promise<void> {
    setSyncing(true);
    setFailed(false);

    try {
      const session = await createLocalDashboardSession();
      const response = await fetch(`/api/local-ai/usage-history?${query}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "X-MoneySiren-CSRF": session.csrfToken,
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Local AI usage history sync failed.");
      }

      const payload = parseResponse(await response.json());
      setRows(payload.rows);
    } catch {
      setFailed(true);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">{copy.title}</h2>
          <p className="metric-meta">{copy.description}</p>
        </div>
        <div className="panel-actions">
          <nav aria-label={copy.title} className="segmented-control">
            {(["day", "week", "month"] as const).map((value) => (
              <button
                className={granularity === value ? "segment segment-active" : "segment"}
                key={value}
                onClick={() => setGranularity(value)}
                type="button"
              >
                {copy[value]}
              </button>
            ))}
          </nav>
          <button className="ghost-button" disabled={syncing} onClick={() => void syncUsage()} type="button">
            {syncing ? copy.syncing : copy.sync}
          </button>
        </div>
      </div>
      {failed ? <div className="empty-state">{copy.error}</div> : null}
      {!failed && loading ? <div className="empty-state">{copy.loading}</div> : null}
      {!failed && !loading && rows.length === 0 ? <div className="empty-state">{copy.empty}</div> : null}
      {!failed && !loading && rows.length > 0 ? (
        <div className="data-table-wrap">
          <table className="data-table usage-service-table">
            <thead>
              <tr>
                <th>{copy.period}</th>
                <th>{copy.provider}</th>
                <th>{copy.activity}</th>
                <th>{copy.sessions}</th>
                <th>{copy.turns}</th>
                <th>{copy.tools}</th>
                <th>{copy.input}</th>
                <th>{copy.output}</th>
                <th>{copy.cache}</th>
                <th>{copy.reasoning}</th>
                <th>{copy.total}</th>
                <th>{copy.coverage}</th>
                <th>{copy.latest}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.providerKey}:${row.periodStart}:${row.sourceScope}`}>
                  <td>{formatPeriod(row, granularity, locale)}</td>
                  <td>{row.providerKey === "codex-cli" ? "Codex CLI" : "Claude CLI"}</td>
                  <td>{formatNumber(row.activityCount, locale)}</td>
                  <td>{formatNumber(row.sessionCount, locale)}</td>
                  <td>{formatNumber(row.turnCount, locale)}</td>
                  <td>{formatNumber(row.toolCallCount, locale)}</td>
                  <td>{formatNullableNumber(row.inputTokens, locale)}</td>
                  <td>{formatNullableNumber(row.outputTokens, locale)}</td>
                  <td>{formatNullableNumber(row.cacheTokens, locale)}</td>
                  <td>{formatNullableNumber(row.reasoningTokens, locale)}</td>
                  <td><strong>{formatNullableNumber(row.totalTokens, locale)}</strong></td>
                  <td>{row.coverage === "complete" ? copy.complete : copy.partial}</td>
                  <td>{formatTimestamp(row.latestActivityAt, locale, timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function historyRange(timezone: string): { from: string; to: string } {
  const to = dateKeyInTimeZone(new Date(), timezone);
  const fromDate = new Date(`${to}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 399);

  return { from: fromDate.toISOString().slice(0, 10), to };
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

function formatPeriod(row: UsageHistoryRow, granularity: Granularity, locale: Locale): string {
  const start = formatDateKey(row.periodStart, locale);
  return granularity === "day" ? start : `${start} – ${formatDateKey(row.periodEnd, locale)}`;
}

function formatDateKey(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatTimestamp(value: string | null, locale: Locale, timezone: string): string {
  if (value === null) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatNullableNumber(value: number | null, locale: Locale): string {
  return value === null ? "—" : formatNumber(value, locale);
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function parseResponse(value: unknown): UsageHistoryResponse {
  if (!isRecord(value) || value.localOnly !== true || value.secretsReturned !== false || !Array.isArray(value.rows)) {
    throw new Error("Local AI usage history response is invalid.");
  }

  return {
    rows: value.rows.map(parseRow),
    localOnly: true,
    secretsReturned: false,
  };
}

function parseRow(value: unknown): UsageHistoryRow {
  if (!isRecord(value)) {
    throw new Error("Local AI usage history row is invalid.");
  }

  const providerKey = value.providerKey;
  const coverage = value.coverage;
  const sourceScope = value.sourceScope;

  if (
    (providerKey !== "codex-cli" && providerKey !== "claude-cli") ||
    (coverage !== "complete" && coverage !== "partial") ||
    (sourceScope !== "dedicated" && sourceScope !== "shared_fallback")
  ) {
    throw new Error("Local AI usage history row enum is invalid.");
  }

  return {
    providerKey,
    periodStart: requiredString(value.periodStart),
    periodEnd: requiredString(value.periodEnd),
    timezone: requiredString(value.timezone),
    sourceScope,
    observedAt: requiredString(value.observedAt),
    firstActivityAt: nullableString(value.firstActivityAt),
    latestActivityAt: nullableString(value.latestActivityAt),
    activityCount: requiredNumber(value.activityCount),
    sessionCount: requiredNumber(value.sessionCount),
    turnCount: requiredNumber(value.turnCount),
    toolCallCount: requiredNumber(value.toolCallCount),
    inputTokens: nullableNumber(value.inputTokens),
    outputTokens: nullableNumber(value.outputTokens),
    cacheTokens: nullableNumber(value.cacheTokens),
    reasoningTokens: nullableNumber(value.reasoningTokens),
    totalTokens: nullableNumber(value.totalTokens),
    coverage,
  };
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Local AI usage history text is invalid.");
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : requiredString(value);
}

function requiredNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Local AI usage history number is invalid.");
  }
  return value;
}

function nullableNumber(value: unknown): number | null {
  return value === null ? null : requiredNumber(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
