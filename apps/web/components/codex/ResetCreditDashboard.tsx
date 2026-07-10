"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ResetCreditApiFailure,
  ResetCreditApiResponse,
  ResetCreditStatus,
} from "../../lib/codex-reset-credits/types";
import { ResetCreditCard } from "./ResetCreditCard";
import { ResetCreditError } from "./ResetCreditError";

const AUTO_REFRESH_MS = 30 * 60 * 1000;
const TEXT = {
  eyebrow: "MoneySiren · Official Codex App Server",
  title: "Codex 사용량 및 초기화권",
  subtitle: "로컬 Codex App Server의 공식 측정값을 schema v2로 정규화해 표시합니다.",
  loading: "조회 중",
  refresh: "새로고침",
  available: "사용 가능 (availableCount)",
  suppliedDetails: "제공된 상세 (supplied details)",
  coverage: "상세 범위 (coverage)",
  fetchedAt: "마지막 조회 시각",
  source: "측정 소스",
  official: "Official App Server",
  complete: "전체 제공 (complete)",
  partial: "부분 제공 (partial)",
  unavailable: "확인 불가",
  loadingTitle: "조회 중",
  loadingBody: "Codex App Server에서 공식 사용량 정보를 불러오고 있습니다.",
  emptyTitle: "제공된 상세 항목 없음",
  emptyBody: "App Server가 개별 상세 행을 제공하지 않았습니다. availableCount는 별도의 공식 값이며 MoneySiren은 누락된 행을 만들지 않습니다.",
  footer: "availableCount는 App Server가 보고한 권위 있는 값입니다. supplied details는 제한되거나 부분 제공될 수 있으며 MoneySiren은 누락된 크레딧이나 총 지급량을 추정하지 않습니다.",
  fallbackError: "Codex App Server 사용량 정보를 조회하지 못했습니다.",
  countSuffix: "개",
};

type LoadState = "idle" | "loading" | "error";

export function ResetCreditDashboard() {
  const [data, setData] = useState<ResetCreditStatus | null>(null);
  const [error, setError] = useState<ResetCreditApiFailure["error"] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const sortedCredits = useMemo(() => data?.credits ?? [], [data?.credits]);
  const coverageValue = data === null
    ? "-"
    : data.detailsComplete
      ? TEXT.complete
      : TEXT.partial;

  useEffect(() => {
    let mounted = true;

    void load().then((result) => {
      if (mounted) {
        applyResult(result);
      }
    });

    const interval = window.setInterval(() => {
      void refresh();
    }, AUTO_REFRESH_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="reset-credit-page">
      <header className="reset-credit-hero">
        <div>
          <p className="metric-label">{TEXT.eyebrow}</p>
          <h1>{TEXT.title}</h1>
          <p>{TEXT.subtitle}</p>
        </div>
        <button
          className="primary-button"
          disabled={loadState === "loading"}
          onClick={() => {
            void refresh();
          }}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={14} />
          <span>{loadState === "loading" ? TEXT.loading : TEXT.refresh}</span>
        </button>
      </header>

      <section className="reset-credit-summary" aria-label="Codex App Server rate-limit summary">
        <SummaryTile label={TEXT.available} value={formatCount(data?.availableCount)} />
        <SummaryTile
          label={TEXT.suppliedDetails}
          value={data === null ? "-" : formatCount(sortedCredits.length)}
        />
        <SummaryTile
          emphasis={data !== null && !data.detailsComplete}
          label={TEXT.coverage}
          value={coverageValue}
        />
        <SummaryTile
          label={TEXT.fetchedAt}
          value={data === null ? "-" : formatDateTime(data.fetchedAtUtc)}
        />
        <SummaryTile
          label={TEXT.source}
          value={data === null ? "-" : `${TEXT.official} · schema v${data.schemaVersion}`}
        />
      </section>

      {loadState === "error" && error !== null ? (
        <ResetCreditError error={error} />
      ) : null}

      {loadState === "loading" && data === null ? (
        <section className="panel reset-credit-empty">
          <h2>{TEXT.loadingTitle}</h2>
          <p>{TEXT.loadingBody}</p>
        </section>
      ) : null}

      {loadState !== "loading" && data !== null && sortedCredits.length === 0 ? (
        <section className="panel reset-credit-empty">
          <h2>{TEXT.emptyTitle}</h2>
          <p>{TEXT.emptyBody}</p>
        </section>
      ) : null}

      {sortedCredits.length > 0 ? (
        <section className="reset-credit-list" aria-label="Codex reset-credit supplied details">
          {sortedCredits.map((credit) => (
            <ResetCreditCard credit={credit} key={`${credit.index}-${credit.expiresAtUtc ?? "unknown"}`} />
          ))}
        </section>
      ) : null}

      <footer className="reset-credit-footer">
        {TEXT.footer}
      </footer>
    </main>
  );

  async function refresh(): Promise<void> {
    setLoadState("loading");
    const result = await load();
    applyResult(result);
  }

  function applyResult(result: ResetCreditApiResponse): void {
    if (result.ok) {
      setData(result.data);
      setError(null);
      setLoadState("idle");
      return;
    }

    setError(result.error);
    setLoadState("error");
  }
}

async function load(): Promise<ResetCreditApiResponse> {
  try {
    const response = await fetch("/api/codex/reset-credits", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = await response.json() as ResetCreditApiResponse;

    return payload;
  } catch {
    return {
      ok: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: TEXT.fallbackError,
      },
    };
  }
}

function SummaryTile({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={emphasis
        ? "reset-credit-summary-tile reset-credit-summary-tile-warning"
        : "reset-credit-summary-tile"}
    >
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : `${value}${TEXT.countSuffix}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
