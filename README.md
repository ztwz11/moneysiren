# StackSpend

Local-first cloud/SaaS usage, status, and expected billing dashboard for individual developers and small teams.

StackSpend keeps provider credentials, SQLite snapshots, local logs, and reports on the user's machine by default. It is not a hosted SaaS, and provider connectors are read-only.

## Status

StackSpend is preparing `v0.1.0-alpha.0` for local review. The supported alpha path is local CLI sync into SQLite plus a local Next.js dashboard.

## Why Local-First?

Cloud, SaaS, and AI usage data often includes sensitive identifiers and billing context. StackSpend is designed so users can inspect usage and cost risk without sending API keys or raw provider responses to a hosted service.

Core security expectations:

- Secrets are read from local env, OS keychain, or an explicitly configured encrypted vault.
- SQLite stores normalized snapshots, not credential material.
- Raw provider payloads must not be persisted in SQLite, dashboard JSON, reports, Slack payloads, logs, fixtures, screenshots, or test snapshots.
- Today live values are provisional overlays, not confirmed canonical history.
- Telemetry is off by default and any future telemetry must be opt-in only.

See [docs/security-model.md](docs/security-model.md) for the detailed security model.

## Supported Providers

| Provider | Status | Data | Auth |
|---|---|---|---|
| AWS | available | cost, usage, forecast | AWS profile / SSO |
| OpenAI | available | organization usage, costs | Admin API key |
| Supabase | experimental | usage, health | OAuth / PAT |
| Cloudflare | experimental | billing, usage | API token |
| GCP | planned/local setup | CLI and ADC readiness | gcloud CLI |
| Codex CLI | local-only | local usage and quota estimate | local CLI/logs |
| Claude CLI | local-only | local usage and quota estimate | local CLI/statusline/logs |

Codex CLI and Claude CLI are local usage providers, not API billing providers. StackSpend prioritizes 5-hour quota percent, weekly quota percent, and rolling token usage where those values can be derived safely. See [docs/local-ai-cli-usage.md](docs/local-ai-cli-usage.md).

## v0.1 Direction

- TypeScript + pnpm workspace
- CLI-first workflow
- Local SQLite storage
- Local Next.js dashboard
- Read-only provider connectors
- Korean daily reports
- Slack webhook delivery
- No telemetry by default
- Env-only secrets for v0.1

## Local Quickstart

```bash
pnpm install
pnpm --filter @stackspend/cli dev
pnpm --filter @stackspend/cli dev -- /doctor
pnpm --filter @stackspend/cli dev -- doctor
pnpm --filter @stackspend/cli dev -- init
pnpm --filter @stackspend/cli dev -- sync --provider mock
pnpm --filter @stackspend/cli dev -- report daily --lang ko
npm run dev
```

`npm run dev` starts the local web dashboard, the native taskbar/tray layer, and the Tauri dashboard window together. Open the dashboard at `http://localhost:3000` or use the StackSpend Tauri window. The dashboard reads normalized local SQLite snapshots from `STACKSPEND_DB_PATH`, defaulting to `.stackspend/stackspend.sqlite`.

Use `npm run dev:web` when you need only the web dashboard without the taskbar/tray layer.
Use `npm run dev:tray` only when the local web dashboard is already running at `http://127.0.0.1:3000`.

For a production-style local run after building the web app and unsigned native desktop layer:

```bash
npm run build:local
npm start
```

`npm run build:local` runs the workspace build and then builds the unsigned Tauri desktop artifact. `npm start` starts the built Next.js dashboard, waits for `http://127.0.0.1:3000/ko/dashboard/overview`, and then launches the built StackSpend tray/Tauri executable.

Use `npm run start:web` when you need only the built web dashboard.
Use `npm run start:tray` only when the built web dashboard is already running at `http://127.0.0.1:3000`.

In a second terminal, verify the local dashboard API and page URL:

```bash
pnpm --filter @stackspend/cli dev -- dashboard check
```

Run the full local validation gate with:

```bash
pnpm test
pnpm typecheck
git diff --check
```

## NPM Alpha CLI Preview

The CLI package is prepared for a public npm alpha as `@stackspend/cli`, but this repository workflow does not publish it.

Once an alpha is published:

```bash
npm install -g @stackspend/cli@alpha
stackspend
stackspend --version
stackspend /version
stackspend doctor
stackspend /doctor
npx --package @stackspend/cli@alpha stackspend --version
```

For local tarball review without publishing:

```bash
pnpm --filter @stackspend/cli build
cd apps/cli
npm pack
TARBALL_PATH="$(pwd)/stackspend-cli-0.1.0-alpha.0.tgz"
mkdir -p /tmp/stackspend-alpha-review
cd /tmp/stackspend-alpha-review
npm init -y
npm install "$TARBALL_PATH"
npm exec stackspend
npm exec stackspend -- --version
npm exec stackspend -- /version
npm exec stackspend -- doctor
npm exec stackspend -- /doctor
```

Alpha CLI requirements:

- Node.js 20.11 or newer.
- `sqlite3` CLI on `PATH`; Linux/Docker defaults to `/usr/bin/sqlite3`, and Windows can use `sqlite3.exe`.
- `STACKSPEND_SQLITE_BIN` can point to a local SQLite CLI path when it is not on `PATH`.
- Environment variables only for secrets; do not create `.env` or commit live credentials.
- `stackspend --version`, `stackspend doctor`, and `stackspend sync --provider mock` do not require live provider credentials.

## CLI Commands

Running `stackspend` without subcommands prints a slash-command home guide. In a local TTY it may continue into a minimal line-based slash prompt; in CI or non-TTY package review it prints the guide and exits `0`.

```bash
pnpm --filter @stackspend/cli dev
pnpm --filter @stackspend/cli dev -- --help
pnpm --filter @stackspend/cli dev -- --version
pnpm --filter @stackspend/cli dev -- doctor
pnpm --filter @stackspend/cli dev -- init
pnpm --filter @stackspend/cli dev -- sync --provider mock
pnpm --filter @stackspend/cli dev -- dashboard check
pnpm --filter @stackspend/cli dev -- report daily --lang ko
```

Slash aliases are thin wrappers around the same commands:

```bash
pnpm --filter @stackspend/cli dev -- /help
pnpm --filter @stackspend/cli dev -- /version
pnpm --filter @stackspend/cli dev -- /doctor
pnpm --filter @stackspend/cli dev -- /init
pnpm --filter @stackspend/cli dev -- /dashboard
pnpm --filter @stackspend/cli dev -- /dashboard check
pnpm --filter @stackspend/cli dev -- /sync mock
pnpm --filter @stackspend/cli dev -- /report ko
```

Home/help never creates `.env`, prints secret values, calls provider APIs, or enables telemetry.

## Provider Fixture Mode

Fixture mode uses fake local payloads under `tests/fixtures/providers` and does not require live credentials.

```bash
STACKSPEND_AWS_COST_EXPLORER_FIXTURE=tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json \
  pnpm --filter @stackspend/cli dev -- sync --provider aws

STACKSPEND_OPENAI_USAGE_FIXTURE=tests/fixtures/providers/openai/usage-costs.json \
STACKSPEND_OPENAI_COSTS_FIXTURE=tests/fixtures/providers/openai/usage-costs.json \
  pnpm --filter @stackspend/cli dev -- sync --provider openai

STACKSPEND_SUPABASE_FIXTURE=tests/fixtures/providers/supabase/usage-health.json \
  pnpm --filter @stackspend/cli dev -- sync --provider supabase

STACKSPEND_CLOUDFLARE_FIXTURE=tests/fixtures/providers/cloudflare/billing-usage.json \
  pnpm --filter @stackspend/cli dev -- sync --provider cloudflare
```

Live connector paths are read-only and env-only in this alpha. Fixture mode remains the recommended no-credentials review path. Do not commit `.env` or write provider credentials or provider identifiers into repository files.

## Local Dashboard

Create or sync local data first, then run:

```bash
pnpm --filter @stackspend/web dev
```

The dashboard makes no provider API calls. It reads normalized SQLite data only and returns a safe empty state if the database is missing.

Use the CLI check command from another terminal to probe the local dashboard API:

```bash
pnpm --filter @stackspend/cli dev -- dashboard check
pnpm --filter @stackspend/cli dev -- dashboard check --url http://localhost:3000
```

The check command sanitizes the printed dashboard URL and ignores path, query, and hash values. It rejects URL credentials and does not start, package, or serve the Next.js app.

## Slack Report

Slack delivery is opt-in per run and requires `SLACK_WEBHOOK_URL` in the process environment:

```bash
pnpm --filter @stackspend/cli dev -- report daily --lang ko
pnpm --filter @stackspend/cli dev -- report daily --lang ko --send slack
```

Do not write webhook URLs into `.env`, docs, test fixtures, or committed files.

## Docker Local Review

Docker support is for local self-host/dev review only. The image and Compose file do not contain credentials.

```bash
docker compose build
docker compose run --rm stackspend pnpm --filter @stackspend/cli dev -- sync --provider mock
docker compose up stackspend
```

Compose stores SQLite data in the `stackspend_data` volume at `/data/stackspend.sqlite` and exposes the dashboard on `http://localhost:3000`.

The Compose environment includes fake fixture paths, so fixture connector review can run without secrets:

```bash
docker compose run --rm stackspend pnpm --filter @stackspend/cli dev -- sync --provider aws
docker compose run --rm stackspend pnpm --filter @stackspend/cli dev -- sync --provider openai
docker compose run --rm stackspend pnpm --filter @stackspend/cli dev -- sync --provider supabase
docker compose run --rm stackspend pnpm --filter @stackspend/cli dev -- sync --provider cloudflare
```

For a Docker build dry validation:

```bash
docker build --pull=false --target verify -t stackspend:m10-verify .
```

## Security Posture

StackSpend should never persist raw provider payloads or secrets. Provider data must be normalized and redacted before storage.
