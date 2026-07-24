# MoneySiren v0.1.7

MoneySiren v0.1.7 is a maintainer-approved unsigned stable Windows release. It
improves the installed HUD while preserving local-first data boundaries.

## Highlights

- Codex reset-credit expiry is derived from the official local quota metadata
  when available and no longer disappears during HUD normalization.
- Single-line HUD layouts show complete values without ellipses. Expiry rows
  use compact date-only labels, and icon mode uses adaptive provider icons.
- Codex, Claude, OpenAI, AWS, Supabase, Cloudflare, and other supported HUD
  entries retain their configured order and presentation.
- Candidate and public installed-package smokes verify the packaged web runtime
  and Windows HUD before npm publication.

## Install

```powershell
npm install -g @moneysiren/app@latest
msiren install --all --allow-unsigned-hud --tag v0.1.7
msiren hud
```

## Windows warning

This release is not Authenticode-signed and does not have a verified publisher.
Windows may display Unknown Publisher or SmartScreen warnings, and managed
Windows policy may block execution. Do not disable Defender, SmartScreen, or
Smart App Control globally.

The release includes SHA256 checksums and
`moneysiren-tray-windows-UNSIGNED-RELEASE.json`. HUD installation requires the
explicit `--allow-unsigned-hud` opt-in.

## Data handling

No provider payloads, local AI prompt text, shell command bodies, auth files, or
raw Codex/Claude logs are newly persisted or returned. Existing local SQLite
usage history remains limited to sanitized numeric buckets.

## macOS scope

This release does not publish a macOS application.
