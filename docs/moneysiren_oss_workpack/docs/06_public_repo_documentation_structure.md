# 06. 공개 저장소 문서 구조 제안

## 루트 구조

```text
README.md
LICENSE
SECURITY.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SUPPORT.md
CHANGELOG.md
.env.example
.github/
  workflows/
    ci.yml
    secret-scan.yml
  ISSUE_TEMPLATE/
    bug_report.md
    provider_connector.md
  pull_request_template.md
docs/
  architecture.md
  security-model.md
  provider-connectors.md
  local-ai-cli-usage.md
  canonical-vs-live-today.md
  development.md
```

## README 요약 구조

```md
# MoneySiren

Local-first cloud, SaaS, and AI usage dashboard for individual developers and small teams.

## Why MoneySiren?

## Security model

## Supported providers

| Provider | Status | Data | Auth |
|---|---|---|---|
| AWS | available | cost/usage | AWS profile |
| OpenAI | available | usage/cost | Admin API key |
| Supabase | experimental | usage/health | PAT/OAuth |
| Cloudflare | experimental | billing/usage | API token |
| Codex CLI | local-only | local usage/quota estimate | local CLI/logs |
| Claude CLI | local-only | local usage/quota estimate | local CLI/statusline/logs |

## Quick start

## Configuration

## Local AI CLI quota usage

## Development

## License
```

## `docs/security-model.md` 필수 내용

- secret source: env, OS keychain, encrypted vault
- no SQLite credential material
- no raw provider payload persistence
- local-only web dashboard
- browser output policy
- logging policy
- Slack webhook policy
- local AI CLI prompt text policy
- telemetry off by default

## `docs/local-ai-cli-usage.md` 필수 내용

```text
Codex CLI와 Claude CLI는 API billing provider가 아니다.
MoneySiren는 로컬 설치 여부, 로컬 로그, statusline metadata로 사용량을 추정한다.
가능하면 5시간 한도 %, 주간 한도 %, context %, rolling token 사용량을 표시한다.
값에는 source/confidence가 붙는다.
```

## `docs/provider-connectors.md` 필수 내용

provider connector contract:

```ts
interface ProviderConnector {
  id: ProviderId;
  displayName: string;
  checkConnection(input: CheckConnectionInput): Promise<ConnectionCheckResult>;
  collectCanonicalSnapshots(input: CollectCanonicalInput): Promise<NormalizedSnapshot[]>;
  refreshLiveToday?(input: LiveRefreshInput): Promise<LiveTodayOverlay>;
}
```

connector 원칙:

```text
read-only only
raw response must not be persisted
normalize then redact
fixture mode required
rate limit aware
Windows local execution considered
```

## `docs/canonical-vs-live-today.md` 필수 내용

```text
canonical = 전날까지 저장된 SQLite snapshot
live_today = 오늘 임시 overlay
estimated = provider 또는 local estimate
unknown = 권한 부족/미지원/오류
```

UI 문구 예시:

```text
이번 달 확정 비용: $42.13
오늘 임시 사용량: 약 $3.20
월말 예상: $89 ~ $104
데이터 신뢰도: 중간
```
