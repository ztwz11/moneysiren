# MoneySiren Desktop Alpha

This prerelease publishes source-free alpha artifacts for local review:

- `moneysiren-web-runtime-*.tar.gz`: built Next.js dashboard runtime.
- Windows desktop installer: Tauri NSIS `.exe`.
- macOS desktop app archive: Tauri `.app` in `.tar.gz`.
- SHA256 checksum files for the release assets.

## Install Order

1. Install the CLI from npm:

   ```bash
   npm install -g @moneysiren/cli@alpha
   ```

2. Download and extract `moneysiren-web-runtime-*.tar.gz`, then start the local dashboard runtime:

   ```bash
   node start.mjs
   ```

3. Install or open the desktop app for your OS.

The desktop shell opens the local dashboard and HUD at `http://127.0.0.1:3000`. In this alpha, the native desktop app does not yet embed or auto-start the web runtime.

## Security Notes

- Desktop artifacts are code signed when the release workflow has the required signing secrets.
- If signing secrets are not configured, prerelease desktop artifacts are unsigned alpha builds. Treat them as local review builds until signed assets are published.
- Do not create `.env` files with live credentials.
- Use process-local environment variables for live provider sync.
- Provider connectors remain read-only.
- Telemetry is off by default.
