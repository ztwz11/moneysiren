import type { ResetCreditErrorCode } from "./types";

export interface ResetCreditErrorRemediation {
  title: string;
  cause: string;
  actions: readonly string[];
}

export function resetCreditErrorRemediation(code: ResetCreditErrorCode): ResetCreditErrorRemediation {
  switch (code) {
    case "UPSTREAM_UNAUTHORIZED":
      return {
        title: "Codex 로그인이 필요함",
        cause: "공식 Codex App Server 계정 조회를 사용할 수 있도록 로그인되지 않았습니다.",
        actions: [
          "터미널에서 codex login을 실행한 후 다시 조회하세요.",
          "MoneySiren과 Codex가 같은 OS 사용자로 실행되는지 확인하세요.",
        ],
      };
    case "UPSTREAM_FORBIDDEN":
      return {
        title: "현재 인증 방식에서 계정 조회를 지원하지 않음",
        cause: "활성 Codex 인증 방식이 App Server의 계정 사용량 조회를 지원하지 않습니다.",
        actions: [
          "Codex에서 지원되는 ChatGPT 로그인 방식으로 다시 로그인하세요.",
          "설치된 Codex를 최신 버전으로 업데이트한 후 다시 시도하세요.",
        ],
      };
    case "UPSTREAM_RATE_LIMITED":
      return {
        title: "Codex App Server 요청 제한",
        cause: "짧은 시간에 계정 조회가 반복되어 요청이 일시적으로 제한됐습니다.",
        actions: [
          "몇 분 후 다시 시도하고 수동 새로고침 횟수를 줄이세요.",
          "cron 주기를 30분 이상으로 유지하세요.",
        ],
      };
    case "UPSTREAM_UNAVAILABLE":
      return {
        title: "Codex App Server 사용 불가",
        cause: "Codex CLI를 찾지 못했거나 공식 로컬 App Server에서 사용할 수 있는 데이터를 받지 못했습니다.",
        actions: [
          "터미널에서 codex --version을 실행해 설치와 PATH 상태를 확인하세요.",
          "codex login을 확인하고 Codex를 최신 버전으로 업데이트하세요.",
        ],
      };
    case "UPSTREAM_TIMEOUT":
      return {
        title: "Codex App Server 응답 시간 초과",
        cause: "공식 로컬 App Server가 안전 제한 시간 안에 응답하지 않았습니다.",
        actions: [
          "실행 중인 Codex 작업 상태를 확인한 뒤 다시 시도하세요.",
          "문제가 반복되면 Codex를 종료 후 다시 실행하고 업데이트를 확인하세요.",
        ],
      };
    case "UPSTREAM_INVALID_JSON":
    case "UPSTREAM_INVALID_RESPONSE":
      return {
        title: "지원되지 않는 Codex App Server 응답",
        cause: "설치된 Codex 버전의 공식 App Server 응답을 안전하게 정규화할 수 없습니다.",
        actions: [
          "Codex를 최신 버전으로 업데이트한 후 다시 시도하세요.",
          "계속 발생하면 민감한 원문 없이 MoneySiren 버전과 오류 코드만 보고하세요.",
        ],
      };
    case "API_UNAUTHORIZED":
      return {
        title: "MoneySiren 로컬 API 인증 실패",
        cause: "RESET_CREDIT_API_KEY가 설정됐지만 올바른 로컬 Bearer 헤더가 없습니다.",
        actions: [
          "신뢰하는 로컬 스크립트에 Authorization: Bearer <RESET_CREDIT_API_KEY> 헤더를 추가하세요.",
          "브라우저 전용 로컬 사용은 서버를 127.0.0.1에 바인딩하고 키 설정을 검토하세요.",
        ],
      };
    case "CRON_SECRET_NOT_CONFIGURED":
      return {
        title: "cron secret 미설정",
        cause: "POST /api/cron/codex-reset-credits에는 CRON_SECRET이 필요합니다.",
        actions: [
          "CRON_SECRET 환경변수를 설정한 뒤 서버를 다시 실행하세요.",
          "cron 호출에 Authorization: Bearer <CRON_SECRET> 헤더를 추가하세요.",
        ],
      };
  }
}
