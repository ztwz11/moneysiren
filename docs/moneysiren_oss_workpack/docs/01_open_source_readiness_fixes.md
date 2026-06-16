# 01. 오픈소스 공개를 위한 수정사항

## 1. Repository public metadata

### 필요 파일

루트에 다음 문서를 추가한다.

```text
README.md
LICENSE
SECURITY.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SUPPORT.md
CHANGELOG.md
.env.example
```

### README 필수 섹션

```text
What is MoneySiren?
Why local-first?
Supported providers
Security model
Install
Quick start
Configuration
Provider setup
Local AI CLI usage
Canonical vs live_today data
Development
Testing
Contributing
License
```

### README에서 반드시 말해야 하는 것

- MoneySiren는 local-first 도구다.
- secret은 로컬 env/keychain/vault에서 읽는다.
- SQLite에는 credential material을 저장하지 않는다.
- provider connector는 read-only다.
- Today live 값은 provisional이다.
- Codex/Claude CLI는 billing provider가 아니라 local usage provider다.
- telemetry는 기본 비활성화이며, 추가하더라도 opt-in만 허용한다.

## 2. Secret과 identifier 공개 방지

### 금지 대상

```text
API key
OAuth token
webhook URL
AWS account id
Cloudflare account id
OpenAI organization id
Supabase project ref
invoice id
card data
email
billing profile
raw provider response
local prompt text
```

### 체크 대상

```text
.env
.env.*
*.sqlite
*.db
*.log
fixtures/
tests/fixtures/
reports/
screenshots/
README screenshots
GitHub issue/PR template example
```

### 권장 명령

```bash
git status --short
git diff --check
pnpm typecheck
pnpm test
pnpm build
pnpm lint

# 설치되어 있다면
gitleaks detect --source . --redact
```

## 3. Fixture 공개 기준

fixture는 반드시 synthetic data여야 한다.

좋은 예:

```json
{
  "provider": "aws",
  "service": "Amazon S3",
  "amount": "1.23",
  "currency": "USD"
}
```

나쁜 예:

```json
{
  "accountId": "123456789012",
  "projectRef": "real-project-ref",
  "apiKey": "sk-real...",
  "invoiceId": "in_..."
}
```

## 4. Raw payload viewer 금지

공개 버전에서 `Raw`, `Debug raw`, `Provider response` 같은 탭은 만들지 않는다.

대신 sanitized debug trace만 허용한다.

```text
Request: organization costs
Status: 200
Duration: 412ms
Items normalized: 12
Redacted fields: 4
Stored raw payload: no
```

## 5. Local write action 표기

AWS profile 저장 기능처럼 로컬 환경을 바꾸는 작업은 provider write action과 구분해야 한다.

UI 문구 예시:

```text
이 작업은 AWS 리소스를 변경하지 않습니다.
다만 Windows 사용자 환경 변수 AWS_PROFILE을 저장합니다.
새 터미널에서 적용됩니다.
```

## 6. Release notes 초안

```md
# MoneySiren v0.1.0-alpha.0

MoneySiren is a local-first dashboard for cloud, SaaS, and AI usage visibility.

## Highlights

- Local SQLite snapshot storage
- Read-only provider connectors
- AWS, OpenAI, Supabase, Cloudflare experimental support
- Local Codex CLI and Claude CLI usage views
- Canonical data vs live_today provisional overlay
- Korean/English/Japanese i18n direction
- No telemetry by default

## Security

- No credential material is stored in SQLite
- No provider raw payload is persisted
- Browser responses are sanitized
- Slack webhook URL is treated as a local secret
```
