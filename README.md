# MoneySiren

Local-first cloud, SaaS, and AI usage dashboard for individual developers and small teams.

MoneySiren reads provider usage into local SQLite, shows expected billing and usage risk in a local dashboard, and can surface compact desktop notifications/HUD widgets. It is not a hosted SaaS: provider connectors are read-only, secrets stay local, and telemetry is off by default.

## Current Status

MoneySiren is preparing `v0.1.0-alpha.0` for local review.

The current alpha supports:

- CLI-first setup and sync.
- Local SQLite snapshots.
- Local Next.js dashboard.
- Native Tauri tray/HUD from source or signable GitHub Release artifacts.
- AWS Cost Explorer fixture/live sync.
- OpenAI organization usage/cost fixture/live sync.
- Supabase usage/health fixture sync.
- Cloudflare billing/usage fixture sync.
- Local Codex CLI and Claude CLI usage estimates from local logs.
- Korean daily reports and optional Slack webhook delivery.

The npm alpha package is prepared as `moneysiren` so users can install the CLI without cloning this repository after the first npm publish. GitHub Releases can also attach a built web runtime archive plus signed Windows/macOS desktop artifacts for source-free alpha review once release signing secrets are configured.

## Screenshots

The screenshots below were regenerated from a fresh fixture-backed mock SQLite database. Fake environment labels only mark providers as connected for the UI; no live credentials, provider account identifiers, webhook URLs, or local Codex/Claude session data are included.

### English

Dashboard overview:

![MoneySiren mock dashboard](docs/assets/install/moneysiren-english-mock-dashboard.png)

CLI dashboard field settings:

![MoneySiren CLI dashboard settings](docs/assets/install/moneysiren-english-mock-dashboard-settings.png)

Desktop HUD:

![MoneySiren mock HUD](docs/assets/install/moneysiren-english-mock-hud.png)

Notification and HUD settings:

![MoneySiren notification and HUD settings](docs/assets/install/moneysiren-english-mock-hud-settings.png)

### 한국어

아래 스크린샷은 동일한 fixture 기반 목업 SQLite 데이터베이스에서 한국어 UI로 다시 캡처한 화면입니다. FAKE 환경 값은 로컬 UI에서 provider가 연결된 것처럼 표시하기 위한 라벨이며, 실제 credential, provider 계정 식별자, webhook URL, 로컬 Codex/Claude 세션 데이터는 포함하지 않습니다.

대시보드 개요:

![MoneySiren 한국어 목업 대시보드](docs/assets/install/moneysiren-korean-mock-dashboard.png)

CLI 대시보드 항목 설정:

![MoneySiren 한국어 CLI 대시보드 항목 설정](docs/assets/install/moneysiren-korean-mock-dashboard-settings.png)

데스크톱 HUD:

![MoneySiren 한국어 목업 HUD](docs/assets/install/moneysiren-korean-mock-hud.png)

알림 및 HUD 설정:

![MoneySiren 한국어 알림 및 HUD 설정](docs/assets/install/moneysiren-korean-mock-hud-settings.png)

## Provider Model

Cost providers and usage-only providers are intentionally shown separately in the dashboard because their columns and risk signals differ.

| Provider | Dashboard area | Status | Data | Auth |
|---|---|---|---|---|
| AWS Cost Explorer | Cost services | available | cost, usage, forecast | AWS profile / SSO |
| OpenAI Usage/Costs | Cost services | available | organization usage, costs | Admin API key |
| Cloudflare Billing/Usage | Cost services | experimental | billing, usage | API token |
| Supabase Usage/Health | Usage services | experimental | usage, health | OAuth / PAT |
| Codex CLI | Usage services | local-only | local usage and quota estimate | local CLI/logs |
| Claude CLI | Usage services | local-only | local usage and quota estimate | local CLI/statusline/logs |
| GCP | Connections only | planned/local setup | CLI and ADC readiness | gcloud CLI |

Supabase is currently modeled as usage/health, not billing. Fixed subscription costs and flat-plan SaaS spend need a separate local subscription-cost model or a provider billing connector before they should appear in the cost table.

For local AI CLIs, MoneySiren prioritizes 5-hour quota percent, weekly quota percent, and rolling token usage where those values can be derived safely. The dashboard Preferences screen lets users choose which local CLI metrics appear in the usage table. See [docs/local-ai-cli-usage.md](docs/local-ai-cli-usage.md).

## Local-First Security

Cloud, SaaS, and AI usage data often contains sensitive identifiers and billing context. MoneySiren is designed so users can inspect cost and usage risk without sending API keys or raw provider responses to a hosted service.

Core rules:

- Use process-local environment variables for v0.1 secrets.
- Do not commit `.env`, API keys, tokens, webhook URLs, account IDs, project IDs, invoice IDs, card data, emails, or raw billing profiles.
- Store normalized SQLite snapshots, not credential material.
- Redact raw provider payloads before persistence.
- Do not persist raw provider payloads in SQLite, dashboard JSON, reports, Slack payloads, logs, fixtures, screenshots, or test snapshots.
- Keep provider connectors read-only.
- Keep telemetry off by default; any future telemetry must be opt-in only.

See [docs/security-model.md](docs/security-model.md) and [SECURITY.md](SECURITY.md).

## Requirements

- Node.js 20.11 or newer.
- pnpm 11.5.0 through Corepack.
- Git.
- Node.js SQLite runtime, or `sqlite3` on `PATH` / `MONEYSIREN_SQLITE_BIN` as a fallback.
- Rust/Cargo plus platform toolchains only when building the native Tauri tray/HUD.

For platform-specific setup, source builds, npm CLI installation notes, and screenshot fixture commands, see [docs/install.md](docs/install.md).

## Quickstart From Source

```bash
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install

pnpm --filter moneysiren dev -- init
pnpm --filter moneysiren dev -- sync --provider mock
pnpm --filter moneysiren dev -- report daily --lang ko

npm run dev:web
```

Open `http://127.0.0.1:3000/en/dashboard/overview`.

`npm run dev:web` starts only the local web dashboard. `npm run dev` starts the web dashboard, the native taskbar/tray layer, and the Tauri dashboard window together. Use `npm run dev:hud` when you want the native HUD mode first.

For a production-style local run after building the web app and unsigned native desktop layer:

```bash
npm run build:local
npm start
```

`npm start` starts the built Next.js dashboard, waits for `http://127.0.0.1:3000/ko/dashboard/overview`, and then launches the built MoneySiren tray/Tauri executable.

## Fixture Review

Fixture mode uses committed fake payloads under `tests/fixtures/providers` and does not require live credentials.

```bash
MONEYSIREN_AWS_COST_EXPLORER_FIXTURE=tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json \
  pnpm --filter moneysiren dev -- sync --provider aws

MONEYSIREN_OPENAI_USAGE_FIXTURE=tests/fixtures/providers/openai/usage-costs.json \
MONEYSIREN_OPENAI_COSTS_FIXTURE=tests/fixtures/providers/openai/usage-costs.json \
  pnpm --filter moneysiren dev -- sync --provider openai

MONEYSIREN_SUPABASE_FIXTURE=tests/fixtures/providers/supabase/usage-health.json \
  pnpm --filter moneysiren dev -- sync --provider supabase

MONEYSIREN_CLOUDFLARE_FIXTURE=tests/fixtures/providers/cloudflare/billing-usage.json \
  pnpm --filter moneysiren dev -- sync --provider cloudflare
```

Live connector paths are read-only and env-only in this alpha. Do not create `.env` files or commit live credentials.

## CLI Commands

Running `moneysiren` without subcommands prints a slash-command home guide. In a local TTY it may continue into a minimal line-based slash prompt; in CI or non-TTY package review it prints the guide and exits `0`.

```bash
pnpm --filter moneysiren dev
pnpm --filter moneysiren dev -- --help
pnpm --filter moneysiren dev -- --version
pnpm --filter moneysiren dev -- doctor
pnpm --filter moneysiren dev -- install --status
pnpm --filter moneysiren dev -- modes
pnpm --filter moneysiren dev -- init
pnpm --filter moneysiren dev -- sync --provider mock
pnpm --filter moneysiren dev -- dashboard check
pnpm --filter moneysiren dev -- report daily --lang ko
```

Slash aliases are thin wrappers around the same commands:

```bash
pnpm --filter moneysiren dev -- /help
pnpm --filter moneysiren dev -- /version
pnpm --filter moneysiren dev -- /doctor
pnpm --filter moneysiren dev -- /install status
pnpm --filter moneysiren dev -- /modes
pnpm --filter moneysiren dev -- /init
pnpm --filter moneysiren dev -- /dashboard check
pnpm --filter moneysiren dev -- /sync mock
pnpm --filter moneysiren dev -- /report ko
```

Home/help never creates `.env`, prints secret values, calls provider APIs, or enables telemetry.

## NPM Alpha CLI Preview

After `@moneysiren/cli@alpha` is published:

```bash
npm install -g @moneysiren/cli@alpha
moneysiren --version
moneysiren install --status
moneysiren install --all
moneysiren modes
moneysiren doctor
moneysiren sync --provider mock
```

Maintainers can verify and publish the alpha package from the repository root:

```bash
npm run publish:cli:dry-run
npm run publish:cli:alpha
```

The dry run checks the full secret scan, npm package metadata, registry version availability, and tarball contents. The publish command requires a local npm login and publishes `apps/cli` with the `alpha` tag and public access.

During an interactive PowerShell, cmd, or shell install, the package asks which local surfaces to enable:

- CLI
- Web dashboard
- HUD

Press Enter to accept the recommended default, which selects all three. In CI or non-interactive npm installs, MoneySiren writes that same all-selected profile automatically. Run `moneysiren install --all` to download the matching GitHub Release assets for the web runtime and HUD desktop shell, or `moneysiren install --profile-only` to only change the local profile.

The same source tree supports Windows and macOS. Local config paths and native desktop artifacts are selected per OS. The shared runtime lock defaults to `%APPDATA%\MoneySiren\runtime.json` on Windows and `~/Library/Application Support/MoneySiren/runtime.json` on macOS so the npm CLI and native tray can discover the same local runtime.

## Source-Free Desktop Alpha

After a `desktop-release` GitHub Actions run publishes assets, users can review MoneySiren without cloning the repository:

```bash
npm install -g @moneysiren/cli@alpha
moneysiren install --all
moneysiren sync --provider mock
```

`moneysiren install --all` stores the selected release assets under the MoneySiren local application data directory by default. To install from a specific release tag or into a custom directory:

```bash
moneysiren install --all --tag v0.1.0-alpha.0 --dir ./moneysiren-release
```

Extract `moneysiren-web-runtime-*.tar.gz` from that install directory and start the local dashboard runtime:

```bash
node start.mjs
```

Finally install/open the Windows or macOS desktop artifact from the same install directory. The desktop shell connects to `http://127.0.0.1:3000` for the dashboard and HUD. In this alpha, the native app does not yet embed or auto-start the web runtime.

For local tarball review without publishing:

```bash
pnpm --filter moneysiren build
cd apps/cli
npm pack
```

## Local Dashboard

The dashboard makes no provider API calls. It reads normalized SQLite data and safe live/local overlays only. If the database is missing, it returns a safe empty state.

Useful URLs:

- `http://127.0.0.1:3000/en/dashboard/overview`
- `http://127.0.0.1:3000/ko/dashboard/overview`
- `http://127.0.0.1:3000/hud?locale=en`
- `http://127.0.0.1:3000/en/settings/preferences`
- `http://127.0.0.1:3000/en/settings/notifications`

Use the CLI check command from another terminal:

```bash
pnpm --filter moneysiren dev -- dashboard check
pnpm --filter moneysiren dev -- dashboard check --url http://localhost:3000
```

The check command sanitizes the printed dashboard URL and ignores path, query, and hash values. It rejects URL credentials and does not start, package, or serve the Next.js app.

## Desktop Tray, Notifications, and HUD

The desktop tray/notifier opens the same local dashboard runtime and a compact always-on-top HUD at `/hud`. The HUD is a native desktop window, not a web page overlay. It supports configurable font size, opacity, always-on-top behavior, refresh, minimize, close, and a separate HUD widget list.

Notification digest widgets and HUD widgets are configured independently:

- Digest widgets control scheduled/local notification content.
- HUD widgets control what stays visible in the floating desktop HUD.
- CLI dashboard fields control which local CLI metrics appear in dashboard usage tables.

From the web dashboard:

- Open `Settings -> Preferences` to choose local CLI dashboard fields.
- Open `Settings -> Notifications` to configure digest widgets, thresholds, desktop app state, HUD font size, HUD opacity, always-on-top, and HUD widgets.

From the CLI:

```bash
moneysiren notify prefs list
moneysiren notify prefs hud-enable codex_weekly_percent
moneysiren notify prefs hud-disable month_forecast
```

## Slack Report

Slack delivery is opt-in per run and requires `SLACK_WEBHOOK_URL` in the process environment:

```bash
pnpm --filter moneysiren dev -- report daily --lang ko
pnpm --filter moneysiren dev -- report daily --lang ko --send slack
```

Do not write webhook URLs into `.env`, docs, test fixtures, or committed files.

## Docker Local Review

Docker support is for local self-host/dev review only. The image and Compose file do not contain credentials.

```bash
docker compose build
docker compose run --rm moneysiren pnpm --filter moneysiren dev -- sync --provider mock
docker compose up moneysiren
```

Compose stores SQLite data in the `moneysiren_data` volume at `/data/moneysiren.sqlite` and exposes the dashboard on `http://localhost:3000`.

The Compose environment includes fake fixture paths, so fixture connector review can run without secrets:

```bash
docker compose run --rm moneysiren pnpm --filter moneysiren dev -- sync --provider aws
docker compose run --rm moneysiren pnpm --filter moneysiren dev -- sync --provider openai
docker compose run --rm moneysiren pnpm --filter moneysiren dev -- sync --provider supabase
docker compose run --rm moneysiren pnpm --filter moneysiren dev -- sync --provider cloudflare
```

For a Docker build dry validation:

```bash
docker build --pull=false --target verify -t moneysiren:m10-verify .
```

## Validation

Run the local validation gate with:

```bash
pnpm test
pnpm typecheck
git diff --check
npm run secret:scan
npm run secret:scan:all
```

For documentation-only changes, at minimum run:

```bash
git diff --check -- README.md docs/install.md
npm run secret:scan
```

`npm run secret:scan` checks the current tracked and untracked text tree. `npm run secret:scan:all` also scans Git history for deleted secrets and sensitive local artifacts before public review.
