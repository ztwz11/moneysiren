# StackSpend Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M6`
- Current slice: `S6-supabase-connector`
- Canonical source: `docs/product/execution-plan.md`, section `M6 — Supabase connector`
- Approval: `M6/S6-supabase-connector` is approved and currently selected for the coding loop.

## Slice History

- `M1/S1-monorepo-bootstrap` completed locally.
- `M2/S2-core-config-db-security` completed locally and remains intentionally uncommitted for review.
- `M3/S3-cli-mock-pipeline` completed locally and remains intentionally uncommitted for review.
- `M4/S4-aws-connector` completed locally.
- `M5/S5-openai-connector` completed locally.
- `M6/S6-supabase-connector` is the current approved slice.

## M6/S6 Summary

Collect Supabase usage and project health snapshots through a read-only Management API contract:

- Supabase usage/health connector
- env-only `SUPABASE_ACCESS_TOKEN`
- read-only provider access
- fixture-backed validation path via `STACKSPEND_SUPABASE_FIXTURE`
- project and organization identifier redaction
- normalized local persistence only

Do not persist raw provider payloads.
Do not create `.env`.
Do not add real credentials.
Do not add telemetry.

## Validation Commands For M6/S6 Review

```bash
pnpm test
pnpm typecheck
git diff --check
```
