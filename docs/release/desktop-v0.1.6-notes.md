# MoneySiren v0.1.6

Status: release-note draft. Do not publish until every v0.1.6 gate in the growth
and reliability plan passes.

MoneySiren v0.1.6 is a trust patch focused on Codex measurement accuracy,
truthful sync/freshness states, and reproducible installation.

## Planned

- Official Codex App Server rate-limit and account-usage integration.
- Removal of the undocumented reset-credit HTTP endpoint and direct auth-file
  parsing.
- GPT-5.6 Sol, Terra, and Luna model-aware local token estimates with coverage
  labels.
- OpenAI Platform cached-token normalization.
- Consistent non-zero sync failures and shared stale-data state.
- Versioned immutable release metadata and three-OS source-free install smoke.

## Release blockers

- All required unit, typecheck, build, secret-scan, package-smoke, and browser
  tests must pass.
- The public package, tag, release notes, CHANGELOG, and runtime manifest must
  agree.
- Stable Windows HUD assets require valid signing evidence.
- No raw provider data, auth material, prompt text, commands, or JSONL may enter
  fixtures, logs, API output, screenshots, or release evidence.
