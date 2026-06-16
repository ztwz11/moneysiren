# 05. CI & 릴리스 체크리스트

## 공개 전 로컬 검증

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm lint
git diff --check
```

선택:

```bash
gitleaks detect --source . --redact
```

## GitHub Actions 권장 workflow

```yaml
name: ci

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11.5.0

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm lint
      - run: git diff --check
```

## Secret scan workflow 선택지

```yaml
name: secret-scan

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## PR merge gate

PR은 다음을 만족해야 한다.

- [ ] typecheck 통과
- [ ] test 통과
- [ ] build 통과
- [ ] lint 통과
- [ ] diff whitespace check 통과
- [ ] secret scan 통과 또는 수동 확인 완료
- [ ] fixture synthetic 확인
- [ ] security impact 작성
- [ ] read-only 원칙 위반 없음
- [ ] raw payload persistence 없음
- [ ] browser JSON에 secret 없음

## 릴리스 태그 전 확인

```bash
git status --short
pnpm typecheck
pnpm test
pnpm build
pnpm lint
git diff --check
```

그리고 수동 확인:

```text
README quick start가 실제로 동작하는가?
.env.example에 real secret이 없는가?
screenshots에 account/project/email/token이 없는가?
Slack report에 webhook URL이 출력되지 않는가?
SQLite에 credential material이 들어가지 않는가?
Claude/Codex 화면에 prompt text가 나오지 않는가?
```

## 릴리스 노트 템플릿

```md
# v0.1.0-alpha.0

## Added
- Local-first usage and cost dashboard
- Read-only provider connector contract
- AWS/OpenAI/Supabase/Cloudflare initial provider surfaces
- Codex CLI and Claude CLI local usage views
- Canonical snapshot vs live_today provisional overlay

## Security
- Credential material is not stored in SQLite
- Provider raw payloads are not persisted
- Local AI CLI prompt text is not exposed
- Telemetry is disabled by default

## Known limitations
- Local AI CLI quota percentages may be provider-reported or estimated depending on available local metadata
- Cloudflare/Supabase billing surfaces are experimental
- GCP cost integration requires later Billing Export work
```
