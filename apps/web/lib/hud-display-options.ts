import type { HudDisplayMode, HudLabelMode, NotificationWidgetKey } from "../components/NotificationSettingsModel";
import type { Locale } from "./i18n";

export interface HudWidgetDisplayExample {
  shortLabel: string;
  example: string;
}

export type HudPercentPreviewMode = "usage" | "remaining";

export interface HudPreviewOptions {
  labelMode?: HudLabelMode;
  locale?: Locale;
  percentMode?: HudPercentPreviewMode;
}

export interface HudDisplayPreviewOptions extends Required<HudPreviewOptions> {
  displayMode: HudDisplayMode;
  selectedWidgets: readonly NotificationWidgetKey[];
}

const HUD_PREVIEW_SEPARATOR = " · ";

export const HUD_WIDGET_DISPLAY_EXAMPLES = {
  month_forecast: {
    shortLabel: "Month estimate",
    example: "Month estimate US$14.7",
  },
  today_live_cost: {
    shortLabel: "Today live",
    example: "Today live US$0.84",
  },
  risk_high_count: {
    shortLabel: "High risks",
    example: "High risks 2",
  },
  stale_connection_count: {
    shortLabel: "Stale connections",
    example: "Stale connections 3",
  },
  aws_month_forecast: {
    shortLabel: "AWS estimate",
    example: "AWS estimate US$7.6",
  },
  openai_today_cost: {
    shortLabel: "OpenAI cost",
    example: "OpenAI cost US$0.42",
  },
  openai_today_tokens: {
    shortLabel: "OpenAI API TK",
    example: "OpenAI API TK 172k",
  },
  codex_total_tokens: {
    shortLabel: "Codex total tokens",
    example: "Codex total tokens 1.9m",
  },
  claude_five_hour_percent: {
    shortLabel: "Claude 5h",
    example: "Claude 5h 22%",
  },
  claude_weekly_percent: {
    shortLabel: "Claude weekly",
    example: "Claude weekly 31%",
  },
  codex_five_hour_percent: {
    shortLabel: "Codex 5h",
    example: "Codex 5h 22%",
  },
  codex_weekly_percent: {
    shortLabel: "Codex weekly",
    example: "Codex weekly 31%",
  },
  codex_reset_credit_count: {
    shortLabel: "Codex reset credits",
    example: "Codex reset credits 2",
  },
  codex_reset_credit_expiry: {
    shortLabel: "Codex reset expiry",
    example: "2026-08-11",
  },
  supabase_usage_health: {
    shortLabel: "Supabase health",
    example: "Supabase health OK",
  },
  cloudflare_month_to_date: {
    shortLabel: "Cloudflare month",
    example: "Cloudflare month US$1.2",
  },
} satisfies Record<NotificationWidgetKey, HudWidgetDisplayExample>;

export const HUD_DISPLAY_MODE_EXAMPLES = {
  rows: "Codex · 5h | Used 22%",
  cells: "Codex 5h 22%",
  singleLine: "Codex 5h 22% · Codex weekly 31% · Codex reset credits 2",
} satisfies Record<HudDisplayMode, string>;

export function buildHudDisplayPreview(options: HudDisplayPreviewOptions): string {
  const labels = hudPreviewLabels(options.locale);
  const percentLabel = options.percentMode === "remaining" ? labels.remaining : labels.used;
  const percentValue = options.percentMode === "remaining" ? "78%" : "22%";

  if (options.displayMode === "singleLine") {
    return buildHudCompactPreview(options.selectedWidgets, options);
  }

  if (options.displayMode === "cells") {
    return options.labelMode === "icon"
      ? `${labels.iconOnly} ${percentValue}`
      : `Codex ${labels.fiveHour} ${percentValue}`;
  }

  return options.labelMode === "icon"
    ? `${labels.iconOnly} | ${percentLabel} ${percentValue}`
    : `Codex${HUD_PREVIEW_SEPARATOR}${labels.fiveHour} | ${percentLabel} ${percentValue}`;
}

export function buildHudCompactPreview(
  selectedWidgets: readonly NotificationWidgetKey[],
  options: HudPreviewOptions = {},
): string {
  const examples = selectedWidgets.map((widgetKey) => getHudWidgetDisplayExample(widgetKey, options).example);

  return examples.length === 0
    ? getHudWidgetDisplayExample("codex_five_hour_percent", options).example
    : examples.join(HUD_PREVIEW_SEPARATOR);
}

export function getHudWidgetDisplayExample(
  widgetKey: NotificationWidgetKey,
  options: HudPreviewOptions = {},
): HudWidgetDisplayExample {
  const labels = hudPreviewLabels(options.locale ?? "en");
  const labelMode = options.labelMode ?? "text";
  const percentMode = options.percentMode ?? "usage";
  const label = widgetPreviewLabel(widgetKey, labels);
  const value = widgetPreviewValue(widgetKey, percentMode);
  if (widgetKey === "codex_reset_credit_expiry") {
    return {
      shortLabel: label,
      example: value,
    };
  }

  const visibleLabel = labelMode === "icon" ? labels.iconOnly : label;

  return {
    shortLabel: label,
    example: `${visibleLabel} ${value}`,
  };
}

export function formatHudDateOnly(value: string, timeZone = "Asia/Seoul"): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function calculateHudSummaryScale(availableWidth: number, naturalWidth: number): number {
  if (availableWidth <= 0 || naturalWidth <= 0) {
    return 1;
  }

  return Math.min(1, availableWidth / naturalWidth);
}

export function shouldUseCompactHudIcons(
  availableWidth: number,
  fullLabelWidth: number,
  minimumReadableScale = 0.72,
): boolean {
  return calculateHudSummaryScale(availableWidth, fullLabelWidth) < minimumReadableScale;
}

interface HudPreviewLabels {
  awsEstimate: string;
  cloudflareMonth: string;
  codexFiveHour: string;
  codexTotalTokens: string;
  codexResetCreditCount: string;
  codexResetCreditExpiry: string;
  codexWeekly: string;
  claudeFiveHour: string;
  claudeWeekly: string;
  fiveHour: string;
  highRisks: string;
  iconOnly: string;
  monthEstimate: string;
  openaiCost: string;
  openaiTokens: string;
  remaining: string;
  staleConnections: string;
  supabaseHealth: string;
  todayLive: string;
  used: string;
}

function hudPreviewLabels(locale: Locale = "en"): HudPreviewLabels {
  if (locale === "ko") {
    return {
      awsEstimate: "AWS 예상",
      cloudflareMonth: "Cloudflare 월간",
      codexFiveHour: "Codex 5시간",
      codexTotalTokens: "Codex 전체 토큰",
      codexResetCreditCount: "Codex 초기화권",
      codexResetCreditExpiry: "Codex 초기화권 만료일",
      codexWeekly: "Codex 1주",
      claudeFiveHour: "Claude 5시간",
      claudeWeekly: "Claude 1주",
      fiveHour: "5시간",
      highRisks: "높은 리스크",
      iconOnly: "[아이콘]",
      monthEstimate: "이번 달 예상",
      openaiCost: "OpenAI 비용",
      openaiTokens: "OpenAI API TK",
      remaining: "남음",
      staleConnections: "오래된 연결",
      supabaseHealth: "Supabase 상태",
      todayLive: "오늘 실시간",
      used: "사용",
    };
  }

  if (locale === "ja") {
    return {
      awsEstimate: "AWS estimate",
      cloudflareMonth: "Cloudflare month",
      codexFiveHour: "Codex 5h",
      codexTotalTokens: "Codex total tokens",
      codexResetCreditCount: "Codex reset credits",
      codexResetCreditExpiry: "Codex reset expiry",
      codexWeekly: "Codex weekly",
      claudeFiveHour: "Claude 5h",
      claudeWeekly: "Claude weekly",
      fiveHour: "5h",
      highRisks: "High risks",
      iconOnly: "[icon]",
      monthEstimate: "Month estimate",
      openaiCost: "OpenAI cost",
      openaiTokens: "OpenAI API TK",
      remaining: "Left",
      staleConnections: "Stale connections",
      supabaseHealth: "Supabase health",
      todayLive: "Today live",
      used: "Used",
    };
  }

  return {
    awsEstimate: "AWS estimate",
    cloudflareMonth: "Cloudflare month",
    codexFiveHour: "Codex 5h",
    codexTotalTokens: "Codex total tokens",
    codexResetCreditCount: "Codex reset credits",
    codexResetCreditExpiry: "Codex reset expiry",
    codexWeekly: "Codex weekly",
    claudeFiveHour: "Claude 5h",
    claudeWeekly: "Claude weekly",
    fiveHour: "5h",
    highRisks: "High risks",
    iconOnly: "[icon]",
    monthEstimate: "Month estimate",
    openaiCost: "OpenAI cost",
    openaiTokens: "OpenAI API TK",
    remaining: "Left",
    staleConnections: "Stale connections",
    supabaseHealth: "Supabase health",
    todayLive: "Today live",
    used: "Used",
  };
}

function widgetPreviewLabel(widgetKey: NotificationWidgetKey, labels: HudPreviewLabels): string {
  const widgetLabels = {
    aws_month_forecast: labels.awsEstimate,
    claude_five_hour_percent: labels.claudeFiveHour,
    claude_weekly_percent: labels.claudeWeekly,
    cloudflare_month_to_date: labels.cloudflareMonth,
    codex_five_hour_percent: labels.codexFiveHour,
    codex_total_tokens: labels.codexTotalTokens,
    codex_reset_credit_count: labels.codexResetCreditCount,
    codex_reset_credit_expiry: labels.codexResetCreditExpiry,
    codex_weekly_percent: labels.codexWeekly,
    month_forecast: labels.monthEstimate,
    openai_today_cost: labels.openaiCost,
    openai_today_tokens: labels.openaiTokens,
    risk_high_count: labels.highRisks,
    stale_connection_count: labels.staleConnections,
    supabase_usage_health: labels.supabaseHealth,
    today_live_cost: labels.todayLive,
  } satisfies Record<NotificationWidgetKey, string>;

  return widgetLabels[widgetKey];
}

function widgetPreviewValue(
  widgetKey: NotificationWidgetKey,
  percentMode: HudPercentPreviewMode,
): string {
  const codexFiveHourPercent = percentMode === "remaining" ? "78%" : "22%";
  const codexWeeklyPercent = percentMode === "remaining" ? "69%" : "31%";

  const widgetValues = {
    aws_month_forecast: "US$7.6",
    claude_five_hour_percent: codexFiveHourPercent,
    claude_weekly_percent: codexWeeklyPercent,
    cloudflare_month_to_date: "US$1.2",
    codex_five_hour_percent: codexFiveHourPercent,
    codex_total_tokens: "1.9m",
    codex_reset_credit_count: "2",
    codex_reset_credit_expiry: "2026-08-11",
    codex_weekly_percent: codexWeeklyPercent,
    month_forecast: "US$14.7",
    openai_today_cost: "US$0.42",
    openai_today_tokens: "172k",
    risk_high_count: "2",
    stale_connection_count: "3",
    supabase_usage_health: "OK",
    today_live_cost: "US$0.84",
  } satisfies Record<NotificationWidgetKey, string>;

  return widgetValues[widgetKey];
}
