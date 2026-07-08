# MoneySiren v0.1.5

MoneySiren v0.1.5 is a public local patch release.

This release keeps the local-first v0.1 workflow and improves the temporary unsigned Windows HUD smoke path while open-source code signing is pending.

## Included

- CLI and app installer packages for the public local release channel.
- Source-free local web runtime asset.
- Windows HUD artifact for explicit local smoke testing when unsigned HUD opt-in is enabled.
- `msiren install --hud --allow-unsigned-hud` for user-visible local HUD smoke opt-in.
- Clear `msiren hud` guidance when no desktop HUD artifact is installed.
- SHA256 checksum verification for downloaded Web/HUD assets.

## Windows HUD Signing Status

The default install path still requires signed Windows HUD metadata for public release installs.

Until SignPath or another trusted Windows signing path is ready, local testers can explicitly opt in to unsigned HUD testing:

```powershell
msiren install --hud --allow-unsigned-hud
msiren hud
```

This opt-in is for local smoke testing only. It does not remove Windows publisher warnings and does not change public release validation. `MONEYSIREN_ALLOW_UNSIGNED_HUD=true` remains available for advanced npm postinstall or CI smoke paths.

## Security

- Provider connectors remain read-only.
- Telemetry remains off by default.
- Raw provider payloads and credential material must not be persisted.
- Do not commit signing material, account identifiers, auth files, webhook URLs, local AI prompt text, or raw local AI logs.
