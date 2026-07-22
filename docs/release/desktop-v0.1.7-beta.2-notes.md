# MoneySiren v0.1.7-beta.2

MoneySiren v0.1.7-beta.2 is an explicitly unsigned Windows preview for early HUD testing while trusted code signing is unavailable.

## Included

- Drag-and-drop ordering for selected HUD items, with keyboard arrow controls as an accessible alternative.
- A separate Codex total-token HUD item backed only by sanitized numeric local usage metadata.
- Duplicate-resistant Codex App/CLI token selection that avoids summing potentially overlapping local sessions.
- Source-free local web dashboard runtime.
- Windows NSIS installer and portable HUD executable.
- SHA256 checksum manifests for every published runtime artifact.
- Machine-readable `moneysiren-tray-windows-UNSIGNED-PREVIEW.json` metadata bound to this tag and source commit.
- Candidate and public installed-package smokes before npm `next` publication.

## Install

```powershell
npm install -g @moneysiren/app@next
msiren install --hud --allow-unsigned-hud --tag v0.1.7-beta.2
```

## Windows warning

This preview is not Authenticode-signed and does not have a verified publisher. Windows may display Unknown Publisher or SmartScreen warnings, and managed Windows policy may block execution. Do not disable Defender, SmartScreen, or Smart App Control globally. Use the web dashboard if local policy does not permit unsigned desktop applications.

The stable release channel remains fail-closed and still requires trusted Windows signing.
