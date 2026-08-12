import { describe, expect, it } from "vitest";
import {
  hudIconKindForCreditPool,
  hudIconKindForWidget,
  hudProviderKeyForWidget,
} from "./hud-icon-kind";

describe("HUD icon semantics", () => {
  it("uses different icons for reset credit count and expiry", () => {
    expect(hudIconKindForCreditPool("count")).toBe("credit");
    expect(hudIconKindForCreditPool("expiry")).toBe("expiry");
    expect(hudIconKindForWidget("codex_reset_credit_count")).toBe("credit");
    expect(hudIconKindForWidget("codex_reset_credit_expiry")).toBe("expiry");
  });

  it("maps token and quota widgets to their metric icons", () => {
    expect(hudIconKindForWidget("openai_today_tokens")).toBe("tokens");
    expect(hudIconKindForWidget("codex_total_tokens")).toBe("tokens");
    expect(hudIconKindForWidget("codex_five_hour_percent")).toBe("quota");
    expect(hudIconKindForWidget("codex_weekly_percent")).toBe("quota");
  });

  it("keeps provider identity beside metric icons for service-specific widgets", () => {
    expect(hudProviderKeyForWidget("openai_today_tokens", null)).toBe("openai");
    expect(hudProviderKeyForWidget("codex_total_tokens", null)).toBe("codex-app");
    expect(hudProviderKeyForWidget("codex_reset_credit_count", null)).toBe("codex-app");
    expect(hudProviderKeyForWidget("month_forecast", null)).toBeNull();
    expect(hudProviderKeyForWidget("openai_today_tokens", "openai-team")).toBe("openai-team");
  });
});
