# MoneySiren v0.1.0

MoneySiren v0.1.0 is the initial public local release.

This release provides source-free local installation through `@moneysiren/app`, a CLI-first setup flow, local SQLite snapshots, a local Next.js dashboard, and a Tauri tray/HUD desktop surface.

MoneySiren remains early and local-first. Provider connectors are read-only, telemetry is off by default, and raw provider payloads or credential material must not be persisted.

## Install

```bash
npm install -g @moneysiren/app
msiren install --status
msiren sync --provider mock
msiren start
msiren hud
```

For CLI-only automation:

```bash
npm install -g @moneysiren/cli
moneysiren doctor
```

## Assets

- `moneysiren-web-runtime-*.tar.gz`: built local Next.js dashboard runtime.
- Windows installer or portable executable when Windows release signing is configured.
- macOS app archive when Apple signing and notarization are configured.
- SHA256 checksum files for published runtime and desktop assets.

## Safety Notes

- Do not create `.env` files with live credentials.
- Use process-local environment variables for provider credentials.
- Use fixture or mock sync for public screenshots, demos, and reviews.
- Keep optional local-only experimental integrations separate from the core release story.
