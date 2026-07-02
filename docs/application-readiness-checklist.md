# Application Readiness Checklist

Use this before submitting MoneySiren to an open-source maintainer support program.

## Repository positioning

- [ ] README first screen explains MoneySiren as a local-first AI/cloud usage and cost observability tool.
- [ ] README mentions OSS maintainers, indie developers, and small teams.
- [ ] README mentions OpenAI/Codex usage/cost visibility.
- [ ] README mentions read-only provider connectors.
- [ ] README mentions local SQLite snapshots.
- [ ] README mentions telemetry off by default.
- [ ] README does not overclaim adoption.
- [ ] README does not foreground unofficial or undocumented integrations.

## Documentation

- [ ] `docs/codex-for-open-source.md` exists.
- [ ] `docs/openai-oss-application-draft.md` exists.
- [ ] `docs/experimental-integrations.md` exists.
- [ ] `docs/roadmap.md` exists.
- [ ] `docs/demo.md` exists.
- [ ] `docs/provider-connector-test-harness.md` exists.
- [ ] `AGENTS.md` exists.
- [ ] `CONTRIBUTING.md` exists.
- [ ] Issue templates exist.

## Safety

- [ ] No `.env` files are committed.
- [ ] No API keys are committed.
- [ ] No OAuth tokens are committed.
- [ ] No webhook URLs are committed.
- [ ] No real provider account IDs are committed.
- [ ] No OpenAI organization IDs are committed.
- [ ] No Supabase project refs are committed.
- [ ] No Cloudflare account IDs are committed.
- [ ] No invoice IDs or card data are committed.
- [ ] No email addresses are committed in fixtures or screenshots.
- [ ] No raw provider responses are committed.
- [ ] No local prompt text is committed.
- [ ] No Codex or Claude auth files are committed.

## Validation Results

Record results before application submission. Keep this command set aligned with
`.github/workflows/ci.yml` plus the full-history secret scan used for public
review:

```bash
npm run typecheck
npm run test
npm run build
npm run tray:native:check
git diff --check
npm run secret:scan
npm run secret:scan:all
```

```text
Commit:
Date:
npm run typecheck:
npm run test:
npm run build:
npm run tray:native:check:
git diff --check:
npm run secret:scan:
npm run secret:scan:all:
```

## Application answer checks

- [ ] The application says the project is MIT-licensed.
- [ ] The application says the project is local-first.
- [ ] The application says provider connectors are read-only.
- [ ] The application says raw provider payloads and credential material are not persisted.
- [ ] The application says the project is early and actively maintained.
- [ ] The application explains exactly how Codex will be used.
- [ ] API credits, if requested, are tied to PR review, maintainer automation, or release workflow experiments.
- [ ] Codex Security, if requested, is framed as conditional and relevant to provider connector safety.
- [ ] The application promises public outputs that the repo can actually deliver.
