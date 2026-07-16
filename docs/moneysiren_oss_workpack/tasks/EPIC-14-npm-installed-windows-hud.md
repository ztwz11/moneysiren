# EPIC-14: npm-installed Windows HUD

Status: Completed

## Goal

Make a global `@moneysiren/app` installation install and launch the matching
Windows dashboard and HUD without a source checkout or a manual HUD download.

## Owned files

- `apps/app/scripts/postinstall.mjs`
- `apps/app/scripts/postinstall.test.mjs`
- `tools/scripts/smoke-installed-package.mjs`
- `tools/scripts/lib/release-workflow.test.mjs`
- `.github/workflows/desktop-release.yml`
- `.github/workflows/npm-publish-cli.yml`
- release and install documentation

## Security boundary

- Preserve existing release checksum and Windows signature verification.
- Never accept executable paths from network response bodies outside the
  normalized release manifest contract.
- Use mock provider data only in candidate smoke.
- Do not expose secrets, provider responses, local AI content, auth files, or
  private local paths in logs or fixtures.
- Keep unsigned HUD acceptance limited to explicit local/candidate smoke.

## Acceptance criteria

- [x] Global postinstall requests web and HUD by default.
- [x] A postinstall failure leaves working CLI shims and fixed retry guidance.
- [x] npm publication cannot race the matching GitHub release assets.
- [x] Windows candidate smoke installs the app tarball into an isolated prefix.
- [x] Candidate smoke starts the packaged web runtime and launches the portable HUD.
- [x] The installed dashboard HUD button resolves that portable artifact.
- [x] Full validation and secret scan pass.
- [x] The existing Cargo.lock change remains untouched.

## Execution log

- 2026-07-16: committed completed M12-M14 work as `24e3cab`, excluding the
  pre-existing `apps/tray/src-tauri/Cargo.lock` change.
- 2026-07-16: confirmed current postinstall downloads only web by default and
  current tag-triggered npm/desktop workflows can race each other.
- 2026-07-16: changed global postinstall to request the complete release, with a
  bounded web/profile fallback that preserves command shims and fixed guidance.
- 2026-07-16: serialized candidate HUD smoke, GitHub publication, public HUD
  smoke, and reusable npm publication; public release now requires signed
  Windows artifacts.
- 2026-07-16: isolated candidate smoke passed with packaged web and portable HUD
  processes both running. Full 417-case tests, typecheck, lint, 74-route build,
  YAML parse, 527-file secret scan, and diff check passed. Cargo.lock remained
  excluded with its original SHA256.
