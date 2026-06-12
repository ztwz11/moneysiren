# StackSpend Tray Tauri Scaffold

This directory is the Tauri tray shell for the local StackSpend desktop surface.

The TypeScript package defines the local API client, action model, and notification suppression model. The native entrypoint currently provides:

- tray icon and static menu binding;
- click handling into local dashboard URLs;
- a `Show HUD` action that opens the local `/hud?locale=ko` WebView surface;
- a local-safe native status command that declares `secretsReturned=false`.

Native integration still needs:

- dynamic menu refresh from `GET /api/local/tray-menu`;
- toast permission checks and delivery;
- start-at-login preference wiring;
- unsigned development bundles;
- signed release packaging documentation.
