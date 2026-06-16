# EPIC-03. Local AI CLI Quota Percent Core

## 목적

Codex CLI와 Claude CLI에서 5시간 한도 %, 주간 한도 %, resetAt, source/confidence를 안정적으로 수집한다.

## 권장 브랜치

```text
feature/local-ai-quota-core
```

## 담당 파일

```text
apps/web/lib/local-tools.ts
apps/web/lib/live-today.ts
apps/web/lib/local-tools.test.ts
tools/local-ai/**
```

## 수정 핵심

1. Claude `seven_day`를 weekly로 인식한다.
2. numeric `resets_at`을 ISO timestamp로 변환한다.
3. percent/used는 max가 아니라 latest observed 값을 사용한다.
4. 월초 weekly window를 위해 scanStart를 `min(monthStart, now - 7d)`로 잡는다.
5. `total_tokens` 중복 합산을 제거한다.
6. Claude statusline capture 파일을 우선 읽는다.
7. Codex는 provider-reported가 없으면 manual limit estimate로 percent를 계산한다.
8. metric에 source/confidence/window를 붙인다.

## 하지 말아야 할 것

```text
OperationsViews.tsx 대량 수정 금지
CSS 수정 금지
README 대량 수정 금지
```

UI는 EPIC-04가 맡는다.

## 구현 상세

`docs/03_codex_claude_cli_quota_implementation.md`를 따른다.

## Acceptance Criteria

- [ ] Claude statusline `rate_limits.five_hour.used_percentage`가 `five_hour_limit_percent`로 나온다.
- [ ] Claude statusline `rate_limits.seven_day.used_percentage`가 `weekly_limit_percent`로 나온다.
- [ ] `resets_at` 숫자가 ISO string으로 나온다.
- [ ] reset 이후 최신 낮은 percent가 이전 높은 percent보다 우선한다.
- [ ] 월초에도 weekly rolling window가 이전 달 파일을 읽는다.
- [ ] `total_tokens` 중복 합산이 없다.
- [ ] Codex manual token limit fallback이 동작한다.
- [ ] prompt text가 output에 없다.

## 검증

```bash
pnpm typecheck
pnpm test -- local-tools
pnpm test
pnpm build
git diff --check
```

## 완료 보고에 포함할 것

```text
- Claude provider-reported percent 테스트 결과
- Codex manual estimate 테스트 결과
- prompt text 미노출 테스트 결과
- 남은 confidence 한계
```
