import type { CreditPoolView, WidgetItemView } from "../../../packages/view-model/src/hud-model";

export type HudIconKind =
  | "cost"
  | "live"
  | "risk"
  | "stale"
  | "tokens"
  | "quota"
  | "credit"
  | "expiry"
  | "health"
  | "cloud";

export function hudIconKindForCreditPool(variant: CreditPoolView["variant"]): HudIconKind {
  return variant === "count" ? "credit" : "expiry";
}

export function hudIconKindForWidget(widgetKey: WidgetItemView["widgetKey"]): HudIconKind {
  if (
    widgetKey === "month_forecast" ||
    widgetKey === "aws_month_forecast" ||
    widgetKey === "openai_today_cost" ||
    widgetKey === "cloudflare_month_to_date"
  ) {
    return "cost";
  }

  if (widgetKey === "today_live_cost") {
    return "live";
  }

  if (widgetKey === "risk_high_count") {
    return "risk";
  }

  if (widgetKey === "stale_connection_count") {
    return "stale";
  }

  if (widgetKey === "openai_today_tokens" || widgetKey === "codex_total_tokens") {
    return "tokens";
  }

  if (
    widgetKey === "codex_five_hour_percent" ||
    widgetKey === "codex_weekly_percent" ||
    widgetKey === "claude_five_hour_percent" ||
    widgetKey === "claude_weekly_percent"
  ) {
    return "quota";
  }

  if (widgetKey === "codex_reset_credit_count") {
    return "credit";
  }

  if (widgetKey === "codex_reset_credit_expiry") {
    return "expiry";
  }

  if (widgetKey === "supabase_usage_health") {
    return "health";
  }

  return "cloud";
}

export function hudProviderKeyForWidget(
  widgetKey: WidgetItemView["widgetKey"],
  providerKey: WidgetItemView["providerKey"],
): string | null {
  if (providerKey !== null) {
    return providerKey;
  }

  if (widgetKey === "aws_month_forecast") {
    return "aws";
  }

  if (widgetKey === "openai_today_cost" || widgetKey === "openai_today_tokens") {
    return "openai";
  }

  if (widgetKey === "supabase_usage_health") {
    return "supabase";
  }

  if (widgetKey === "cloudflare_month_to_date") {
    return "cloudflare";
  }

  if (
    widgetKey === "codex_total_tokens" ||
    widgetKey === "codex_five_hour_percent" ||
    widgetKey === "codex_weekly_percent" ||
    widgetKey === "codex_reset_credit_count" ||
    widgetKey === "codex_reset_credit_expiry"
  ) {
    return "codex-app";
  }

  if (widgetKey === "claude_five_hour_percent" || widgetKey === "claude_weekly_percent") {
    return "claude-app";
  }

  return null;
}
