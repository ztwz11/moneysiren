import type { HudDisplayMode, NotificationWidgetKey } from "../components/NotificationSettingsModel";

export interface HudWidgetDisplayExample {
  shortLabel: string;
  example: string;
}

export const HUD_WIDGET_DISPLAY_EXAMPLES = {
  month_forecast: {
    shortLabel: "Month estimate",
    example: "Month estimate $14.7",
  },
  today_live_cost: {
    shortLabel: "Today live",
    example: "Today live $0.84",
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
    example: "AWS estimate $7.6",
  },
  openai_today_cost: {
    shortLabel: "OpenAI cost",
    example: "OpenAI cost $0.42",
  },
  openai_today_tokens: {
    shortLabel: "OpenAI tokens",
    example: "OpenAI tokens 172k",
  },
  claude_five_hour_percent: {
    shortLabel: "Claude CLI 5h",
    example: "Claude CLI 5h 78%",
  },
  claude_weekly_percent: {
    shortLabel: "Claude CLI weekly",
    example: "Claude CLI weekly 69%",
  },
  codex_five_hour_percent: {
    shortLabel: "Codex CLI 5h",
    example: "Codex CLI 5h 78%",
  },
  codex_weekly_percent: {
    shortLabel: "Codex CLI weekly",
    example: "Codex CLI weekly 69%",
  },
  codex_reset_credit_count: {
    shortLabel: "Codex reset credits",
    example: "Codex reset credits 2",
  },
  codex_reset_credit_expiry: {
    shortLabel: "Codex reset expiry",
    example: "Codex reset expiry 18d",
  },
  supabase_usage_health: {
    shortLabel: "Supabase health",
    example: "Supabase health OK",
  },
  cloudflare_month_to_date: {
    shortLabel: "Cloudflare month",
    example: "Cloudflare month $1.2",
  },
} satisfies Record<NotificationWidgetKey, HudWidgetDisplayExample>;

export const HUD_DISPLAY_MODE_EXAMPLES = {
  rows: "Codex CLI · 5h / used 22% · left 78%",
  cells: "Codex CLI · 5h 78%",
  singleLine: "Codex CLI 5h 78% · Codex CLI weekly 69% · Codex reset credits 2",
} satisfies Record<HudDisplayMode, string>;

export function buildHudCompactPreview(selectedWidgets: readonly NotificationWidgetKey[]): string {
  const examples = selectedWidgets.map((widgetKey) => HUD_WIDGET_DISPLAY_EXAMPLES[widgetKey].example);

  return examples.length === 0 ? HUD_DISPLAY_MODE_EXAMPLES.singleLine : examples.join(" · ");
}
