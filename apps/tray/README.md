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

The Rust entrypoint creates the native tray menu, opens a Tauri dashboard window pointed at the local Next.js dashboard, and exposes a local-safe native status command. The TypeScript model still owns local API polling, quiet-hour suppression, pause handling, and fingerprint suppression tests. OS toast delivery and start-at-login persistence are the next native integration layer.

No provider connector, credential store, or database dependency is imported by the tray package.

## Native Development

Rust is required for native Tauri commands.

```bash
node tools/scripts/run-pnpm.mjs --filter @stackspend/tray native:check
node tools/scripts/run-pnpm.mjs --filter @stackspend/tray tauri:dev
node tools/scripts/run-pnpm.mjs --filter @stackspend/tray tauri:build:unsigned
```

From the repository root, `npm run dev` starts the Next.js dashboard, waits for it to be ready, then starts this native taskbar/tray layer and Tauri dashboard window. Use `npm run dev:web` for a web-only session or `npm run dev:tray` for the tray layer only when the web dashboard is already running.

For a production-style local run from the repository root, use `npm run build:local` and then `npm start`. This starts the built Next.js dashboard and launches the built unsigned Tauri executable from `src-tauri/target/release`. Use `npm run start:web` for only the built web dashboard or `npm run start:tray` for only the built tray/Tauri executable when the web dashboard is already running.

`tauri:build:unsigned` creates platform-native unsigned development artifacts through Tauri. On Windows this produces the configured Windows bundle target for the local toolchain; on macOS this produces the app bundle/dmg targets when run on macOS. Signing remains a release-management step outside the local-first v0.1 runtime.

## Validation

```bash
pnpm --filter @stackspend/tray test
pnpm --filter @stackspend/tray typecheck
pnpm --filter @stackspend/tray native:check
```
