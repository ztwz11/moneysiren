# MoneySiren v0.1.8-beta.1

MoneySiren v0.1.8-beta.1 is an explicitly unsigned Windows preview. It makes compact HUD rows distinguish both the service and the meaning of each metric.

## Included

- Service-specific HUD rows now show the provider logo and metric icon together.
- Reset-credit count and reset-credit expiry use distinct ticket and calendar-clock icons.
- Token, quota, cost, risk, freshness, and health metrics retain dedicated semantic icons.
- Service identity is inferred for known widget types when older snapshots omit `providerKey`.
- Compact summary fitting, full expiry-date rendering, and provider-brand mappings from v0.1.7 remain intact.
- npm and app READMEs now distinguish component selection from an installed native HUD artifact.

## Install

```powershell
npm install -g @moneysiren/app@next
msiren install --all --allow-unsigned-hud --tag v0.1.8-beta.1
msiren hud
```

## Windows warning

This preview is not Authenticode-signed and does not have a verified publisher. Windows may display Unknown Publisher or SmartScreen warnings, and managed Windows policy may block execution. Do not disable Defender, SmartScreen, or Smart App Control globally.

## Data handling

The HUD and documentation changes affect presentation and guidance only. No provider payloads, prompt text, shell command bodies, auth data, or raw local logs are newly read, stored, or returned.

## macOS scope

This release does not publish a macOS application.
