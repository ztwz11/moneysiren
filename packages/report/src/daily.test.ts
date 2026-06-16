import { describe, expect, it } from "vitest";
import { renderDailyReport, renderKoreanDailyReport, type DailyReportInput } from "./daily.js";

const reportInput: DailyReportInput = {
  reportDate: "2026-06-02",
  generatedAt: "2026-06-02T09:05:00.000Z",
  providerSummaries: [
    {
      provider: "mock",
      displayName: "Mock Provider",
      syncStatus: "ok",
      usageSnapshotCount: 1,
      billingSnapshotCount: 1,
      healthStatus: "ok",
      estimatedAmountMinor: 1500,
      currency: "USD",
      alertCount: 0,
    },
  ],
  reportRunStatus: "rendered",
};

describe("Korean daily report renderer", () => {
  it("renders a local Korean daily report from normalized summary data", () => {
    const text = renderKoreanDailyReport(reportInput);

    expect(text).toContain("MoneySiren 일일 리포트");
    expect(text).toContain("2026-06-02");
    expect(text).toContain("---");
    expect(text).toContain("Mock Provider");
    expect(text).toContain("- 동기화 상태 정상");
    expect(text).toContain("- 예상 비용 USD 15.00");
    expect(text).toContain("- 알림 0건");
    expect(text).not.toMatch(/^[^-*\n][^\n]+: .+$/m);
    expect(text).not.toContain("동기화 상태:");
  });

  it("does not render secrets, webhook URLs, emails, or raw payload labels", () => {
    const text = renderKoreanDailyReport(reportInput);

    expect(text).not.toMatch(/sk-|hooks\.slack|@|rawPayload|rawResponse|billingProfile/i);
  });

  it("dispatches daily report rendering by language", () => {
    expect(renderDailyReport(reportInput, { lang: "ko" })).toBe(renderKoreanDailyReport(reportInput));
  });
});
