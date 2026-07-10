# Changelog

All notable changes to MoneySiren are documented here.

## [Unreleased]

### Added

- A versioned growth and reliability implementation plan.
- Safe Issue Forms, project governance, and code ownership.
- The Codex measurement v2 contract and synthetic GPT-5.6/App Server fixtures.
- Official Codex App Server stdio reads for rate limits and account usage, with normalized cache/deduplication and no auth-file or undocumented HTTP access.
- GPT-5.6 Sol/Terra/Luna model coverage and separate cached-input token accounting for OpenAI Platform usage.
- Stable `Sync <provider>: <status>` output with exit codes 0 (ok), 2 (partial), and 1 (error).

## [0.1.5] - 2026-07-08

Release status: GitHub Release published.

### Fixed

- Repaired the desktop release workflow so a versioned web-runtime archive could
  be published.
- Aligned workspace, CLI, app, web, and tray package versions to 0.1.5.

### Known limitations

- The first isolated Windows fresh-install smoke ran before the matching v0.1.5
  runtime asset was available and is preserved as blocked historical evidence.
- Windows HUD artifacts remain Preview unless valid signing metadata is present.

## [0.1.4] - 2026-07-08

Release status: tag only; no GitHub Release was published.

### Added

- Open-source adoption documentation, provider support and permission matrices,
  demo scenarios, troubleshooting guidance, and starter-issue guidance.
- Question and private-security entry points.
- Improved CLI doctor and connection diagnostics.

### Known limitations

- The isolated Windows fresh-install smoke was blocked because no matching
  v0.1.4 GitHub Release runtime existed.

## [0.1.3] - 2026-07-07

Release status: tag only; no GitHub Release was published.

### Added

- Read-only emergency-action dry runs, permission checks, official-link routing,
  and persisted sanitized run metadata.
- Sync status and connection diagnostics in the dashboard.

### Changed

- Improved dashboard readability.
- Added automatic selection of the next unused public patch version.

## [0.1.2] - 2026-07-03

Release status: GitHub Release published.

### Added

- Explicit msiren install --hud --allow-unsigned-hud local smoke-test opt-in.
- Clear guidance when no desktop HUD artifact is installed.
- Checksum verification for downloaded web and HUD assets.

## [0.1.1] - 2026-07-03

Release status: GitHub prerelease published.

### Changed

- Added the temporary environment-based unsigned Windows HUD opt-in.
- Improved release-asset checksum and install-path handling.

## [0.1.0] - 2026-07-02

Release status: initial GitHub prerelease published.

### Added

- CLI-first local installation.
- Local SQLite snapshots and the local Next.js dashboard.
- Tauri tray/HUD surface.
- Read-only provider connectors and credential-free mock sync.
- Local-first security baseline with telemetry disabled by default.

[Unreleased]: https://github.com/ztwz11/moneysiren/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/ztwz11/moneysiren/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/ztwz11/moneysiren/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/ztwz11/moneysiren/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/ztwz11/moneysiren/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ztwz11/moneysiren/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0
