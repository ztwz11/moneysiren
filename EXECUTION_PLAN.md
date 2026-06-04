# StackSpend Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M10`
- Current slice: `S10-alpha-release`
- Canonical source: `docs/product/execution-plan.md`, section `M10 — Docker/docs/alpha release`
- Approval: `M10/S10-alpha-release` is approved and currently selected for the coding loop.

## Slice History

- `M1/S1-monorepo-bootstrap` completed locally.
- `M2/S2-core-config-db-security` completed locally and remains intentionally uncommitted for review.
- `M3/S3-cli-mock-pipeline` completed locally and remains intentionally uncommitted for review.
- `M4/S4-aws-connector` completed locally.
- `M5/S5-openai-connector` completed locally.
- `M6/S6-supabase-connector` completed locally.
- `M7/S7-cloudflare-connector` completed locally.
- `M8/S8-slack-report` completed locally.
- `M9/S9-local-dashboard` completed locally.
- `M10/S10-alpha-release` is the current approved slice.

## M10/S10 Summary

Deliver Docker, documentation, and npm alpha packageability support for local `v0.1.0-alpha.0` review:

- Dockerfile for local self-host/dev review
- `compose.yaml` with no embedded secrets and fake fixture paths only
- `@stackspend/cli` package metadata/bin/files for npm alpha dry-run and tarball install review
- README quickstart for CLI, mock/provider fixtures, local dashboard, Slack report, and Docker
- security docs for env-only secrets, redaction, local SQLite storage, and Docker/Compose boundaries
- `docs/product/v0.1.0-alpha-checklist.md`
- no GitHub upload, deploy, push, publish, or hosted release

Do not persist raw provider payloads.
Do not create `.env`.
Do not add telemetry.
Do not expose credentials, webhook URLs, account IDs, project IDs, invoice IDs, emails, or billing profiles.

## Validation Commands For M10/S10 Review

```bash
pnpm test
pnpm typecheck
git diff --check
git diff --name-only --diff-filter=ACM -z | xargs -0 rg -n -e 'sk-[A-Za-z0-9_-]{8,}' -e 'hooks\.slack\.com/services/[A-Za-z0-9/_-]+' -e 'acct_[A-Za-z0-9_-]{6,}' -e 'project_[A-Za-z0-9_-]{6,}' -e 'invoice_[A-Za-z0-9_-]{6,}' -e '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
```

If Docker is available and local policy allows it:

```bash
docker build --pull=false --target verify -t stackspend:m10-verify .
```
