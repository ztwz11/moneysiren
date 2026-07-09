# MoneySiren v0.1.2

MoneySiren v0.1.2 is a public local patch release.

This release keeps the local-first v0.1 workflow and improves the temporary
unsigned Windows HUD smoke path while open-source code signing is pending.

## Included

- CLI and app installer packages for the public local release channel.
- Source-free local web runtime asset.
- Windows HUD artifact for explicit local smoke testing when unsigned HUD
  opt-in is enabled.
- msiren install --hud --allow-unsigned-hud for user-visible local HUD smoke
  opt-in.
- Clear msiren hud guidance when no desktop HUD artifact is installed.
- SHA256 checksum verification for downloaded web and HUD assets.

## Windows HUD signing status

The default install path requires signed Windows HUD metadata for public stable
installs.

Until a trusted Windows signing path is ready, local testers can explicitly opt
in to unsigned HUD smoke testing:

    msiren install --hud --allow-unsigned-hud
    msiren hud

This opt-in is for local testing only. It does not remove Windows publisher
warnings or make the HUD a stable signed artifact.

## Security

- Provider connectors remain read-only.
- Telemetry remains off by default.
- Raw provider payloads and credential material must not be persisted.
- Do not commit signing material, account identifiers, auth files, webhook URLs,
  local AI prompt text, or raw local AI logs.
