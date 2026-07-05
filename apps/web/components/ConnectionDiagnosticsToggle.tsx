"use client";

import { useState } from "react";
import {
  buildConnectionDiagnostics,
  type ConnectionDiagnosticSeverity,
} from "../lib/connection-diagnostics";
import type { Locale } from "../lib/i18n";
import type { OperationsProvider } from "../lib/operations-data";

export function ConnectionDiagnosticsToggle({
  locale,
  provider,
}: {
  locale: Locale;
  provider: OperationsProvider;
}) {
  const [expanded, setExpanded] = useState(false);
  const diagnostics = buildConnectionDiagnostics(provider);

  return (
    <section className={`connection-diagnostics connection-diagnostics-${diagnostics.severity}`}>
      <div className="connection-diagnostics-summary">
        <span className={`badge ${badgeClassFor(diagnostics.severity)}`}>{severityLabel(locale, diagnostics.severity)}</span>
        <div>
          <strong>{diagnostics.summary}</strong>
          <p className="metric-meta">{diagnostics.nextAction}</p>
        </div>
        <button
          className="ghost-button"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? collapseLabel(locale) : expandLabel(locale)}
        </button>
      </div>
      {expanded ? (
        <div className="connection-diagnostics-details">
          <p>{diagnostics.primaryCause}</p>
          {diagnostics.details.length === 0 ? (
            <p className="metric-meta">{noDetailsLabel(locale)}</p>
          ) : (
            <ul>
              {diagnostics.details.map((detail) => (
                <li key={detail.code}>
                  <strong>{detail.title}</strong>
                  <div className="metric-meta">{detail.detail}</div>
                  <div>{detail.nextAction}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function expandLabel(locale: Locale): string {
  if (locale === "ko") {
    return "상세 보기";
  }

  if (locale === "ja") {
    return "詳細を表示";
  }

  return "Show details";
}

function collapseLabel(locale: Locale): string {
  if (locale === "ko") {
    return "숨기기";
  }

  if (locale === "ja") {
    return "閉じる";
  }

  return "Hide details";
}

function noDetailsLabel(locale: Locale): string {
  if (locale === "ko") {
    return "표시할 추가 오류가 없습니다.";
  }

  if (locale === "ja") {
    return "追加のエラーはありません。";
  }

  return "No additional errors to show.";
}

function severityLabel(locale: Locale, severity: ConnectionDiagnosticSeverity): string {
  if (locale === "ko") {
    return severity === "critical" ? "긴급" : severity === "warning" ? "주의" : "정상";
  }

  if (locale === "ja") {
    return severity === "critical" ? "緊急" : severity === "warning" ? "注意" : "正常";
  }

  return severity;
}

function badgeClassFor(severity: ConnectionDiagnosticSeverity): string {
  if (severity === "critical") {
    return "badge-critical";
  }

  return severity === "warning" ? "badge-warn" : "badge-ok";
}
