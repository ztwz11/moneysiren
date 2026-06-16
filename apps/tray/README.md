# MoneySiren Tray Skeleton

This package is the EPIC-08 desktop tray thin-client skeleton. It is intentionally local-first and calls only sanitized MoneySiren local API endpoints.

Allowed local API reads:

- `GET /api/local/health`
- `GET /api/local/tray-menu`
- `GET /api/local/notification-digest`

The tray package must not collect, display, or persist provider credentials, prompt text, account IDs, project IDs, emails, webhook URLs, raw provider payloads, or raw SQLite rows. It does not import provider connectors, credential storage, or database modules.

## Contents

- `src/actions.ts`: the EPIC-08 tray action model.
- `src/local-api.ts`: loopback-only API client functions for the allowed endpoints.
- `src/notifications.ts`: pure TypeScript notification polling and suppression decisions.
- `src-tauri/`: Tauri v2 native tray scaffold with menu actions, icons, and release signing config generated in CI.

## Current Runtime Boundary

The Rust entrypoint creates the native tray menu, opens a Tauri dashboard window pointed at the local Next.js dashboard, and exposes a local-safe native status command. The TypeScript model still owns local API polling, quiet-hour suppression, pause handling, and fingerprint suppression tests. OS toast delivery and start-at-login persistence are the next native integration layer.

No provider connector, credential store, or database dependency is imported by the tray package.

## Native Development

Rust is required for native Tauri commands.

```bash
node tools/scripts/run-pnpm.mjs --filter @moneysiren/tray native:check
node tools/scripts/run-pnpm.mjs --filter @moneysiren/tray tauri:dev
node tools/scripts/run-pnpm.mjs --filter @moneysiren/tray tauri:build:unsigned
```

From the repository root, `npm run dev` starts the Next.js dashboard, waits for it to be ready, then starts this native taskbar/tray layer and Tauri dashboard window. Use `npm run dev:web` for a web-only session or `npm run dev:tray` for the tray layer only when the web dashboard is already running.

Use `npm run dev:hud` for HUD-only desktop mode. This still starts the local web dashboard as the data/rendering source, but the visible desktop surface is the native Tauri HUD window: transparent, undecorated, always on top, and hidden from the taskbar. The normal dashboard window is hidden in this mode.

For a production-style local run from the repository root, use `npm run build:local` and then `npm start`. This starts the built Next.js dashboard and launches the built unsigned Tauri executable for the current OS: `src-tauri/target/release/moneysiren-tray.exe` on Windows, or the macOS `.app` executable under `src-tauri/target/release/bundle/macos/MoneySiren Tray.app/Contents/MacOS/` with a release-binary fallback on macOS. Use `npm run start:web` for only the built web dashboard or `npm run start:tray` for only the built tray/Tauri executable when the web dashboard is already running.

`tauri:build:unsigned` creates platform-native unsigned development artifacts through Tauri from the same source tree. On Windows this produces the configured Windows bundle target for the local toolchain; on macOS this produces the app bundle target when run on macOS. Release signing is handled by GitHub Actions from repository secrets and does not require committing certificate material.

## Release Artifacts

The repository-level `desktop-release` GitHub Actions workflow builds signed source-free alpha artifacts when the required repository secrets are configured:

- Windows NSIS installer.
- macOS notarized `.app` archive.
- Built web runtime archive.

Required signing secrets:

- `WINDOWS_CERTIFICATE`: base64-encoded Windows code-signing `.pfx`.
- `WINDOWS_CERTIFICATE_PASSWORD`: password for the Windows `.pfx`.
- `APPLE_CERTIFICATE`: base64-encoded Apple signing `.p12`.
- `APPLE_CERTIFICATE_PASSWORD`: password for the Apple `.p12`.
- `KEYCHAIN_PASSWORD`: temporary CI keychain password.
- `APPLE_ID`: Apple ID email for notarization.
- `APPLE_PASSWORD`: Apple app-specific password for notarization.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

Optional repository variables:

- `WINDOWS_TIMESTAMP_URL`: defaults to `http://timestamp.digicert.com`.
- `WINDOWS_DIGEST_ALGORITHM`: defaults to `sha256`.
- `WINDOWS_TSP`: set to `true` for RFC 3161 timestamp servers.
- `APPLE_PROVIDER_SHORT_NAME`: required only when Apple notarization needs an explicit provider.

The desktop app remains a thin native shell in this alpha. It expects the local web runtime to be running on `http://127.0.0.1:3000`; it does not yet embed or auto-start the Next.js dashboard runtime.

## Validation

```bash
pnpm --filter @moneysiren/tray test
pnpm --filter @moneysiren/tray typecheck
pnpm --filter @moneysiren/tray native:check
```
