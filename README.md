# StackSpend

Local-first cloud/SaaS usage, status, and expected billing dashboard for individual developers and small teams.

## Status

StackSpend is preparing `v0.1.0-alpha.0` for local review. The supported alpha path is local CLI sync into SQLite plus a local Next.js dashboard.

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
pnpm --filter @stackspend/cli dev -- doctor
pnpm --filter @stackspend/cli dev -- init
pnpm --filter @stackspend/cli dev -- sync --provider mock
pnpm --filter @stackspend/cli dev -- report daily --lang ko
pnpm --filter @stackspend/web dev
```

Open the dashboard at `http://localhost:3000`. The dashboard reads normalized local SQLite snapshots from `STACKSPEND_DB_PATH`, defaulting to `.stackspend/stackspend.sqlite`.

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
stackspend --version
stackspend doctor
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
npm exec stackspend -- --version
npm exec stackspend -- doctor
```

Alpha CLI requirements:

- Node.js 20.11 or newer.
- `sqlite3` CLI at `/usr/bin/sqlite3` for the current local SQLite runtime path.
- Environment variables only for secrets; do not create `.env` or commit live credentials.
- `stackspend --version`, `stackspend doctor`, and `stackspend sync --provider mock` do not require live provider credentials.

## CLI Commands

```bash
pnpm --filter @stackspend/cli dev -- --help
pnpm --filter @stackspend/cli dev -- --version
pnpm --filter @stackspend/cli dev -- doctor
pnpm --filter @stackspend/cli dev -- init
pnpm --filter @stackspend/cli dev -- sync --provider mock
pnpm --filter @stackspend/cli dev -- report daily --lang ko
```

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

Live connector paths remain fixture-first in this alpha. Do not commit `.env` or write provider credentials into repository files.

## Local Dashboard

Create or sync local data first, then run:

```bash
pnpm --filter @stackspend/web dev
```

The dashboard makes no provider API calls. It reads normalized SQLite data only and returns a safe empty state if the database is missing.

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
