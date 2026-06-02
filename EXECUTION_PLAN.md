# StackSpend Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M7`
- Current slice: `S7-cloudflare-connector`
- Canonical source: `docs/product/execution-plan.md`, section `M7 — Cloudflare experimental connector`
- Approval: `M7/S7-cloudflare-connector` is approved and currently selected for the coding loop.

## Slice History

- `M1/S1-monorepo-bootstrap` completed locally.
- `M2/S2-core-config-db-security` completed locally and remains intentionally uncommitted for review.
- `M3/S3-cli-mock-pipeline` completed locally and remains intentionally uncommitted for review.
- `M4/S4-aws-connector` completed locally.
- `M5/S5-openai-connector` completed locally.
- `M6/S6-supabase-connector` completed locally.
- `M7/S7-cloudflare-connector` is the current approved slice.

## M7/S7 Summary

Collect Cloudflare billing and usage snapshots where available, with experimental fallback behavior for restricted APIs:

- Cloudflare billing/usage experimental connector
- env-only `CLOUDFLARE_API_TOKEN`
- read-only provider access
- fixture-backed validation path via `STACKSPEND_CLOUDFLARE_FIXTURE`
- account, zone, and subscription identifier redaction
- restricted/unavailable API fallback as warning alerts and degraded health/status snapshots
- normalized local persistence only

Do not persist raw provider payloads.
Do not create `.env`.
Do not add real credentials.
Do not add telemetry.

## Validation Commands For M7/S7 Review

```bash
pnpm --filter @stackspend/connector-cloudflare test
pnpm --filter @stackspend/cli test
pnpm test
pnpm typecheck
git diff --check
```
