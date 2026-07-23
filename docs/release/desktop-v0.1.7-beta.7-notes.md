# MoneySiren v0.1.7-beta.7

MoneySiren v0.1.7-beta.7 is an explicitly unsigned Windows preview. It restores responsive HUD rendering on machines with large Codex session archives while preserving the saved HUD labels and item order.

## Included

- Bounded live-status scanning of the 48 most recently modified Codex session files.
- Bounded reads of up to 64 KiB for session-surface classification and 512 KiB from the end of each file for recent usage.
- A regression test proving that oversized prompt content outside the bounded tail is neither parsed nor returned.
- Existing daily, weekly, and monthly SQLite history behavior remains unchanged.
- Source-free local web dashboard runtime, Windows NSIS installer, portable HUD executable, and SHA256 checksum manifests.
- Machine-readable `moneysiren-tray-windows-UNSIGNED-PREVIEW.json` metadata bound to this tag and source commit.

## Install

```powershell
npm install -g @moneysiren/app@next
msiren install --all --allow-unsigned-hud --tag v0.1.7-beta.7
msiren hud
```

## Windows warning

This preview is not Authenticode-signed and does not have a verified publisher. Windows may display Unknown Publisher or SmartScreen warnings, and managed Windows policy may block execution. Do not disable Defender, SmartScreen, or Smart App Control globally. Use the web dashboard if local policy does not permit unsigned desktop applications.

The stable release channel remains fail-closed and still requires trusted Windows signing.

## Data handling

Live status reads are processed in memory and expose only normalized numeric usage metadata. Raw prompt text, shell command bodies, auth data, and raw JSONL content are not persisted or returned. Because live status is intentionally bounded, very old activity outside the sampled files may not contribute to the current live estimate.

## macOS scope

This release does not publish a macOS application. The macOS unsigned-preview validation path remains available in source for a future macOS-only prerelease after it passes on a macOS runner.
