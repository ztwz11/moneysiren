# StackSpend Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M8`
- Current slice: `S8-slack-report`
- Canonical source: `docs/product/execution-plan.md`, section `M8 — Slack report`
- Approval: `M8/S8-slack-report` is approved and currently selected for the coding loop.

## Slice History

- `M1/S1-monorepo-bootstrap` completed locally.
- `M2/S2-core-config-db-security` completed locally and remains intentionally uncommitted for review.
- `M3/S3-cli-mock-pipeline` completed locally and remains intentionally uncommitted for review.
- `M4/S4-aws-connector` completed locally.
- `M5/S5-openai-connector` completed locally.
- `M6/S6-supabase-connector` completed locally.
- `M7/S7-cloudflare-connector` completed locally.
- `M8/S8-slack-report` is the current approved slice.

## M8/S8 Summary

Deliver the Korean daily report to Slack only when explicitly requested:

- dry-run report remains `stackspend report daily --lang ko`
- Slack delivery is `stackspend report daily --lang ko --send slack`
- env-only `SLACK_WEBHOOK_URL`
- injectable Slack transport for tests and fixtures
- no live Slack calls in tests
- `report_runs` records Slack `sent` and `error` statuses
- Korean report text uses Slack-readable bullets and dividers

Do not persist raw provider payloads.
Do not create `.env`.
Do not add real credentials or webhook URLs.
Do not add telemetry.
Do not log or persist `SLACK_WEBHOOK_URL`.

## Validation Commands For M8/S8 Review

```bash
pnpm --filter @stackspend/report test
pnpm --filter @stackspend/cli test
pnpm test
pnpm typecheck
git diff --check
```
