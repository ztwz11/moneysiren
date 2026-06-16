# EPIC-04. Local AI Quota UI & i18n

## 목적

Codex/Claude CLI 상세 화면과 Today Live 화면에서 5시간/주간 한도 사용률을 가장 먼저 보여준다.

## 권장 브랜치

```text
feature/local-ai-quota-ui
```

## 담당 파일

```text
apps/web/components/OperationsViews.tsx
apps/web/app/**/globals.css 또는 관련 CSS
apps/web/lib/i18n* 또는 message files
```

## 의존성

EPIC-03의 metric shape가 필요하다.  
EPIC-03이 늦어지면 임시로 기존 `five_hour_limit_percent`, `weekly_limit_percent`만 사용해서 UI를 먼저 만든다.

## UI 요구사항

Codex/Claude 상세 화면 카드 순서:

```text
1. 5시간 한도 %
2. 주간 한도 %
3. Context 사용률
4. Total/Rolling tokens
```

각 카드에는 다음 정보를 보여준다.

```text
percent value
progress bar
used / limit tokens if available
resetAt if available
source/confidence if available
```

## 예시

```text
5시간 한도
72%
91,200 / 125,000 tokens
리셋: 오후 2:30
source: statusline_capture
confidence: medium
```

Codex manual estimate 예시:

```text
5시간 한도
64%
128,000 / 200,000 tokens
source: manual_limit_estimate
confidence: low
```

## UI 상태

| percent | state |
|---:|---|
| 0-59 | low |
| 60-79 | medium |
| 80-94 | high |
| 95-100+ | critical |

## 구현 힌트

```tsx
function usageMetricNumber(
  summary: OperationsProvider["currentUsageSummary"],
  key: string,
): number | null {
  return summary?.metrics.find((item) => item.key === key)?.value ?? null;
}

function quotaState(percent: number | null | undefined): "low" | "medium" | "high" | "critical" {
  if (percent === undefined || percent === null) {
    return "low";
  }

  if (percent >= 95) {
    return "critical";
  }

  if (percent >= 80) {
    return "high";
  }

  if (percent >= 60) {
    return "medium";
  }

  return "low";
}
```

## Acceptance Criteria

- [ ] 5시간/주간 한도가 session 수보다 먼저 보인다.
- [ ] percent가 있으면 progress bar가 표시된다.
- [ ] percent가 없고 token만 있으면 token fallback이 표시된다.
- [ ] source/confidence가 있으면 표시된다.
- [ ] billing이 아니라 local usage estimate라는 설명이 보인다.
- [ ] 한국어/영어/일본어 메시지 키가 깨지지 않는다.
- [ ] 모바일 폭에서 카드가 겹치지 않는다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
git diff --check
```
