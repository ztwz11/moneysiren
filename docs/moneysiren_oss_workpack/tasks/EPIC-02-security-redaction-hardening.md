# EPIC-02. Security & Redaction Hardening

## 목적

공개 저장소와 런타임에서 secret, provider raw payload, local prompt text가 노출되지 않도록 redaction/masking/test를 강화한다.

## 권장 브랜치

```text
oss/security-redaction
```

## 담당 파일

```text
packages/security/**
packages/report/**
apps/web/lib/**/security 관련 helper
tests/security/**
```

## 충돌 주의

`apps/web/lib/local-tools.ts`는 EPIC-03이 담당한다.  
필요한 redaction helper는 별도 함수로 제공하고, EPIC-03이 가져다 쓰게 한다.

## 작업 항목

- [ ] secret pattern detector를 정리한다.
- [ ] API key, token, webhook URL, account id, project id masking helper를 추가한다.
- [ ] local AI CLI prompt text 차단 테스트를 추가한다.
- [ ] report/Slack payload sanitizer를 확인한다.
- [ ] Next.js API JSON sanitizer를 확인한다.
- [ ] fixture secret scan 테스트를 추가한다.
- [ ] debug trace가 raw provider response를 포함하지 않도록 테스트한다.

## 테스트 케이스

반드시 아래 문자열이 output에 나오지 않아야 한다.

```text
FAKE_SECRET_PROMPT_TEXT
FAKE_CLAUDE_PROMPT_TEXT
FAKE_API_KEY_FOR_TESTS
FAKE_REFRESH_TOKEN_FOR_TESTS
https://hooks.slack.com/services/FAKE/WEBHOOK
```

## Acceptance Criteria

- [ ] secret-like string이 API response에 없다.
- [ ] prompt text가 API response에 없다.
- [ ] report/Slack output에 webhook URL이 없다.
- [ ] SQLite insert 경로에 raw provider payload가 없다.
- [ ] fixtures는 synthetic data만 사용한다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
git diff --check
```
