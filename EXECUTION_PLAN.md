# StackSpend Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M4`
- Current slice: `S4-aws-connector`
- Canonical source: `docs/product/execution-plan.md`, section `M4 — AWS connector`
- Approval: `M4/S4-aws-connector` is approved and currently selected for the coding loop.

## Slice History

- `M1/S1-monorepo-bootstrap` completed locally.
- `M2/S2-core-config-db-security` completed locally and remains intentionally uncommitted for review.
- `M3/S3-cli-mock-pipeline` completed locally and remains intentionally uncommitted for review.
- `M4/S4-aws-connector` is the current approved slice.

## M4/S4 Summary

Collect AWS Cost Explorer billing snapshots and service-level cost grouping:

- AWS Cost Explorer connector
- profile/env credentials only
- read-only provider access
- fixture-backed validation path
- normalized local persistence only

Do not persist raw provider payloads.
Do not create `.env`.
Do not add real credentials.
Do not add telemetry.

## Validation Commands For M4/S4 Review

```bash
pnpm test
pnpm typecheck
git diff --check
```
