# MoneySiren

MoneySiren is an MIT-licensed local-first observability dashboard for AI coding agent, cloud, and SaaS usage. It helps open-source maintainers, indie developers, and small teams monitor OpenAI/Codex, Claude CLI, AWS, Supabase, and Cloudflare usage/cost risk without sending credentials, raw billing payloads, or local AI logs to a hosted service.

MoneySiren is not a hosted SaaS. Provider connectors are read-only, normalized snapshots stay in local SQLite, and telemetry is off by default.

## 5-Minute Quickstart

Use the source-free app package when you want to try MoneySiren without cloning this repository:

```bash
npm install -g @moneysiren/app
msiren --version
msiren install --status
msiren doctor
msiren install --web
msiren sync --provider mock
msiren start
```

Open the local dashboard that `msiren start` launches. The `mock` provider uses fake local review data and does not require OpenAI, AWS, Supabase, Cloudflare, Codex, or Claude credentials.

If `msiren install --web` reports that the matching GitHub Release asset is unavailable, the npm CLI is installed but the source-free dashboard runtime is not published for that tag yet. Use [Quickstart From Source](#quickstart-from-source) until the release asset is available.

For source development, use [Quickstart From Source](#quickstart-from-source).

## Why MoneySiren Exists

AI coding agents make open-source maintenance faster, but they also create new operational risks:

- usage limits are easy to burn through;
- API and cloud costs are fragmented across providers;
- local AI CLI logs can contain sensitive prompts, shell commands, and project context;
- maintainers need visibility without uploading secrets to another SaaS.

MoneySiren provides a local-first dashboard for those risks.

## What Stays Local

MoneySiren is built for local review, not hosted billing collection:

- provider credentials stay in the local process environment or optional local credential store;
- raw provider payloads, raw billing profiles, local AI prompt text, shell command bodies, raw JSONL lines, and auth file contents must not be stored;
- normalized usage, billing, health, and audit snapshots stay in local SQLite;
- local Codex/Claude surfaces expose sanitized usage metadata only;
- telemetry is off by default.

See [docs/data-we-never-store.md](docs/data-we-never-store.md), [docs/security-model.md](docs/security-model.md), and [SECURITY.md](SECURITY.md).

## What It Supports Today

| Area | Providers / surfaces |
|---|---|
| AI usage/cost | OpenAI Usage/Costs, Codex CLI, Claude CLI |
| Cloud/SaaS cost | AWS Cost Explorer, Cloudflare |
| Usage/health | Supabase |
| Local surfaces | CLI, Next.js dashboard, Tauri tray/HUD |
| Notifications | Desktop HUD, Korean daily report, optional Slack webhook |

## Current Status

MoneySiren `v0.1.5` is the current public local patch release over the initial `v0.1.0` public local release.

It provides source-free local installation through `@moneysiren/app`, a CLI-first setup flow, local SQLite snapshots, a local Next.js dashboard, and a Tauri tray/HUD desktop surface. MoneySiren remains early and local-first: provider connectors are read-only, telemetry is off by default, and raw provider payloads or credential material must not be persisted.

The public local release supports:

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

The recommended source-free install is `@moneysiren/app`. It deterministically installs the CLI aliases (`moneysiren` and `msiren`) without a remote runtime request. Run `msiren install --web` explicitly to download and verify the matching GitHub Release web runtime. Windows HUD artifacts require signed release metadata by default; before signing is ready, unsigned HUD testing requires explicit local opt-in. Use `@moneysiren/cli` only for CLI-only automation.

## Try It Without Credentials

The fastest safe demo path is fixture-backed:

```bash
msiren install --web
msiren doctor
msiren sync --provider mock
msiren start
```

This path creates local fake review snapshots only. It should never require API keys, provider account IDs, webhook URLs, local AI auth files, local prompt text, or raw provider payloads.

For guided scenarios, see [docs/demo.md](docs/demo.md) and [docs/demo-scenarios.md](docs/demo-scenarios.md).

## Connect Your First Provider

Pick one provider first and keep the credential visible to the MoneySiren process that runs the sync or dashboard:

| Provider | Minimal local setup | Read-only boundary |
|---|---|---|
| OpenAI | `OPENAI_ADMIN_KEY` visible to the MoneySiren process or saved as a local read-only credential | Reads usage/cost surfaces only |
| Codex App/CLI | Local Codex app or CLI metadata/log location | Reads sanitized usage/quota metadata only; prompt/log contents are not exposed |
| AWS | `AWS_PROFILE` or SDK credential chain visible to the MoneySiren process | Reads Cost Explorer data only |

More providers and permission notes are in [docs/provider-support-matrix.md](docs/provider-support-matrix.md) and [docs/provider-permissions.md](docs/provider-permissions.md).

## Emergency Readiness Is Not Provider Execution

MoneySiren emergency readiness is a local planning and audit surface. It does not call provider write APIs, stop cloud resources, revoke keys, pause projects, disable workers, or add execution buttons. Official provider links and manual checklists are used so the user stays in control.

See [docs/product/emergency-actions-spec.md](docs/product/emergency-actions-spec.md), [docs/product/emergency-actions-permission-matrix.md](docs/product/emergency-actions-permission-matrix.md), and [docs/product/emergency-actions-threat-model.md](docs/product/emergency-actions-threat-model.md).

## Troubleshooting

Common first-run issues are covered in [docs/troubleshooting.md](docs/troubleshooting.md), including:

- OpenAI Admin API key set in PowerShell after the server started;
- Codex App connected while Codex CLI shows a warning;
- `AWS_PROFILE` or AWS SSO not visible to the MoneySiren process;
- stale live data versus canonical sync;
- emergency readiness being manual-only.

## Docs

- [Install and source setup](docs/install.md)
- [Demo without credentials](docs/demo.md)
- [Demo scenarios](docs/demo-scenarios.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Security model](docs/security-model.md)
- [Release supply-chain security](docs/security/release-supply-chain.md)
- [Data we never store](docs/data-we-never-store.md)
- [Provider permissions](docs/provider-permissions.md)
- [Provider support matrix](docs/provider-support-matrix.md)
- [Local-first architecture](docs/local-first-architecture.md)
- [Good first issues](docs/good-first-issues.md)
- [Roadmap](docs/roadmap.md)
- [Codex for Open Source](docs/codex-for-open-source.md)

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/good-first-issues.md](docs/good-first-issues.md). Safe first contributions are docs, fake fixture scenarios, redaction tests, connection diagnostics tests, provider official-link updates, and UI copy improvements. Do not include credentials, raw provider payloads, real account identifiers, local AI prompt text, shell command bodies, raw JSONL lines, or auth file contents in issues or pull requests.

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

- Node.js 22.13 or newer. The current package manager and test/build toolchain require Node 22.13+ or newer LTS releases.
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

Live connector paths are read-only and env-only in this release. Do not create `.env` files or commit live credentials.

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

## NPM App Install

For normal source-free installs, use the app package from the `latest` npm channel:

```bash
npm install -g @moneysiren/app
msiren --version
msiren start
msiren hud
```

`@moneysiren/app` is the all-in-one package for the CLI, local web dashboard, and HUD. Postinstall creates the `moneysiren` and shorter `msiren` global command shims but makes no remote runtime request. Run `msiren install --web` explicitly; the installer requires the matching versioned release manifest, bounded download, exact size/SHA256, safe archive, and atomic activation. Run `msiren install --hud --allow-unsigned-hud` only for temporary local unsigned HUD smoke testing. The current app package no longer uses npm-managed `bin` aliases, which avoids npm's `EEXIST` bin conflict with older prerelease installs.

After npm install, commands are installed while the remote runtime is intentionally `not-installed`. Install and verify it explicitly:

```bash
msiren install --web
msiren install --status
```

If npm reports `EEXIST` for `moneysiren` or `msiren`, remove the older global MoneySiren packages and reinstall the app package:

```powershell
npm uninstall -g @moneysiren/cli @moneysiren/app
npm install -g @moneysiren/app --force
```

Maintainers can verify the public npm packages from the repository root:

```bash
npm run publish:cli:dry-run
npm run publish:app:dry-run
```

The dry runs check the full secret scan, npm package metadata, registry version availability, and tarball contents.

For the guarded public release flow, use:

```bash
npm run release:public:dry-run
npm run release:public
```

`release:public` requires a non-prerelease semver such as `0.1.0`, runs the release validation suite, creates the annotated `v*` tag, pushes `main`, and pushes the tag. It does not run `npm publish` locally; tag-push GitHub Actions publish `@moneysiren/cli` and `@moneysiren/app` with the `latest` dist-tag and create the GitHub Release assets. Use `npm run release:public:include-working-tree` only when you intentionally want current local changes included in the release commit.

During an interactive PowerShell, cmd, or shell install, the package asks which local surfaces to enable:

- CLI
- Web dashboard
- HUD

Press Enter to accept the recommended default, which selects all three. In CI or non-interactive npm installs, MoneySiren writes that same all-selected profile automatically. The npm package installs both `moneysiren` and the shorter `msiren` command. Run `msiren install --all` to download the matching GitHub Release assets for the web runtime and HUD desktop shell, or `msiren install --profile-only` to only change the local profile.

The same source tree supports Windows and macOS. Local config paths and native desktop artifacts are selected per OS. The shared runtime lock defaults to `%APPDATA%\MoneySiren\runtime.json` on Windows and `~/Library/Application Support/MoneySiren/runtime.json` on macOS so the npm CLI and native tray can discover the same local runtime.

## Source-Free Desktop Release

After a `desktop-release` GitHub Actions run publishes assets, users can review MoneySiren without cloning the repository:

```bash
npm install -g @moneysiren/app
msiren install --status
msiren sync --provider mock
msiren start
msiren hud
msiren status
msiren stop
```

`msiren install --all` stores the selected release assets under the MoneySiren local application data directory by default. `msiren start` extracts and starts the installed web runtime, then opens the local dashboard. `msiren hud` ensures the web runtime is running and opens the desktop HUD shell when a runnable desktop app is installed or configured. `msiren status` shows the managed web, HUD, and local API runtime state. `msiren stop` stops managed runtimes; use `msiren stop --web`, `msiren stop --hud`, or `msiren stop --api` when you only want to stop one surface. `msiren restart` stops the managed web/HUD pair and starts the dashboard again.

To install the web runtime from a specific release tag or into a custom directory:

```bash
msiren install --web --tag v0.1.5 --dir ./moneysiren-release
```

If the desktop installer was installed to a non-default location, point the CLI at it before opening HUD:

```bash
MONEYSIREN_DESKTOP_APP="<path-to-installed-MoneySiren-app>" msiren hud
```

The desktop shell connects to `http://127.0.0.1:3000` for the dashboard and HUD. In this initial public local release, the native app still runs as a thin local shell, but the CLI handles the web runtime startup path.

Release maintainers should verify published assets before announcing a desktop build:

```bash
npm run release:signing:encode-windows -- "<path-to-windows-code-signing.pfx>"
npm run release:signing:check -- windows
npm run release:check -- v0.1.5
```

The encode helper writes the base64 certificate payload to `.tmp/codesign/windows-certificate.base64.txt` so maintainers can set the `WINDOWS_CERTIFICATE` repository secret without printing the private certificate to the terminal. Set `WINDOWS_CERTIFICATE_PASSWORD` to the PFX/P12 password in GitHub Secrets and in the local shell before running the signing readiness check. The signing check verifies local/CI signing inputs before a release run. The release check downloads the published assets, verifies SHA256 entries, requires Windows signature metadata, and validates Windows Authenticode signatures when run on Windows. If only one desktop signing identity is ready, run the `desktop-release` workflow with `desktop_targets=windows` or `desktop_targets=macos`; the publish step removes stale desktop assets for the skipped OS. Self-signed certificates are acceptable only for local smoke tests and do not fix public Windows publisher trust warnings.

Unsigned Windows HUD artifacts are allowed only for explicit prerelease or local smoke review paths. Keep that path out of the public release validation:

```bash
npm run release:check -- v0.1.0-rc.1 --allow-unsigned-prerelease-windows
```

For temporary local HUD smoke testing before SignPath or another trusted Windows signing path is ready, users must opt in explicitly:

```powershell
msiren install --hud --allow-unsigned-hud
msiren hud
```

This does not change public release validation and does not remove Windows publisher warnings. Without the explicit flag, public release HUD installs still require Windows signature metadata. `MONEYSIREN_ALLOW_UNSIGNED_HUD=true` remains available for advanced explicit installer or CI smoke paths. For prerelease tags such as `alpha`, `beta`, or `rc`, set `MONEYSIREN_ALLOW_UNSIGNED_HUD=false` to require signed HUD metadata even for prerelease builds.

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
npm run typecheck
npm run test
npm run build
npm run tray:native:check
npm run secret:scan
npm run secret:scan:all
git diff --check
```

For documentation-only changes, at minimum run:

```bash
git diff --check -- README.md docs
npm run secret:scan
```

`npm run secret:scan` checks the current tracked and untracked text tree. `npm run secret:scan:all` also scans Git history for deleted secrets and sensitive local artifacts before public review.
