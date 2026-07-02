# Application-Ready Release Notes Draft

Use this as a draft for the release notes of an application-ready public local release.

## MoneySiren application-readiness update

This release improves MoneySiren's public open-source maintainer documentation and safety posture.

### Added

- `AGENTS.md` with Codex/agent safety rules.
- `CONTRIBUTING.md` with contribution and PR checklist guidance.
- `docs/codex-for-open-source.md` explaining MoneySiren's Codex for OSS maintenance plan.
- `docs/experimental-integrations.md` to separate optional local-only experiments from the core workflow.
- `docs/provider-connector-test-harness.md` documenting fixture-backed provider connector testing expectations.
- `docs/roadmap.md` for early project direction.
- `docs/demo.md` for fake fixture-based demo guidance.
- Issue templates that warn users not to share secrets or raw provider payloads.

### Changed

- README positioning now emphasizes local-first AI/cloud usage and cost observability for OSS maintainers, indie developers, and small teams.
- Experimental integrations are documented separately from the core provider usage/cost workflow.
- Korean screenshot documentation copy is fixed where mojibake appeared.

### Safety

- No real credentials, account identifiers, raw provider responses, billing profiles, webhook URLs, local AI prompt text, or local AI auth files are included.
- Fixture-backed review remains the recommended public demo path.

### Validation

Before publishing, run:

```bash
pnpm test
pnpm typecheck
git diff --check
npm run secret:scan
npm run secret:scan:all
```

Record the final results in the release PR summary.
