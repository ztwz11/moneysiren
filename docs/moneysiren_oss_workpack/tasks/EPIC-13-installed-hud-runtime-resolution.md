# EPIC-13: Installed HUD Runtime Resolution

Status: Done locally on 2026-07-13

## Goal

Allow the packaged local dashboard to launch the installed MoneySiren HUD
without depending on source-checkout scripts or build output paths.

## Owned files

- `packages/runtime/src/desktop-app.ts`
- `packages/runtime/src/index.ts`
- `apps/cli/src/desktop-runtime.ts`
- `apps/web/app/api/local/desktop-runtime/route.ts`
- focused runtime and web route tests
- execution plan and decision log

## Security boundary

- Do not accept executable paths from HTTP request data.
- Do not search `PATH` or invoke a shell.
- Accept only expected MoneySiren executable names from process-owned
  configuration, fixed OS install paths, or fixed repository paths.
- Keep requests loopback-only and responses no-store and secret-free.
- Do not expose local paths in API responses or logs.

## Acceptance criteria

- [x] Packaged production resolves a standard Windows MoneySiren installation.
- [x] `MONEYSIREN_DESKTOP_APP` has explicit precedence.
- [x] An invalid configured path fails closed without fallback execution.
- [x] Development launcher and repository-built fallback remain supported.
- [x] Unsafe paths and non-local requests remain rejected.
- [x] Focused tests, typecheck, build, secret scan, and diff check pass.
- [x] The installed HUD opens visibly on Windows.

## Execution log

- 2026-07-13: reproduced `POST /api/local/desktop-runtime` returning HTTP 500
  from the standalone AppData runtime while the installed tray executable
  existed under `%LOCALAPPDATA%`.
- 2026-07-13: scope approved interactively; implementation started as a narrow
  installed-runtime resolver slice.
- 2026-07-13: added deterministic configured, installed, repository-built, and
  development launch resolution with fail-closed path validation.
- 2026-07-13: added same-origin loopback, local session, CSRF, bounded JSON,
  normalized HUD route, environment allowlist, and asynchronous spawn guards.
- 2026-07-13: repackaged the AppData web runtime and verified that the dashboard
  request created a visible Windows window titled `MoneySiren HUD`.
- 2026-07-13: full validation passed with 75 test files / 412 tests, typecheck,
  lint, production build, 522-file secret scan, and `git diff --check`.

## Validation commands

```powershell
node tools/scripts/run-pnpm.mjs --filter @moneysiren/runtime test
node tools/scripts/run-pnpm.mjs --filter @moneysiren/web exec vitest run app/api/local/desktop-runtime/route.test.ts
node tools/scripts/run-pnpm.mjs --filter @moneysiren/web typecheck
npm run build
npm run secret:scan
git diff --check
```
