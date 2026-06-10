# StackSpend Tray Skeleton

This package is the EPIC-08 desktop tray thin-client skeleton. It is intentionally local-first and calls only sanitized StackSpend local API endpoints.

Allowed local API reads:

- `GET /api/local/health`
- `GET /api/local/tray-menu`
- `GET /api/local/notification-digest`

The tray package must not collect, display, or persist provider credentials, prompt text, account IDs, project IDs, emails, webhook URLs, raw provider payloads, or raw SQLite rows. It does not import provider connectors, credential storage, or database modules.

## Contents

- `src/actions.ts`: the EPIC-08 tray action model.
- `src/local-api.ts`: loopback-only API client functions for the allowed endpoints.
- `src/notifications.ts`: pure TypeScript notification polling and suppression decisions.
- `src-tauri/`: Tauri v2 native tray scaffold with menu actions, icons, and unsigned bundle config.

## Current Runtime Boundary

The Rust entrypoint creates the native tray menu and exposes a local-safe native status command. The TypeScript model still owns local API polling, quiet-hour suppression, pause handling, and fingerprint suppression tests. OS toast delivery and start-at-login persistence are the next native integration layer.

No provider connector, credential store, or database dependency is imported by the tray package.

## Native Development

Rust is required for native Tauri commands.

```bash
node tools/scripts/run-pnpm.mjs --filter @stackspend/tray native:check
node tools/scripts/run-pnpm.mjs --filter @stackspend/tray tauri:dev
node tools/scripts/run-pnpm.mjs --filter @stackspend/tray tauri:build:unsigned
```

`tauri:build:unsigned` creates platform-native unsigned development artifacts through Tauri. On Windows this produces the configured Windows bundle target for the local toolchain; on macOS this produces the app bundle/dmg targets when run on macOS. Signing remains a release-management step outside the local-first v0.1 runtime.

## Validation

```bash
pnpm --filter @stackspend/tray test
pnpm --filter @stackspend/tray typecheck
pnpm --filter @stackspend/tray native:check
```
