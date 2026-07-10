# MoneySiren v0.1.5

MoneySiren v0.1.5 repairs the versioned web-runtime release path and aligns the
public packages with the v0.1.5 source tag.

## Fixed

- Corrected web-runtime archive publication in the desktop release workflow.
- Published a GitHub Release for the v0.1.5 tag.
- Aligned workspace, CLI, app, web, and tray versions.

## Installation status

The first isolated Windows fresh-install smoke ran before the matching runtime
asset was available and is preserved as blocked historical evidence. Source-free
installation must not be described as verified until a linked public-registry
rerun passes.

## Windows HUD status

Unsigned Windows HUD builds are Preview artifacts for explicit local smoke
testing only. They are not Stable desktop releases and may show publisher
warnings.

## Security

- Provider connectors remain read-only.
- Telemetry remains disabled by default.
- Raw provider payloads, credentials, auth files, prompt text, and raw local AI
  logs must not be persisted or included in release evidence.
