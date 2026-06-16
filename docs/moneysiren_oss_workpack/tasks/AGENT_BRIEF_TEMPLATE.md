# Agent Brief Template

## 역할

너는 MoneySiren 프로젝트의 특정 workstream을 맡은 구현 에이전트다.
작업 범위를 지키고, 작은 PR 단위로 변경한다.

## 대상 브랜치

```text
<branch-name>
```

## 작업 범위

```text
<allowed files>
```

## 수정 금지 또는 주의 파일

```text
<do-not-touch files>
```

## 목표

```text
<one paragraph goal>
```

## 세부 작업

- [ ] ...
- [ ] ...
- [ ] ...

## 보안 원칙

- API key, token, webhook URL, account id, project id, invoice id, email을 출력하지 않는다.
- provider raw response를 저장하지 않는다.
- local AI CLI prompt text, tool input, shell command body를 저장하지 않는다.
- browser JSON, report, log, fixture에 secret을 넣지 않는다.
- provider connector는 read-only만 허용한다.

## 검증 명령

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
git diff --check
```

## 완료 보고 형식

```md
## Summary

## Files changed

## Verification
- pnpm typecheck:
- pnpm test:
- pnpm build:
- pnpm lint:
- git diff --check:

## Security impact

## Remaining risks
```
