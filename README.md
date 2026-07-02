# MoneySiren

MoneySiren is an MIT-licensed local-first observability dashboard for AI coding agent, cloud, and SaaS usage. It helps open-source maintainers, indie developers, and small teams monitor OpenAI/Codex, Claude CLI, AWS, Supabase, and Cloudflare usage/cost risk without sending credentials, raw billing payloads, or local AI logs to a hosted service.

MoneySiren is not a hosted SaaS. Provider connectors are read-only, normalized snapshots stay in local SQLite, and telemetry is off by default.

## Why MoneySiren Exists

AI coding agents make open-source maintenance faster, but they also create new operational risks:

- usage limits are easy to burn through;
- API and cloud costs are fragmented across providers;
- local AI CLI logs can contain sensitive prompts, shell commands, and project context;
- maintainers need visibility without uploading secrets to another SaaS.

MoneySiren provides a local-first dashboard for those risks.

## What It Supports Today

| Area | Providers / surfaces |
|---|---|
| AI usage/cost | OpenAI Usage/Costs, Codex CLI, Claude CLI |
| Cloud/SaaS cost | AWS Cost Explorer, Cloudflare |
| Usage/health | Supabase |
| Local surfaces | CLI, Next.js dashboard, Tauri tray/HUD |
| Notifications | Desktop HUD, Korean daily report, optional Slack webhook |

## Codex for Open Source

MoneySiren is designed to help open-source maintainers and indie developers adopt AI coding agents safely by making OpenAI/Codex, local AI CLI, cloud, and SaaS usage visible without uploading secrets or raw provider data to a hosted service.

The project includes a Codex-oriented maintainer plan covering provider connector tests, PR review, release workflow hardening, documentation, and secret-safety checks.

See [docs/codex-for-open-source.md](docs/codex-for-open-source.md).

## Current Status

MoneySiren `v0.1.0-alpha.45` is the latest published alpha for local review.
The current `main` branch includes unreleased application-readiness
documentation and notification threshold improvements after that release.
Package manifests remain at `0.1.0-alpha.45` until the guarded alpha release
script publishes the next version.

The published alpha supports:

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

The recommended source-free install is `@moneysiren/app@alpha`. It installs the CLI aliases (`moneysiren` and `msiren`) and downloads the matching GitHub Release web runtime plus HUD desktop artifact. Use `@moneysiren/cli@alpha` only for CLI-only automation.

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

### Korean

아래 스크린샷은 동일한 fixture 기반 목업 SQLite 데이터베이스에서 캡처한 한국어 UI 예시입니다. `FAKE` 환경 값은 로컬 UI에서 provider가 연결된 것처럼 표시하기 위한 라벨이며, 실제 credential, provider 계정 식별자, webhook URL, 로컬 Codex/Claude 세션 데이터는 포함하지 않습니다.

대시보드 개요:

![MoneySiren Korean mock dashboard](docs/assets/install/moneysiren-korean-mock-dashboard.png)

CLI 대시보드 필드 설정:

![MoneySiren Korean CLI dashboard settings](docs/assets/install/moneysiren-korean-mock-dashboard-settings.png)

데스크톱 HUD:

![MoneySiren Korean mock HUD](docs/assets/install/moneysiren-korean-mock-hud.png)

알림 및 HUD 설정:

![MoneySiren Korean notification and HUD settings](docs/assets/install/moneysiren-korean-mock-hud-settings.png)

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

- Node.js 20.19 or newer. The current test/build toolchain depends on Vite/Rolldown packages that require Node 20.19+ or newer LTS releases.
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

## NPM Alpha App Preview

For normal source-free installs, use the app package. During alpha, keep the `@alpha` dist-tag because the unqualified `latest` channel can lag behind prerelease builds:

```bash
npm install -g @moneysiren/app@alpha
msiren --version
msiren start
msiren hud
```

`@moneysiren/app` is the all-in-one package for the CLI, local web dashboard, and HUD. It creates the `moneysiren` and shorter `msiren` global command shims during postinstall, then runs `msiren install --all` during global npm installs so the matching GitHub Release web runtime and HUD artifact are downloaded immediately. The current app package no longer uses npm-managed `bin` aliases, which avoids npm's `EEXIST` bin conflict with older alpha installs.

If Web/HUD asset download cannot complete during postinstall, npm still leaves the command installed. Rerun the asset installer after network or release access is fixed:

```bash
msiren install --all
msiren install --status
```

If npm reports `EEXIST` for `moneysiren` or `msiren`, remove the older global MoneySiren packages and reinstall the app package:

```powershell
npm uninstall -g @moneysiren/cli @moneysiren/app
npm install -g @moneysiren/app@alpha --force
```

Maintainers can verify and publish the alpha npm packages from the repository root:

```bash
npm run publish:cli:dry-run
npm run publish:app:dry-run
npm run publish:cli:alpha
npm run publish:app:alpha
```

The dry runs check the full secret scan, npm package metadata, registry version availability, and tarball contents. The publish commands require a local npm login and publish `apps/cli` plus the one-command `apps/app` installer with the `alpha` tag and public access.

For the full guarded alpha release flow, use:

```bash
npm run release:alpha:dry-run
npm run release:alpha
```

`release:alpha` bumps the next alpha version, runs secret scan/typecheck/tests/build plus npm publish dry-runs, commits the release, pushes `main`, pushes the `v*` tag, waits for GitHub Actions, and verifies npm plus GitHub Release assets. The working tree must be clean by default; use `npm run release:alpha:include-working-tree` only when you intentionally want current local changes included in the release commit. To force a specific version, run `node tools/scripts/release-alpha.mjs --target-version 0.1.0-alpha.45`.

During an interactive PowerShell, cmd, or shell install, the package asks which local surfaces to enable:

- CLI
- Web dashboard
- HUD

Press Enter to accept the recommended default, which selects all three. In CI or non-interactive npm installs, MoneySiren writes that same all-selected profile automatically. The npm package installs both `moneysiren` and the shorter `msiren` command. Run `msiren install --all` to download the matching GitHub Release assets for the web runtime and HUD desktop shell, or `msiren install --profile-only` to only change the local profile.

The same source tree supports Windows and macOS. Local config paths and native desktop artifacts are selected per OS. The shared runtime lock defaults to `%APPDATA%\MoneySiren\runtime.json` on Windows and `~/Library/Application Support/MoneySiren/runtime.json` on macOS so the npm CLI and native tray can discover the same local runtime.

## Source-Free Desktop Alpha

After a `desktop-release` GitHub Actions run publishes assets, users can review MoneySiren without cloning the repository:

```bash
npm install -g @moneysiren/app@alpha
msiren install --status
msiren sync --provider mock
msiren start
msiren hud
msiren status
msiren stop
```

`msiren install --all` stores the selected release assets under the MoneySiren local application data directory by default. `msiren start` extracts and starts the installed web runtime, then opens the local dashboard. `msiren hud` ensures the web runtime is running and opens the desktop HUD shell when a runnable desktop app is installed or configured. `msiren status` shows the managed web, HUD, and local API runtime state. `msiren stop` stops managed runtimes; use `msiren stop --web`, `msiren stop --hud`, or `msiren stop --api` when you only want to stop one surface. `msiren restart` stops the managed web/HUD pair and starts the dashboard again.

To install from a specific release tag or into a custom directory:

```bash
msiren install --all --tag v0.1.0-alpha.45 --dir ./moneysiren-release
```

If the desktop installer was installed to a non-default location, point the CLI at it before opening HUD:

```bash
MONEYSIREN_DESKTOP_APP="<path-to-installed-MoneySiren-app>" msiren hud
```

The desktop shell connects to `http://127.0.0.1:3000` for the dashboard and HUD. In this alpha, the native app still runs as a thin local shell, but the CLI now handles the web runtime startup path.

Release maintainers should verify published assets before announcing a desktop build:

```bash
npm run release:signing:encode-windows -- "<path-to-windows-code-signing.pfx>"
npm run release:signing:check -- windows
npm run release:check -- v0.1.0-alpha.45
```

The encode helper writes the base64 certificate payload to `.tmp/codesign/windows-certificate.base64.txt` so maintainers can set the `WINDOWS_CERTIFICATE` repository secret without printing the private certificate to the terminal. Set `WINDOWS_CERTIFICATE_PASSWORD` to the PFX/P12 password in GitHub Secrets and in the local shell before running the signing readiness check. The signing check verifies local/CI signing inputs before a release run. The release check downloads the published assets, verifies SHA256 entries, requires Windows signature metadata, and validates Windows Authenticode signatures when run on Windows. If only one desktop signing identity is ready, run the `desktop-release` workflow with `desktop_targets=windows` or `desktop_targets=macos`; the publish step removes stale desktop assets for the skipped OS. Self-signed certificates are acceptable only for local smoke tests and do not fix public Windows publisher trust warnings.

Alpha releases can publish unsigned HUD artifacts when signing secrets are not ready. Keep that path explicit in validation:

```bash
npm run release:check -- v0.1.0-alpha.45 --allow-unsigned-prerelease-windows
```

The CLI accepts unsigned HUD artifacts only for prerelease tags such as `alpha`; set `MONEYSIREN_ALLOW_UNSIGNED_HUD=false` to require signed HUD metadata even for alpha builds.

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
- `http://127.0.0.1:3000/codex-reset-credits` (experimental, local-only)
- `http://127.0.0.1:3000/hud?locale=en`
- `http://127.0.0.1:3000/en/settings/preferences`
- `http://127.0.0.1:3000/en/settings/notifications`

Use the CLI check command from another terminal:

```bash
pnpm --filter moneysiren dev -- dashboard check
pnpm --filter moneysiren dev -- dashboard check --url http://localhost:3000
```

The check command sanitizes the printed dashboard URL and ignores path, query, and hash values. It rejects URL credentials and does not start, package, or serve the Next.js app.

## Experimental Local Integrations

MoneySiren includes optional local-only experiments for AI CLI usage visibility. Experimental integrations are isolated and documented separately because upstream behavior may change.

These integrations are not required for the core MoneySiren workflow. The core workflow remains read-only provider sync, normalized local SQLite snapshots, local dashboard/HUD views, fake fixtures for review, and telemetry off by default.

See [docs/experimental-integrations.md](docs/experimental-integrations.md) and [docs/codex-reset-credits.md](docs/codex-reset-credits.md).

## Desktop Tray, Notifications, and HUD

The desktop tray/notifier opens the same local dashboard runtime and a compact always-on-top HUD at `/hud`. The HUD is a native desktop window, not a web page overlay. It supports configurable font size, opacity, always-on-top behavior, refresh, minimize, close, and a separate HUD widget list.

The HUD uses a local-only shared view model and refresh contract. It polls sanitized local AI usage every 5 seconds, keeps the last good value on refresh failure, separates sync state from risk state, and treats Codex App and Codex CLI reset credits as separate pools. See [docs/local-hud-sync.md](docs/local-hud-sync.md).

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

Run the local validation gate with the same command set used by CI:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm tray:native:check
npm run secret:scan
npm run secret:scan:all
git diff --check
```

For documentation-only changes, at minimum run:

```bash
git diff --check -- README.md docs/install.md
npm run secret:scan
```

`npm run secret:scan` checks the current tracked and untracked text tree. `npm run secret:scan:all` also scans Git history for deleted secrets and sensitive local artifacts before public review.
