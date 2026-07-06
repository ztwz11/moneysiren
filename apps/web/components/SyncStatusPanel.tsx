import {
  buildProviderSyncPolicy,
  type ProviderSyncPolicy,
} from "../lib/sync-policy";
import type { Locale } from "../lib/i18n";
import type { OperationsProvider } from "../lib/operations-data";

export function SyncStatusPanel({
  locale,
  provider,
  now = new Date(),
}: {
  locale: Locale;
  provider: OperationsProvider;
  now?: Date;
}) {
  const policy = buildProviderSyncPolicy(provider, now);

  return (
    <div className="stack">
      <p className="muted">{policy.summary}</p>
      <div className="badge-row">
        <StatusBadge status={policy.canonicalStatus} />
        <StatusBadge status={policy.liveStatus} />
      </div>
      <div className="key-value-grid">
        <KeyValue label={label(locale, "lastCanonical")} value={provider.latestCanonicalSync ?? label(locale, "missing")} />
        <KeyValue label={label(locale, "lastLive")} value={provider.latestLiveCheck ?? label(locale, "missing")} />
        <KeyValue label={label(locale, "canonicalInterval")} value={formatMinutes(policy.recommendedCanonicalIntervalMinutes, locale)} />
        <KeyValue label={label(locale, "liveTtl")} value={formatSeconds(policy.recommendedLiveTtlSeconds, locale)} />
      </div>
      {policy.initialSyncRequired ? (
        <div className="notification-preview">
          <span>{label(locale, "initialSync")}</span>
          <code>{policy.syncCommand}</code>
        </div>
      ) : (
        <div className="notification-preview">
          <span>{label(locale, "manualSync")}</span>
          <code>{policy.syncCommand}</code>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ProviderSyncPolicy["canonicalStatus"] | ProviderSyncPolicy["liveStatus"] }) {
  return <span className={`badge ${badgeClassFor(status)}`}>{status.replace(/_/g, " ")}</span>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function label(locale: Locale, key: "lastCanonical" | "lastLive" | "canonicalInterval" | "liveTtl" | "initialSync" | "manualSync" | "missing"): string {
  const ko = {
    lastCanonical: "마지막 확정 동기화",
    lastLive: "마지막 실시간 확인",
    canonicalInterval: "권장 확정 동기화 주기",
    liveTtl: "권장 실시간 TTL",
    initialSync: "초기 동기화가 필요합니다",
    manualSync: "수동 확정 동기화",
    missing: "없음",
  };
  const ja = {
    lastCanonical: "最終確定同期",
    lastLive: "最終ライブ確認",
    canonicalInterval: "推奨確定同期間隔",
    liveTtl: "推奨ライブTTL",
    initialSync: "初回同期が必要です",
    manualSync: "手動確定同期",
    missing: "なし",
  };
  const en = {
    lastCanonical: "Last canonical sync",
    lastLive: "Last live check",
    canonicalInterval: "Recommended canonical interval",
    liveTtl: "Recommended live TTL",
    initialSync: "Initial sync required",
    manualSync: "Manual canonical sync",
    missing: "missing",
  };

  return locale === "ko" ? ko[key] : locale === "ja" ? ja[key] : en[key];
}

function formatMinutes(minutes: number, locale: Locale): string {
  const hours = minutes / 60;

  if (Number.isInteger(hours) && hours >= 1) {
    return locale === "ko" ? `${hours}시간` : locale === "ja" ? `${hours}時間` : `${hours}h`;
  }

  return locale === "ko" ? `${minutes}분` : locale === "ja" ? `${minutes}分` : `${minutes}m`;
}

function formatSeconds(seconds: number, locale: Locale): string {
  return locale === "ko" ? `${seconds}초` : locale === "ja" ? `${seconds}秒` : `${seconds}s`;
}

function badgeClassFor(status: string): string {
  if (status.endsWith("fresh")) {
    return "badge-ok";
  }

  if (status.endsWith("error")) {
    return "badge-critical";
  }

  return "badge-warn";
}
