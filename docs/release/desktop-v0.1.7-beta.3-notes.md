# MoneySiren v0.1.7-beta.3

MoneySiren v0.1.7-beta.3 is an explicitly unsigned Windows preview with the new MoneySiren app and tray identity while trusted code signing is unavailable.

## Included

- A new gauge-and-alarm-bell MoneySiren app icon selected for the desktop release.
- Separate 512 px application and 64 px tray assets so installer and notification-area surfaces remain clear at their intended sizes.
- A multi-resolution Windows ICO containing 16, 20, 24, 32, 48, 64, 128, and 256 px images.
- Deterministic icon generation and native validation for PNG, ICO, SVG, dimensions, and brand colors.
- The ordered HUD items and sanitized Codex token visibility delivered in v0.1.7-beta.2.
- Source-free local web dashboard runtime, Windows NSIS installer, portable HUD executable, and SHA256 checksum manifests.
- Machine-readable `moneysiren-tray-windows-UNSIGNED-PREVIEW.json` metadata bound to this tag and source commit.
- Candidate and public installed-package smokes before npm `next` publication.

## Install

```powershell
npm install -g @moneysiren/app@next
msiren install --hud --allow-unsigned-hud --tag v0.1.7-beta.3
```

## Windows warning

This preview is not Authenticode-signed and does not have a verified publisher. Windows may display Unknown Publisher or SmartScreen warnings, and managed Windows policy may block execution. Do not disable Defender, SmartScreen, or Smart App Control globally. Use the web dashboard if local policy does not permit unsigned desktop applications.

The stable release channel remains fail-closed and still requires trusted Windows signing.
