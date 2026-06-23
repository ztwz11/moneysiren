"use client";

import { Power } from "lucide-react";
import { useEffect, useState } from "react";
import { stopLocalWebRuntime } from "../lib/local-client";
import type { Locale } from "../lib/i18n";

const COPY = {
  en: {
    button: "Stop local web runtime",
    confirm: "Stop the local MoneySiren web runtime? This browser page will disconnect.",
    loading: "Stopping local runtime",
    failed: "Could not stop the local runtime.",
  },
  ko: {
    button: "로컬 웹 런타임 종료",
    confirm: "MoneySiren 로컬 웹 런타임을 종료할까요? 이 브라우저 페이지 연결이 끊어집니다.",
    loading: "로컬 런타임 종료 중",
    failed: "로컬 런타임을 종료하지 못했습니다.",
  },
  ja: {
    button: "ローカルWebランタイムを停止",
    confirm: "MoneySiren のローカルWebランタイムを停止しますか？このブラウザページは切断されます。",
    loading: "ローカルランタイムを停止中",
    failed: "ローカルランタイムを停止できませんでした。",
  },
} satisfies Record<Locale, {
  button: string;
  confirm: string;
  failed: string;
  loading: string;
}>;

export function RuntimeShutdownButton({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const [isStopping, setIsStopping] = useState(false);
  const [progress, setProgress] = useState(10);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isStopping) {
      setProgress(10);
      return;
    }

    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(current + Math.max(1, (95 - current) * 0.16), 95));
    }, 220);

    return () => window.clearInterval(interval);
  }, [isStopping]);

  return (
    <>
      <button
        aria-busy={isStopping}
        className="ghost-button runtime-stop-button"
        disabled={isStopping}
        onClick={() => {
          if (isStopping || !window.confirm(copy.confirm)) {
            return;
          }

          setError(null);
          setIsStopping(true);
          void stopLocalWebRuntime().catch(() => {
            setIsStopping(false);
            setError(copy.failed);
          });
        }}
        type="button"
      >
        <Power aria-hidden="true" size={14} />
        <span>{copy.button}</span>
      </button>
      {error === null ? null : <p className="form-error-text">{error}</p>}
      {isStopping ? (
        <div className="app-loading-overlay" aria-live="polite" aria-busy="true" role="status">
          <div className="app-loading-card">
            <div className="app-loading-label">{copy.loading}</div>
            <div className="app-loading-track" aria-hidden="true">
              <span className="app-loading-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
