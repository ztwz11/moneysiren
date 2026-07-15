# MoneySiren Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M14`
- Current slice: `S14-installed-hud-runtime-resolution`
- Canonical source: `docs/product/execution-plan.md`, section `M14 - Installed HUD runtime resolution`
- Approval: `M14/S14-installed-hud-runtime-resolution` was approved interactively on 2026-07-13 after the installed HUD failure was reproduced.

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
- `M10/S10-alpha-release` completed locally.
- `M11/S11-live-dashboard` completed locally.
- `M12/S12-local-ai-usage-history` completed locally and remains intentionally uncommitted for review.
- `M13/S13-unified-connect-first-sync` completed locally and remains intentionally uncommitted for review.
- `M14/S14-installed-hud-runtime-resolution` completed locally and remains intentionally uncommitted for review.

## M10/S10 Summary

Deliver Docker, documentation, and npm alpha packageability support for local `v0.1.0-alpha.0` review:

- Dockerfile for local self-host/dev review
- `compose.yaml` with no embedded secrets and fake fixture paths only
- `moneysiren` package metadata/bin/files for npm alpha dry-run and tarball install review
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
docker build --pull=false --target verify -t moneysiren:m10-verify .
```

## M12/S12 Summary

Status: Completed locally on 2026-07-13.

Persist sanitized Codex CLI and Claude CLI usage as local daily numeric buckets,
then expose daily, Monday-based weekly, and calendar-month history on provider
detail pages.

- SQLite is the only persistence layer.
- Repeated scans upsert the same provider/date bucket instead of duplicating it.
- Prompt text, response text, tool input, command bodies, source paths, raw JSONL,
  auth data, and native session/turn identifiers never cross the persistence boundary.
- Existing live quota cards and HUD behavior must remain unchanged.
- Unknown token values stay unavailable instead of being coerced to zero.

## Validation Commands For M12/S12 Review

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npm run secret:scan
git diff --check
```

## M13/S13 Summary

Status: Completed locally on 2026-07-13.

Make the OpenAI connection form complete one safe local flow: validate the
submitted Admin API key with read-only Usage/Costs requests, save it through the
existing env-only boundary, persist the already-normalized canonical snapshots,
and report a secret-free result to the UI.

- OpenAI only; other providers and background scheduling are follow-up slices.
- Validation failure must not save the credential or change canonical history.
- Environment persistence failure must not change canonical history.
- Canonical persistence failure may report a partial result without returning
  provider errors, credentials, identifiers, paths, or raw payloads.
- Existing live-today, quota card, local AI history, and HUD refresh contracts
  remain unchanged.
- Read-only OpenAI requests are bounded to 30 seconds and receive an abort signal.
- A canonical persistence failure keeps an explicit key-free retry action, while
  an unknown transport result uses localized copy and refreshes connection state.

## Validation Commands For M13/S13 Review

```powershell
node tools/scripts/run-pnpm.mjs --filter @moneysiren/web test
node tools/scripts/run-pnpm.mjs --filter @moneysiren/cli test
node tools/scripts/run-pnpm.mjs --filter @moneysiren/db test
npm run typecheck
npm run lint
npm run build
npm run secret:scan
git diff --check
```

## M14/S14 Summary

Status: Completed locally on 2026-07-13.

Make the packaged web dashboard open the installed desktop HUD without assuming
that the web process is running inside a source checkout.

- Resolve an explicitly configured MoneySiren desktop app first.
- Resolve fixed operating-system installation candidates second.
- Keep the repository-built executable and dev launcher as source-checkout
  fallbacks only.
- Reject missing or unexpected explicitly configured executables without
  falling through to another process.
- Require a same-origin loopback session and CSRF token, bound JSON input and a
  normalized `/hud` route before spawning.
- Pass only an allowlisted desktop environment so provider credentials and
  database overrides are not inherited by the HUD child process.
- Replace the route-managed HUD child on repeated launches and handle
  asynchronous spawn failures without returning a false success.
- Keep the local-only HUD route and fixed secret-free error response unchanged.
- Repackage the standalone web runtime and verify that the installed application
  creates a visible `MoneySiren HUD` Windows window.

Validation result: 75 test files / 412 tests passed; typecheck, lint, full build,
522-file secret scan, and `git diff --check` passed. The pre-existing
`apps/tray/src-tauri/Cargo.lock` SHA256 remained unchanged.

## Validation Commands For M14/S14 Review

```powershell
node tools/scripts/run-pnpm.mjs --filter @moneysiren/runtime test
node tools/scripts/run-pnpm.mjs --filter @moneysiren/web exec vitest run app/api/local/desktop-runtime/route.test.ts
node tools/scripts/run-pnpm.mjs --filter @moneysiren/web typecheck
npm run build
npm run secret:scan
git diff --check
```
