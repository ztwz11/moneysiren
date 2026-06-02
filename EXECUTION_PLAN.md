# StackSpend Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M9`
- Current slice: `S9-local-dashboard`
- Canonical source: `docs/product/execution-plan.md`, section `M9 — Local dashboard`
- Approval: `M9/S9-local-dashboard` is approved and currently selected for the coding loop.

## Slice History

- `M1/S1-monorepo-bootstrap` completed locally.
- `M2/S2-core-config-db-security` completed locally and remains intentionally uncommitted for review.
- `M3/S3-cli-mock-pipeline` completed locally and remains intentionally uncommitted for review.
- `M4/S4-aws-connector` completed locally.
- `M5/S5-openai-connector` completed locally.
- `M6/S6-supabase-connector` completed locally.
- `M7/S7-cloudflare-connector` completed locally.
- `M8/S8-slack-report` completed locally.
- `M9/S9-local-dashboard` is the current approved slice.

## M9/S9 Summary

Deliver a local-first dashboard placeholder backed by normalized SQLite data:

- Next.js App Router dashboard page
- `/api/dashboard` normalized JSON route
- testable data adapter for local SQLite reads and safe missing-DB empty state
- summary cards, provider cost table, usage/risk section, health status, and recent alerts
- no provider API calls
- no credentials, `.env`, telemetry, raw payload fields, or provider account refs in dashboard responses

Do not persist raw provider payloads.
Do not create `.env`.
Do not add telemetry.
Do not expose credentials, webhook URLs, account IDs, project IDs, invoice IDs, emails, or billing profiles.

## Validation Commands For M9/S9 Review

```bash
pnpm --filter @stackspend/web test
pnpm test
pnpm typecheck
git diff --check
git diff --name-only --diff-filter=ACM -z | xargs -0 rg -n -e 'sk-[A-Za-z0-9_-]{8,}' -e 'hooks\.slack\.com/services/[A-Za-z0-9/_-]+' -e 'acct_[A-Za-z0-9_-]{6,}' -e 'project_[A-Za-z0-9_-]{6,}' -e 'invoice_[A-Za-z0-9_-]{6,}' -e '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
```
