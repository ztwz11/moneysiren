import type { DailyProviderSummary, DailyReportInput } from "./daily.js";

export function renderKoreanDailyReport(input: DailyReportInput): string {
  const lines = [
    "*StackSpend 일일 리포트*",
    `- 날짜 ${input.reportDate}`,
    `- 생성 ${input.generatedAt}`,
    `- 리포트 상태 ${translateReportStatus(input.reportRunStatus)}`,
    "",
  ];

  if (input.providerSummaries.length === 0) {
    lines.push("---", "*요약*", "- 수집된 공급자 데이터가 없습니다.");
    return lines.join("\n");
  }

  for (const summary of input.providerSummaries) {
    lines.push("---", ...renderProviderSummary(summary), "");
  }

  return lines.join("\n").trimEnd();
}

function renderProviderSummary(summary: DailyProviderSummary): string[] {
  return [
    `*${summary.displayName}*`,
    `- 동기화 상태 ${translateSyncStatus(summary.syncStatus)}`,
    `- 사용량 스냅샷 ${summary.usageSnapshotCount}건`,
    `- 청구 스냅샷 ${summary.billingSnapshotCount}건`,
    `- 서비스 상태 ${translateHealthStatus(summary.healthStatus)}`,
    `- 예상 비용 ${formatMinorCurrency(summary.estimatedAmountMinor, summary.currency)}`,
    `- 알림 ${summary.alertCount}건`,
  ];
}

function translateReportStatus(status: DailyReportInput["reportRunStatus"]): string {
  if (status === "rendered") {
    return "생성됨";
  }

  if (status === "sent") {
    return "전송됨";
  }

  return "오류";
}

function translateSyncStatus(status: DailyProviderSummary["syncStatus"]): string {
  if (status === "ok") {
    return "정상";
  }

  if (status === "partial") {
    return "부분 성공";
  }

  return "오류";
}

function translateHealthStatus(status: DailyProviderSummary["healthStatus"]): string {
  if (status === "ok") {
    return "정상";
  }

  if (status === "degraded") {
    return "저하";
  }

  if (status === "down") {
    return "중단";
  }

  return "알 수 없음";
}

function formatMinorCurrency(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}
