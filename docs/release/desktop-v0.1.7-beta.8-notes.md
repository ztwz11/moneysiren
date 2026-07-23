# MoneySiren v0.1.7-beta.8

MoneySiren v0.1.7-beta.8 is an explicitly unsigned Windows preview. It keeps the desktop HUD responsive when the optional Codex reset-credit network endpoint is slow or unavailable.

## Included

- HUD-scoped live collection no longer waits for optional remote reset-credit enrichment.
- Local Codex app-server and bounded session metadata still supply rate-limit percentages, reset-credit metadata when locally available, and normalized numeric usage estimates.
- A regression test verifies that HUD scope is propagated to local collectors.
- The beta.7 bounded Codex log scanning remains in place: 48 recent files, 64 KiB classification reads, and 512 KiB tail reads.
- Existing daily, weekly, and monthly SQLite history behavior remains unchanged.

## Install

```powershell
npm install -g @moneysiren/app@next
msiren install --all --allow-unsigned-hud --tag v0.1.7-beta.8
msiren hud
```

## Windows warning

This preview is not Authenticode-signed and does not have a verified publisher. Windows may display Unknown Publisher or SmartScreen warnings, and managed Windows policy may block execution. Do not disable Defender, SmartScreen, or Smart App Control globally.

## Data handling

HUD status is derived from normalized numeric metadata. Raw prompt text, shell command bodies, auth data, and raw JSONL content are not persisted or returned. The dedicated reset-credit API remains available for an explicit refresh outside the HUD hot path.

## macOS scope

This release does not publish a macOS application.
