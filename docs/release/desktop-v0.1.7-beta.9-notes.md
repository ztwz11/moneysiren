# MoneySiren v0.1.7-beta.9

MoneySiren v0.1.7-beta.9 is an explicitly unsigned Windows preview. It restores visible provider logos in HUD icon mode.

## Included

- Codex CLI and Codex App icons now reuse both the OpenAI SVG asset and the matching dark OpenAI brand background.
- Claude CLI and Claude App icons now reuse the Anthropic asset and brand background.
- Antigravity reuses the Gemini/Vertex AI asset and matching brand treatment.
- Unknown providers retain the neutral cloud fallback.
- Regression coverage verifies the provider-to-asset and provider-to-brand mappings.
- The bounded local-log scan and non-blocking HUD enrichment improvements from beta.7 and beta.8 remain in place.

## Install

```powershell
npm install -g @moneysiren/app@next
msiren install --all --allow-unsigned-hud --tag v0.1.7-beta.9
msiren hud
```

## Windows warning

This preview is not Authenticode-signed and does not have a verified publisher. Windows may display Unknown Publisher or SmartScreen warnings, and managed Windows policy may block execution. Do not disable Defender, SmartScreen, or Smart App Control globally.

## Data handling

The icon change affects presentation only. No provider payloads, prompt text, shell command bodies, auth data, or raw local logs are newly read, stored, or returned.

## macOS scope

This release does not publish a macOS application.
