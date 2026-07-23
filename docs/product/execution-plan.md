# MoneySiren v0.1 Implementation Plan

> **For Hermes/Codex:** Use controlled, slice-by-slice implementation. Keep product artifacts inside this repository. Do not modify `auto-driver` for product files.

**Goal:** Build a local-first, CLI-first cloud/SaaS usage, status, and expected billing dashboard for individual developers and small teams.

**Architecture:** TypeScript pnpm monorepo with a CLI app, a local Next.js dashboard, shared core/config/db/security/report packages, and read-only provider connectors. SQLite is the default local persistence layer; raw provider payloads are redacted and normalized before storage.

**Tech Stack:** TypeScript, pnpm, Vitest, SQLite, Next.js, Node.js, Slack webhook.

---

## Global Repository Boundary

- Product repo: `moneysiren`.
- Automation repo: `auto-driver`.
- Product files must not be created in `auto-driver`.
- `auto-driver` should ideally remain clean during MoneySiren implementation.

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
- default DB path `.moneysiren/moneysiren.sqlite`.
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

- `moneysiren init`
- `moneysiren doctor`
- `moneysiren sync --provider mock`
- `moneysiren report daily --lang ko`

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

- env-only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_IDS`.
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
- `moneysiren` can be packed into a public alpha npm tarball without tests or external source files.
- installed tarball can run `moneysiren --version` and `moneysiren doctor` without live credentials.
- security docs describe secrets, redaction, and local storage.
- alpha checklist passes.

## M11 - Live dashboard, i18n, service navigation, and provider catalog

Goal: upgrade the local web dashboard into a route-based operational UI with live-today overlays, locale-aware strings, service detail pages, a provider catalog, and local read-only connection flows.

Spec files:

- `docs/product/web-ui-live-i18n-spec.md`
- `docs/product/web-sidebar-service-detail-spec.md`
- `docs/product/provider-catalog-spec.md`

Implementation slices:

1. i18n route shell, typed dictionaries, sidebar, and mobile drawer.
2. dashboard overview, today live, forecast, and risks routes.
3. canonical/live/freshness/forecast dashboard data contracts.
4. provider catalog and connections UI.
5. service summary and provider detail pages.
6. local auth broker and credential store abstraction.
7. verification, security review, and docs sync.

Completion criteria:

- web routes support `ko`, `en`, and `ja` path locales.
- dashboard separates canonical data through yesterday from provisional today-live data.
- provider live granularity and freshness are explicit.
- sidebar exposes Dashboard, Services, and Settings groups.
- service detail pages are read-only and never expose secrets or raw provider identifiers.
- provider catalog shows available, planned, and research providers.
- connection flows store credentials only through the approved local credential abstraction.
- emergency actions are visible only as planned requirements and cannot execute provider writes.

Review gate:

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
```

## M12 - Local AI usage history

Status: Completed locally on 2026-07-13.

Goal: persist sanitized Codex CLI and Claude CLI usage locally and provide
daily, Monday-based weekly, and calendar-month history on provider detail pages.

Spec files:

- `docs/product/local-ai-usage-history-spec.md`
- `docs/moneysiren_oss_workpack/tasks/EPIC-11-local-ai-usage-history.md`

Implementation slices:

1. Add an idempotent SQLite daily usage table and bounded history reads.
2. Produce timestamp-based numeric daily buckets from existing local log parsing.
3. Persist on explicit local-AI refresh while keeping GET reads mutation-free.
4. Add local-only day/week/month API and provider detail table.
5. Run migration, parser, redaction, API, UI, quota/HUD regression, typecheck,
   build, diff, and secret-scan gates.

Security boundary:

- Persist numeric counters, safe timestamps, provider/date/timezone keys,
  source scope, parser version, and local-only metadata only.
- Never persist or expose prompts, responses, shell command bodies, tool input,
  raw JSONL, source paths, auth files, credentials, or native session/turn IDs.
- Keep all history API access local-only and return no-store responses.

Completion criteria:

- local history survives process restarts;
- repeated scans do not duplicate usage;
- day, Monday-based week, and calendar-month aggregation is correct;
- unknown counters remain unavailable rather than zero;
- raw local content and authentication data never enter SQLite or API JSON;
- current quota cards and HUD behavior do not regress;
- tests, typecheck, lint, build, diff check, and secret scan pass.

Review gate:

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
IMPLEMENTATION_STATUS: COMPLETE
```

## M13 - Unified connection and first sync

Status: Completed locally on 2026-07-13.

Goal: remove the gap between entering an OpenAI Admin API key and obtaining the
first canonical SQLite history. One explicit local action validates read-only
access, saves the credential through the v0.1 env-only boundary, persists the
normalized collection, and returns a safe progress result.

Spec files:

- `docs/product/unified-connect-first-sync-spec.md`
- `docs/moneysiren_oss_workpack/tasks/EPIC-12-unified-connect-first-sync.md`

Implementation slices:

1. Add a server-only OpenAI first-sync application service with injectable
   collection, environment persistence, canonical persistence, and bounded
   request timeout boundaries.
2. Add a local-session and CSRF-protected POST route with fixed safe errors.
3. Connect the OpenAI credential form to the orchestration result and show
   validating, saving, syncing, success, partial, and retry states.
4. Keep CLI sync, live-today refresh, local AI history, quota cards, and HUD
   refresh unchanged.
5. Run focused route/service/UI tests and full repository validation.

Security boundary:

- The request accepts only an OpenAI Admin API key for this explicit local action.
- The response never includes the key, authorization header, provider response,
  provider error body, account/project identifiers, source paths, or raw payloads.
- Failed read-only collection does not save the key or write canonical history.
- Only normalized snapshots cross the SQLite persistence boundary.

Completion criteria:

- one OpenAI form submission performs validation, env save, and first sync;
- the secret field is cleared after the save boundary succeeds;
- partial persistence failure is distinguishable from invalid credentials;
- all responses are local-only, no-store, and explicitly secret-free;
- fixture-backed tests prove ordering and non-persistence on validation failure;
- current CLI, live overlay, local AI history, quota, and HUD behavior regressions
  remain green.

Review gate:

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
IMPLEMENTATION_STATUS: COMPLETE
```

## M14 - Installed HUD runtime resolution

Status: Completed locally on 2026-07-13.

Goal: make the packaged web dashboard open the installed MoneySiren HUD without
requiring repository-only scripts or `target/release` paths.

Spec files:

- `docs/moneysiren_oss_workpack/tasks/EPIC-13-installed-hud-runtime-resolution.md`

Implementation slices:

1. Share deterministic configured and operating-system desktop app candidates
   between the CLI and web runtime.
2. Resolve production HUD launches before attempting repository discovery.
3. Keep dev launcher and repository-built executable fallbacks for source runs.
4. Add standalone, precedence, fail-closed, local-only, and path-sanitization
   regression tests.
5. Repackage the web runtime and verify the installed Windows HUD visibly opens.

Security boundary:

- Never accept an executable path from the HTTP request body.
- Use only the process-owned `MONEYSIREN_DESKTOP_APP` value, fixed OS install
  candidates, or fixed repository artifact paths.
- Require an expected MoneySiren executable name and an existing regular file.
- Never search `PATH`, invoke a shell, or return local paths in API errors.
- Preserve the local-only HUD route and no-store, secret-free response contract.

Completion criteria:

- standalone production runtime opens the standard Windows installation;
- an explicit valid app path wins over standard candidates;
- an explicit invalid app path fails without launching a fallback process;
- dev and repository-built launch paths remain supported;
- unsafe routes and non-local requests remain rejected;
- focused tests, typecheck, build, secret scan, and diff check pass;
- a visible installed HUD window is verified on Windows.

Completion evidence:

- the packaged AppData web runtime returned a successful desktop HUD launch
  request through the browser session and CSRF flow;
- Windows exposed a new top-level window titled `MoneySiren HUD`;
- 75 test files / 412 tests, typecheck, lint, full production build, 522-file
  secret scan, and `git diff --check` passed;
- the pre-existing `apps/tray/src-tauri/Cargo.lock` SHA256 remained unchanged.

Review gate:

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
IMPLEMENTATION_STATUS: COMPLETE
```

## M15 - npm-installed Windows HUD

Status: Completed locally on 2026-07-16.

Goal: make the source-free npm app installation produce a complete Windows
dashboard and HUD installation instead of a CLI plus web-only partial install.

Spec files:

- `docs/moneysiren_oss_workpack/tasks/EPIC-14-npm-installed-windows-hud.md`

Implementation slices:

1. Make app postinstall request the complete web/HUD profile by default while
   preserving an explicit retry path when release assets are unavailable.
2. Add regression tests that lock the postinstall arguments and ensure failures
   remain bounded and secret-free.
3. Add an installed-package candidate smoke that stages matching web and Windows
   portable HUD artifacts, starts the packaged dashboard, launches HUD, and
   validates managed runtime state in an isolated user data root.
4. Serialize release assembly, candidate smoke, GitHub asset publication,
   public smoke, and npm publication so npm cannot race missing assets.
5. Run the Windows local candidate path plus full repository validation.

Security boundary:

- Download only version-matched release assets selected by the existing
  release installer and preserve checksum/signature verification.
- Candidate smoke uses mock provider data only and isolated local paths.
- Do not print manifest paths, credentials, provider payloads, prompt text,
  command bodies, or auth-file contents.
- Do not weaken public signature policy to make unsigned local smoke pass.

Completion criteria:

- default global app postinstall requests both web and HUD surfaces;
- the release workflow cannot publish npm before matching public assets pass;
- an isolated Windows candidate install starts the packaged web runtime and HUD;
- dashboard HUD requests resolve the installed portable artifact;
- focused tests, full tests, typecheck, lint, build, secret scan, and diff check
  pass;
- Cargo.lock remains outside the slice.

Completion evidence:

- an isolated `@moneysiren/app` tarball installation created command shims,
  loaded a matching packaged web runtime and portable Windows HUD, and reported
  both managed processes as running;
- postinstall and release-workflow contract tests passed, including the
  web-only recovery path and public Windows signature gate;
- 417 test cases, typecheck, lint, YAML parsing, the 74-route production build,
  the 527-file secret scan, and `git diff --check` passed;
- the pre-existing `apps/tray/src-tauri/Cargo.lock` SHA256 remained unchanged.

Review gate:

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
IMPLEMENTATION_STATUS: COMPLETE
```

## M16 - macOS preview and cross-surface icon completion

Status: Completed locally on 2026-07-23; deployment intentionally pending.

Goal: make the selected MoneySiren identity complete across web, Windows, and
macOS, then make a no-certificate macOS preview possible without opening the
stable release path.

Implementation slices:

1. Connect real provider assets to service navigation and use the selected
   MoneySiren app icon for the web brand and browser metadata.
2. Generate macOS `.icns` sizes through 1024 px plus a monochrome menu-bar
   template icon, while preserving the existing Windows assets.
3. Add `unsigned_macos_preview` as a manual-prerelease-only release gate with
   checksum and source-commit-bound metadata.
4. Add macOS candidate/public installed-package smokes and require them before
   release/npm publication for macOS or all-platform workflows.
5. Verify signed macOS archives locally at install time with `codesign` and
   `spctl`; require explicit `--allow-unsigned-hud` for unsigned archives.

Security boundary:

- Stable tag pushes still require Apple signing and notarization.
- Unsigned previews never claim a verified publisher and cannot install without
  explicit user opt-in.
- Archive extraction rejects empty, absolute, and parent-traversal layouts.
- No provider credentials, auth files, raw local AI content, or payloads enter
  icon assets, workflow metadata, fixtures, or test output.

Completion evidence:

- web production build completed with 76 routes;
- web 236/236, CLI 63/63, release workflow 8/8, and postinstall 5/5 tests passed;
- web and CLI typechecks, YAML parsing, native icon checks, 538-file secret
  scan, and `git diff --check` passed;
- `apps/tray/src-tauri/Cargo.lock` remained unchanged;
- macOS `.app` build, signature/notarization validation, and Gatekeeper launch
  remain bounded to the macOS GitHub runner at release time.

Review gate:

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
IMPLEMENTATION_STATUS: COMPLETE_LOCAL_RELEASE_PENDING
```
