# MoneySiren v0.1.7-beta.6

MoneySiren v0.1.7-beta.6 is an explicitly unsigned Windows preview. It refreshes the product identity and completes authenticated Windows public-install verification before npm `next` publication.

## Included

- The selected gauge-and-alarm-bell icon across the web app, Windows executable, tray, and Apple touch surfaces.
- Real service icons in the dashboard navigation for AWS, Codex/OpenAI, Claude/Anthropic, and Antigravity/Vertex AI.
- A neutral cloud fallback for providers that do not yet have a dedicated icon.
- Source-free local web dashboard runtime, Windows NSIS installer, portable HUD executable, and SHA256 checksum manifests.
- Machine-readable `moneysiren-tray-windows-UNSIGNED-PREVIEW.json` metadata bound to this tag and source commit.
- Candidate and public installed-package smokes before npm `next` publication.
- GitHub Actions release-token forwarding for authenticated public release lookup during isolated installation smoke tests. The token stays in process memory and is not persisted or logged.

## Install

```powershell
npm install -g @moneysiren/app@next
msiren install --all --allow-unsigned-hud --tag v0.1.7-beta.6
msiren hud
```

## Windows warning

This preview is not Authenticode-signed and does not have a verified publisher. Windows may display Unknown Publisher or SmartScreen warnings, and managed Windows policy may block execution. Do not disable Defender, SmartScreen, or Smart App Control globally. Use the web dashboard if local policy does not permit unsigned desktop applications.

The stable release channel remains fail-closed and still requires trusted Windows signing.

## macOS scope

This release does not publish a macOS application. The macOS icon and unsigned-preview validation path are included in source for a future macOS-only prerelease after it passes on a macOS runner.
