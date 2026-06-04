# StackSpend v0.1 Implementation Plan

> **For Hermes/Codex:** Use controlled, slice-by-slice implementation. Keep product artifacts inside this repository. Do not modify `auto-driver` for product files.

**Goal:** Build a local-first, CLI-first cloud/SaaS usage, status, and expected billing dashboard for individual developers and small teams.

**Architecture:** TypeScript pnpm monorepo with a CLI app, a local Next.js dashboard, shared core/config/db/security/report packages, and read-only provider connectors. SQLite is the default local persistence layer; raw provider payloads are redacted and normalized before storage.

**Tech Stack:** TypeScript, pnpm, Vitest, SQLite, Next.js, Node.js, Slack webhook.

---

## Global Repository Boundary

- Product repo: `stackspend`.
- Automation repo: `auto-driver`.
- Product files must not be created in `auto-driver`.
- `auto-driver` should ideally remain clean during StackSpend implementation.

## M0 — Product planning and spec lock

Goal: establish the product scope, security posture, repo rules, and implementation plan.

Files:

- `AGENTS.md`
- `README.md`
- `.gitignore`
- `.env.example`
- `LICENSE`
- `docs/product/dossier.md`
- `docs/product/decision-log.md`
- `docs/product/execution-plan.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/providers/aws.md`
- `docs/providers/openai.md`
- `docs/providers/supabase.md`
- `docs/providers/cloudflare.md`

Completion criteria:

- v0.1 scope and out-of-scope are explicit.
- security rules are explicit.
- provider docs identify permissions, data surfaces, and risks.
- implementation is not started yet.

Review gate:

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
```

## M1 — Monorepo bootstrap

Goal: create a TypeScript pnpm workspace skeleton with CLI, web, shared packages, and one security utility test.

Files:

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `apps/cli/package.json`
- `apps/cli/src/index.ts`
- `apps/web/package.json`
- `apps/web/app/page.tsx`
- `packages/core/package.json`
- `packages/core/src/index.ts`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/db/package.json`
- `packages/db/src/index.ts`
- `packages/security/package.json`
- `packages/security/src/mask.ts`
- `packages/security/src/mask.test.ts`
- `packages/report/package.json`
- `packages/report/src/index.ts`
- `packages/connectors/mock/package.json`
- `packages/connectors/mock/src/index.ts`

Implementation details:

- TypeScript strict mode.
- Vitest for tests.
- minimal CLI prints help/version.
- `maskSecret` test proves obvious secrets are masked.
- placeholder exports only.
- no real provider API implementation.

Validation:

```bash
pnpm install
pnpm test
pnpm typecheck
```

Completion criteria:

- tests pass.
- typecheck passes.
- no `.env` file created.
- no real credentials.

## M2 — Core/config/db/security

Goal: implement config schema, config loader, SQLite migrations, provider interface, and redaction utilities.

Files:

- `packages/config/src/schema.ts`
- `packages/config/src/load.ts`
- `packages/db/src/client.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/migrate.ts`
- `packages/db/migrations/0001_init.sql`
- `packages/core/src/provider.ts`
- `packages/core/src/collector.ts`
- `packages/core/src/snapshots.ts`
- `packages/security/src/redact.ts`
- `packages/security/src/mask.ts`

Implementation details:

- env-only config.
- default DB path `.stackspend/stackspend.sqlite`.
- tables: providers, provider_accounts, usage_snapshots, billing_snapshots, service_health_snapshots, cost_estimates, alerts, report_runs.
- raw payload persistence is disallowed by design.

Tests:

- migration idempotency.
- config validation.
- redaction of account IDs, project IDs, invoice IDs, emails, tokens, webhook URLs.

Review gate:

- No raw provider payload table or column.
- Secret and identifier masking tests pass.

## M3 — CLI with mock provider

Goal: prove the sync/report pipeline without external APIs.

Commands:

- `stackspend init`
- `stackspend doctor`
- `stackspend sync --provider mock`
- `stackspend report daily --lang ko`

Files:

- `apps/cli/src/commands/init.ts`
- `apps/cli/src/commands/doctor.ts`
- `apps/cli/src/commands/sync.ts`
- `apps/cli/src/commands/report.ts`
- `packages/connectors/mock/src/index.ts`
- `packages/report/src/daily.ts`
- `packages/report/src/korean.ts`

Completion criteria:

- mock snapshots saved to SQLite.
- Korean report generated locally.
- no network calls.

## M4 — AWS connector

Goal: collect AWS Cost Explorer billing snapshots and service-level cost grouping.

Files:

- `packages/connectors/aws/src/index.ts`
- `packages/connectors/aws/src/cost-explorer.ts`
- `packages/connectors/aws/src/normalize.ts`
- `docs/providers/aws.md`
- `tests/fixtures/providers/aws/*`

Completion criteria:

- uses profile/env credentials only.
- read-only Cost Explorer calls.
- fixture tests pass.
- raw AWS response is not persisted.

## M5 — OpenAI connector

Goal: collect OpenAI usage/cost snapshots using verified current API docs.

Files:

- `packages/connectors/openai/src/index.ts`
- `packages/connectors/openai/src/client.ts`
- `packages/connectors/openai/src/normalize.ts`
- `docs/providers/openai.md`
- `tests/fixtures/providers/openai/*`

Precondition:

- verify official OpenAI Usage/Costs API docs and record `verified_at` in provider docs.

Completion criteria:

- env-only `OPENAI_ADMIN_KEY`.
- fixture tests pass.
- sensitive identifiers redacted.

## M6 — Supabase connector

Goal: collect Supabase usage and project health snapshots.

Files:

- `packages/connectors/supabase/src/index.ts`
- `packages/connectors/supabase/src/client.ts`
- `packages/connectors/supabase/src/normalize.ts`
- `docs/providers/supabase.md`
- `tests/fixtures/providers/supabase/*`

Completion criteria:

- env-only `SUPABASE_ACCESS_TOKEN`.
- project IDs are redacted before storage.
- unavailable API surfaces degrade to alerts.

## M7 — Cloudflare experimental connector

Goal: collect Cloudflare billing/usage data where available and degrade gracefully where restricted.

Files:

- `packages/connectors/cloudflare/src/index.ts`
- `packages/connectors/cloudflare/src/client.ts`
- `packages/connectors/cloudflare/src/normalize.ts`
- `docs/providers/cloudflare.md`
- `tests/fixtures/providers/cloudflare/*`

Completion criteria:

- env-only `CLOUDFLARE_API_TOKEN`.
- experimental flag/default-off documented.
- restricted API fallback emits warning alert.

## M8 — Slack report

Goal: send Korean daily report through Slack webhook only when explicitly requested.

Files:

- `packages/report/src/slack.ts`
- `packages/report/src/daily.ts`
- `packages/report/src/korean.ts`
- `apps/cli/src/commands/report.ts`

Completion criteria:

- dry-run report works without Slack.
- `--send slack` is required for actual send.
- tests use injectable transport and never call live Slack.
- missing `SLACK_WEBHOOK_URL` fails gracefully.
- `report_runs` records Slack `sent` and `error` delivery statuses.
- Korean report text uses Slack-readable section dividers and bullets.
- webhook URL is never logged or persisted.

## M9 — Local dashboard

Goal: display local SQLite summary cards, provider table, risk/health sections, and recent alerts.

Files:

- `apps/web/app/page.tsx`
- `apps/web/app/api/dashboard/route.ts`
- `apps/web/components/SummaryCards.tsx`
- `apps/web/components/ProviderTable.tsx`
- `apps/web/components/RiskSection.tsx`
- `apps/web/components/HealthSection.tsx`

Completion criteria:

- reads normalized local data only.
- no telemetry.
- no secret exposure in API responses.

## M10 — Docker/docs/alpha release

Goal: make v0.1.0-alpha easy to run and review.

Files:

- `Dockerfile`
- `compose.yaml`
- `apps/cli/package.json`
- `apps/cli/tsconfig.build.json`
- `apps/cli/README.md`
- `docs/product/v0.1.0-alpha-checklist.md`
- `README.md`
- `docs/security.md`

Completion criteria:

- mock demo can run without real credentials.
- `@stackspend/cli` can be packed into a public alpha npm tarball without tests or external source files.
- installed tarball can run `stackspend --version` and `stackspend doctor` without live credentials.
- security docs describe secrets, redaction, and local storage.
- alpha checklist passes.
