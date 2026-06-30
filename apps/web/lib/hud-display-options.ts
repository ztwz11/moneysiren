import type { HudDisplayMode, NotificationWidgetKey } from "../components/NotificationSettingsModel";

export interface HudWidgetDisplayExample {
  shortLabel: string;
  example: string;
}

export const HUD_WIDGET_DISPLAY_EXAMPLES = {
  month_forecast: {
    shortLabel: "M",
    example: "M $14.7",
  },
  today_live_cost: {
    shortLabel: "T",
    example: "T $0.84",
  },
  risk_high_count: {
    shortLabel: "Risk",
    example: "Risk 2",
  },
  stale_connection_count: {
    shortLabel: "Stale",
    example: "Stale 3",
  },
  aws_month_forecast: {
    shortLabel: "AWS",
    example: "AWS $7.6",
  },
  openai_today_cost: {
    shortLabel: "OAI$",
    example: "OAI $0.42",
  },
  openai_today_tokens: {
    shortLabel: "OAI",
    example: "OAI 172k",
  },
  claude_five_hour_percent: {
    shortLabel: "CL 5h",
    example: "CL 5h 78%",
  },
  claude_weekly_percent: {
    shortLabel: "CL W",
    example: "CL W 69%",
  },
  codex_five_hour_percent: {
    shortLabel: "MS 5h",
    example: "MS 5h 78%",
  },
  codex_weekly_percent: {
    shortLabel: "W",
    example: "W 69%",
  },
  codex_reset_credit_count: {
    shortLabel: "R",
    example: "R2",
  },
  codex_reset_credit_expiry: {
    shortLabel: "R",
    example: "R 18d",
  },
  supabase_usage_health: {
    shortLabel: "SB",
    example: "SB OK",
  },
  cloudflare_month_to_date: {
    shortLabel: "CF",
    example: "CF $1.2",
  },
} satisfies Record<NotificationWidgetKey, HudWidgetDisplayExample>;

export const HUD_DISPLAY_MODE_EXAMPLES = {
  rows: "Codex CLI · 5h / used 22% · left 78%",
  cells: "Codex CLI · 5h 78%",
  singleLine: "MS 5h 78% · W 69% · R2",
} satisfies Record<HudDisplayMode, string>;

export function buildHudCompactPreview(selectedWidgets: readonly NotificationWidgetKey[]): string {
  const examples = selectedWidgets.map((widgetKey) => HUD_WIDGET_DISPLAY_EXAMPLES[widgetKey].example);

  return examples.length === 0 ? HUD_DISPLAY_MODE_EXAMPLES.singleLine : examples.join(" · ");
}
