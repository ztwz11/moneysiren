# 02. Security & Privacy Hardening 지침

## 핵심 원칙

MoneySiren는 보안 모델이 제품의 일부다.
공개 저장소에서는 기능보다 아래 원칙을 우선한다.

1. secret 저장 금지
2. raw provider payload 저장 금지
3. browser localStorage/sessionStorage/cookie에 secret 저장 금지
4. log/report/Slack payload에 secret 저장 금지
5. connector는 read-only only
6. local AI CLI prompt text 저장 금지
7. telemetry opt-in only

## Redaction 방식

blacklist 방식은 부족하다.

나쁜 방식:

```ts
delete raw.api_key;
delete raw.token;
delete raw.secret;
```

좋은 방식:

```ts
const normalized = {
  service: String(raw.serviceName),
  amountMinor: toMinor(raw.amount),
  currency: String(raw.currency),
  periodStart: String(raw.periodStart),
  periodEnd: String(raw.periodEnd),
};
```

즉, 저장할 필드만 whitelist로 선택한다.

## 공통 redaction pipeline

```text
provider/local raw input
  -> provider-specific mapper
  -> normalized object
  -> generic redaction/masking
  -> schema validation
  -> DB/API/report output
```

## Local AI CLI 보안

Codex/Claude CLI 로그에는 prompt text, file path, command, tool input이 들어갈 수 있다.  
MoneySiren는 다음 값만 저장/표시한다.

허용:

```text
timestamp
model name
token counts
quota percentage
reset timestamp
context window count/percent
session count
turn count
tool call count
log file count
estimated cost value if already present
```

금지:

```text
prompt text
assistant response text
tool input
shell command body
file content
file path containing project/customer name
raw JSONL line
```

## Sanitized local AI capture format

```json
{
  "provider": "claude-cli",
  "capturedAt": "2026-06-09T00:00:00.000Z",
  "model": "claude-sonnet",
  "quota": {
    "fiveHour": {
      "percent": 72,
      "resetAt": "2026-06-09T04:00:00.000Z",
      "source": "statusline_capture"
    },
    "weekly": {
      "percent": 38,
      "resetAt": "2026-06-12T09:00:00.000Z",
      "source": "statusline_capture"
    }
  },
  "context": {
    "percent": 41,
    "tokens": 82000,
    "limit": 200000
  },
  "secretsReturned": false,
  "rawPersisted": false
}
```

## 테스트 요구사항

각 보안 관련 PR에는 최소한 아래 테스트를 포함한다.

```text
- API key pattern이 output에 포함되지 않는다.
- webhook URL이 output에 포함되지 않는다.
- prompt text가 output에 포함되지 않는다.
- raw fixture field가 DB/API view model에 남지 않는다.
- local AI statusline capture는 allowlisted field만 저장한다.
```

테스트 문자열 예시:

```text
FAKE_SECRET_PROMPT_TEXT
FAKE_CLAUDE_PROMPT_TEXT
FAKE_API_KEY_FOR_TESTS
FAKE_REFRESH_TOKEN_FOR_TESTS
https://hooks.slack.com/services/FAKE/WEBHOOK
```

## 출력 금지 위치

```text
console.log
server error response
Next.js API JSON
browser hydration data
SQLite
fixture
snapshot test
Slack report
daily report
debug panel
GitHub issue template examples
```

## CI에서 확인할 항목

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
git diff --check
gitleaks detect --source . --redact
```

`gitleaks`는 개발 머신 또는 CI 환경에 설치된 경우 실행한다. 설치하지 않은 상태에서도 릴리스 체크리스트에는 남겨 둔다.
