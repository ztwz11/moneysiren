import { headers } from "next/headers";
import { detectLocale, getMessages, isLocale, type Locale } from "../../lib/i18n";
import {
  readWebNotificationPreferencesState,
} from "../../lib/local-notification-model";
import { AppLoadingOverlay } from "../../components/AppLoadingOverlay";
import { HudDashboard, type HudDashboardLabels } from "../../components/HudDashboard";
import type { CSSProperties } from "react";

type HudDashboardLocale = Extract<Locale, "ko" | "en" | "ja">;

interface HudPageProps {
  searchParams?: Promise<{
    locale?: string | string[];
  }>;
}

export const dynamic = "force-dynamic";

export default async function HudPage({ searchParams }: HudPageProps) {
  const locale = await readLocale(searchParams);
  const messages = getMessages(locale);
  const { preferences, preferencesStored } = await readWebNotificationPreferencesState();
  const hudStyle = {
    "--hud-background-color": preferences.hud.backgroundColor,
    "--hud-font-color": preferences.hud.fontColor,
    "--hud-font-scale": String(preferences.hud.fontScale),
    "--hud-opacity": String(preferences.hud.opacity),
    "--hud-padding": `${preferences.hud.padding}px`,
    "--hud-row-height": `${preferences.hud.rowHeight}px`,
  } as CSSProperties & Record<
    | "--hud-background-color"
    | "--hud-font-color"
    | "--hud-font-scale"
    | "--hud-opacity"
    | "--hud-padding"
    | "--hud-row-height",
    string
  >;

  return (
    <main className="hud-page" style={hudStyle}>
      <AppLoadingOverlay
        navigationLabel={messages.settings.toolLoadingPreparingView}
        savingLabel={messages.settings.toolLoadingPreparingView}
      />
      <HudDashboard
        controlLabels={{
          alwaysOnTop: messages.settings.hudAlwaysOnTop,
          backgroundNone: hudBackgroundNoneLabel(locale),
          close: messages.settings.hudClose,
          displayMode: hudDisplayModeLabel(locale),
          displayModeCells: hudDisplayModeCellsLabel(locale),
          displayModeRows: hudDisplayModeRowsLabel(locale),
          displayModeSingleLine: hudDisplayModeSingleLineLabel(locale),
          error: messages.settings.notificationPrefsSaveError,
          backgroundColor: messages.settings.hudBackgroundColor,
          fontColor: messages.settings.hudFontColor,
          fontSize: messages.settings.hudFontSize,
          labelMode: hudLabelModeLabel(locale),
          labelModeIcon: hudLabelModeIconLabel(locale),
          labelModeText: hudLabelModeTextLabel(locale),
          minimize: messages.settings.hudMinimize,
          opacity: messages.settings.hudOpacity,
          padding: messages.settings.hudPadding,
          refresh: messages.dashboard.refresh,
          rowHeight: messages.settings.hudRowHeight,
          save: messages.settings.hudSaveSettings,
          saved: messages.settings.notificationPrefsSaved,
          settings: messages.nav.settings,
          showRemainingPercent: messages.settings.hudShowRemainingPercent,
          showUsagePercent: messages.settings.hudShowUsagePercent,
          toolLoadingPreparingView: messages.settings.toolLoadingPreparingView,
        }}
        initialSetupOpen={!preferencesStored}
        initialPreferences={preferences}
        labels={hudLabels(locale, messages)}
        locale={locale}
      />
    </main>
  );
}

function hudBackgroundNoneLabel(locale: Locale): string {
  if (locale === "ko") {
    return "배경 없음";
  }

  if (locale === "ja") {
    return "背景なし";
  }

  return "No background";
}

function hudDisplayModeLabel(locale: Locale): string {
  if (locale === "ko") {
    return "표시 방식";
  }

  if (locale === "ja") {
    return "表示方式";
  }

  return "Display";
}

function hudDisplayModeRowsLabel(locale: Locale): string {
  return locale === "ja" ? "ROW" : "ROW";
}

function hudDisplayModeCellsLabel(locale: Locale): string {
  return locale === "ja" ? "CELL" : "CELL";
}

function hudDisplayModeSingleLineLabel(locale: Locale): string {
  if (locale === "ko") {
    return "한줄";
  }

  if (locale === "ja") {
    return "1行";
  }

  return "One line";
}

function hudLabelModeLabel(locale: Locale): string {
  return locale === "ko" || locale === "ja" ? "Name" : "Name";
}

function hudLabelModeTextLabel(locale: Locale): string {
  return locale === "ko" || locale === "ja" ? "Full name" : "Full name";
}

function hudLabelModeIconLabel(locale: Locale): string {
  return locale === "ko" || locale === "ja" ? "Icon" : "Icon";
}

function hudLabels(locale: Locale, messages: ReturnType<typeof getMessages>): HudDashboardLabels {
  const hudLocale: HudDashboardLocale = locale === "ko" || locale === "ja" ? locale : "en";
  const localized = {
    ko: {
      title: "MoneySiren HUD",
      items: "HUD 항목",
      empty: "표시할 HUD 항목이 없습니다.",
      ok: "정상",
      partial: "부분",
      stale: "오래됨",
      error: "오류",
      freshItems: "최신",
      staleItems: "오래됨",
      errorItems: "오류",
      generatedAt: "생성",
      lastSuccessAt: "마지막 성공",
      syncFailed: "동기화 실패",
      refreshFailed: "새로고침에 실패했습니다.",
      used: "사용",
      remaining: "남음",
      resetAt: "초기화",
      fiveHour: messages.settings.localCliFiveHourWindow,
      weekly: messages.settings.localCliWeeklyWindow,
      context: messages.services.contextPercent,
      resetCredits: messages.services.usageResetCredits,
      resetCreditExpiry: "초기화권 만료일",
      expiresAt: "만료",
      estimatedExpiry: "예상 만료",
      unresolvedCredits: "만료 미확인",
      exact: "정확",
      estimated: "추정",
      bounded: "범위 추정",
      unknown: "알 수 없음",
      active: "활성",
      expiringSoon: "곧 만료",
      expired: "만료됨",
      noExpiry: "만료 정보 없음",
      openTarget: "상세 화면 열기",
    },
    en: {
      title: "MoneySiren HUD",
      items: "HUD items",
      empty: "No HUD items to show.",
      ok: "OK",
      partial: "Partial",
      stale: "Stale",
      error: "Error",
      freshItems: "Fresh",
      staleItems: "Stale",
      errorItems: "Error",
      generatedAt: "Generated",
      lastSuccessAt: "Last success",
      syncFailed: "Sync failed",
      refreshFailed: "Refresh failed.",
      used: "Used",
      remaining: "Left",
      resetAt: "Reset",
      fiveHour: messages.settings.localCliFiveHourWindow,
      weekly: messages.settings.localCliWeeklyWindow,
      context: messages.services.contextPercent,
      resetCredits: messages.services.usageResetCredits,
      resetCreditExpiry: "Reset credit expiry",
      expiresAt: "Expires",
      estimatedExpiry: "Estimated expiry",
      unresolvedCredits: "Unknown expiry",
      exact: "Exact",
      estimated: "Estimated",
      bounded: "Estimated range",
      unknown: "Unknown",
      active: "Active",
      expiringSoon: "Expiring soon",
      expired: "Expired",
      noExpiry: "No expiry",
      openTarget: "Open detail",
    },
    ja: {
      title: "MoneySiren HUD",
      items: "HUD items",
      empty: "No HUD items to show.",
      ok: "OK",
      partial: "Partial",
      stale: "Stale",
      error: "Error",
      freshItems: "Fresh",
      staleItems: "Stale",
      errorItems: "Error",
      generatedAt: "Generated",
      lastSuccessAt: "Last success",
      syncFailed: "Sync failed",
      refreshFailed: "Refresh failed.",
      used: "Used",
      remaining: "Left",
      resetAt: "Reset",
      fiveHour: messages.settings.localCliFiveHourWindow,
      weekly: messages.settings.localCliWeeklyWindow,
      context: messages.services.contextPercent,
      resetCredits: messages.services.usageResetCredits,
      resetCreditExpiry: "リセット権の期限",
      expiresAt: "Expires",
      estimatedExpiry: "Estimated expiry",
      unresolvedCredits: "Unknown expiry",
      exact: "Exact",
      estimated: "Estimated",
      bounded: "Estimated range",
      unknown: "Unknown",
      active: "Active",
      expiringSoon: "Expiring soon",
      expired: "Expired",
      noExpiry: "No expiry",
      openTarget: "Open detail",
    },
  } satisfies Record<HudDashboardLocale, HudDashboardLabels>;

  return localized[hudLocale];
}

async function readLocale(searchParams: HudPageProps["searchParams"]): Promise<Locale> {
  const raw = (await searchParams)?.locale;
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (value !== undefined && isLocale(value)) {
    return value;
  }

  const headerList = await headers();

  return detectLocale(headerList.get("accept-language"));
}
