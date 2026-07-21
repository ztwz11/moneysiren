# MoneySiren Execution Plan

Status: approved for v0.1 planning gate.

- SPEC_LOCKED: YES
- CODING_LOOP_ALLOWED: YES

The canonical detailed execution plan lives at `docs/product/execution-plan.md`.

## Current Approved Slice

- Current milestone: `M15`
- Current slice: `S15-npm-install-windows-hud`
- Canonical source: `docs/product/execution-plan.md`, section `M15 - npm-installed Windows HUD`
- Approval: `M15/S15-npm-install-windows-hud` was approved interactively on 2026-07-16 with the explicit goal that npm installation produces a working HUD.

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
- `M12/S12-local-ai-usage-history` completed and was committed in `24e3cab`.
- `M13/S13-unified-connect-first-sync` completed and was committed in `24e3cab`.
- `M14/S14-installed-hud-runtime-resolution` completed and was committed in `24e3cab`.
- `M15/S15-npm-install-windows-hud` completed locally on 2026-07-16.

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

## M16/S16 Unsigned Windows Preview

Status: Completed and published on 2026-07-21.

- Keep stable tag pushes fail-closed when Windows signing is unavailable.
- Permit unsigned Windows publication only for a manually dispatched prerelease
  with explicit `unsigned_windows_preview` consent.
- Publish SHA256 checksums and machine-readable unsigned-preview metadata.
- Gate npm `next` publication on candidate and public installed-HUD smokes.
- Preserve the existing explicit CLI opt-in and never claim a verified publisher.

Publication evidence:

- GitHub prerelease `v0.1.7-beta.1` is bound to commit `28e6256` and contains
  Windows setup/portable executables, SHA256 manifests, the source-free web
  runtime, and explicit unsigned-preview metadata.
- Desktop release run `29813458666` passed the Windows candidate HUD smoke,
  public-release HUD smoke, and npm publication gate.
- npm `next` points to `@moneysiren/cli@0.1.7-beta.1` and
  `@moneysiren/app@0.1.7-beta.1`.

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

## M15/S15 Summary

Status: Completed locally on 2026-07-16.

Make `npm install -g @moneysiren/app` install the matching verified web runtime
and Windows HUD artifact, then ensure the installed CLI can start the dashboard
and launch the portable or installed HUD without source checkout files.

- Postinstall requests the complete selected profile instead of silently
  stopping after the web runtime.
- Release assets are assembled and candidate-smoked before npm publication can
  make the matching package visible.
- Windows candidate smoke uses an isolated npm prefix and application-data root,
  starts the packaged web runtime, launches the packaged HUD, and verifies the
  managed runtime state without provider calls or credential material.
- Release errors remain retryable and never print secrets, raw provider
  payloads, local AI text, auth files, or private local paths.
- The pre-existing `apps/tray/src-tauri/Cargo.lock` change remains excluded.

Validation result: the isolated npm candidate installed successfully, started
the packaged web runtime, launched the portable Windows HUD, and reported both
managed processes as running. The full suite passed with 417 test cases,
typecheck, lint, YAML parsing, the 74-route production build, 527-file secret
scan, and `git diff --check`. The pre-existing Cargo.lock SHA256 remained
`80EEB876BF3E926821501292214C3BB868441BC1CACE52F74A26B937EDE8514F`.

## Validation Commands For M15/S15 Review

```powershell
node --test apps/app/scripts/postinstall.test.mjs
npm run test:release-workflow
node tools/scripts/smoke-installed-package.mjs --candidate-dir <candidate-dir> --tag <tag> --source-commit <sha>
npm run test
npm run typecheck
npm run lint
npm run build
npm run secret:scan
git diff --check
```
