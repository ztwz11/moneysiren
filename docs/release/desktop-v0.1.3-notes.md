# MoneySiren v0.1.3

> Distribution status: this version was tagged, but no GitHub Release or
> versioned runtime assets were published.

MoneySiren v0.1.3 expanded read-only operational readiness and connection
diagnostics while keeping provider execution out of scope.

## Added

- Read-only emergency-action dry runs and permission checks.
- Official provider-link routing and sanitized run metadata.
- Sync status and connection diagnostics in the local dashboard.

## Changed

- Improved dashboard readability.
- Added automatic selection of the next unused public patch version.

## Security

- Emergency readiness remained manual and read-only.
- Provider write APIs were not added.
- Telemetry remained disabled by default.
- Raw provider payloads, credentials, local AI content, and auth files were not
  permitted in release evidence.
