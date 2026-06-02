# StackSpend Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M5`
- Current slice: `S5-openai-connector`
- Canonical source: `docs/product/execution-plan.md`, section `M5 — OpenAI connector`
- Approval: `M5/S5-openai-connector` is approved and currently selected for the coding loop.

## Slice History

- `M1/S1-monorepo-bootstrap` completed locally.
- `M2/S2-core-config-db-security` completed locally and remains intentionally uncommitted for review.
- `M3/S3-cli-mock-pipeline` completed locally and remains intentionally uncommitted for review.
- `M4/S4-aws-connector` completed locally.
- `M5/S5-openai-connector` is the current approved slice.

## M5/S5 Summary

Collect OpenAI usage and cost snapshots using verified current API docs:

- OpenAI Usage/Costs connector
- env-only `OPENAI_ADMIN_KEY`
- read-only provider access
- fixture-backed validation path
- sensitive identifier redaction
- normalized local persistence only

Do not persist raw provider payloads.
Do not create `.env`.
Do not add real credentials.
Do not add telemetry.

## Validation Commands For M5/S5 Review

```bash
pnpm test
pnpm typecheck
git diff --check
```
