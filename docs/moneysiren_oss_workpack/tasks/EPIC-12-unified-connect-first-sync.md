# EPIC-12: Unified OpenAI Connect and First Sync

Status: Done locally on 2026-07-13

## Goal

Turn the OpenAI credential form into one explicit local flow that validates
read-only access, saves the env-only credential, and persists the first
canonical SQLite collection.

## Owned files

- `apps/web/lib/openai-first-sync.ts`
- `apps/web/lib/openai-first-sync-ui.ts`
- `apps/web/app/api/local/openai-first-sync/route.ts`
- `apps/web/components/CredentialControls.tsx`
- `apps/web/lib/i18n.ts`
- `packages/connectors/openai/src/index.ts`
- focused tests and product documentation

## Security boundary

- Accept the key only on the local CSRF-protected POST.
- Use read-only OpenAI Usage/Costs collection.
- Return fixed status/error codes and numeric counts only.
- Never return or persist raw payloads, provider errors, credentials, auth
  headers, identifiers, emails, paths, prompts, or command bodies.
- Do not change live-today, quota, local AI history, or HUD refresh behavior.

## Acceptance criteria

- [x] One OpenAI form submission completes validation, env save, and first sync.
- [x] Failed validation saves no credential and writes no canonical data.
- [x] Failed env persistence writes no canonical data.
- [x] Failed canonical persistence returns an honest partial result.
- [x] Read-only validation has a bounded timeout and abort signal.
- [x] Success and failure states are visible without a hard page reload.
- [x] Focused API, orchestration, and UI/client tests pass.
- [x] CLI, quota, local AI history, and HUD regression tests remain green.
- [x] Test, typecheck, lint, build, diff check, and secret scan pass.

## Execution log

- 2026-07-13: scope approved interactively; implementation started with OpenAI
  only to keep the security-sensitive slice reviewable.
- 2026-07-13: implemented local CSRF route, normalized collection reuse,
  env-save/canonical failure boundaries, 30-second abort, localized outcome
  states, and key-free partial retry.
- 2026-07-13: focused M13 tests passed (23 web state/service/API/client tests;
  7 OpenAI connector tests). Full regression passed with Web 222, CLI 62, and
  DB 16 tests. Repository typecheck, lint, production build, `git diff --check`,
  and secret scan passed; the secret scan checked 519 files.

## Deferred follow-up

- background scheduler with retry/backoff and next-run state;
- AWS, Supabase, Cloudflare, and local AI unified sync;
- actual native notification delivery and history;
- backup, restore, export, and broader date/filter UX.

## Validation commands

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
