# MoneySiren Development Rules

Role: this repository is the product codebase for MoneySiren.

Goal: build a local-first, open-source AI/cloud/SaaS usage, status, and expected billing dashboard for open-source maintainers, individual developers, and small teams.

## Repository Boundary

- `auto-driver` is only the automation controller.
- MoneySiren product files must live in this repository.
- Do not place product code, product docs, tests, release notes, or README content in `auto-driver`.
- Automation prompts may be launched from `auto-driver`, but implementation artifacts belong here.

## Core Principles

- CLI-first.
- Local SQLite by default.
- API keys and tokens must not be committed.
- v0.1 must use env-only secrets.
- Provider connectors must be read-only.
- Raw provider payloads must be redacted before persistence.
- Local AI prompt text, shell command bodies, auth files, and raw JSONL logs must not be exposed in logs, fixtures, dashboard JSON, reports, screenshots, or tests.
- No telemetry by default.
- Telemetry, if added later, must be opt-in only.
- Prefer small, reviewable slices.
- Do not implement enterprise FinOps features before the MVP is stable.

## MVP Scope

Included in v0.1:

- TypeScript monorepo.
- CLI.
- SQLite.
- Local web dashboard.
- AWS Cost Explorer connector.
- OpenAI Usage/Costs connector.
- Supabase usage/health connector.
- Cloudflare billing usage experimental connector.
- Korean daily report.
- Slack webhook.

Out of scope for v0.1:

- OAuth.
- Hosted SaaS.
- Multi-user/team mode.
- GCP connector.
- Vercel connector.
- GitHub Actions connector.
- Anthropic connector.
- Railway connector.
- Fly.io connector.
- Advanced anomaly detection.

## Security Rules

Never commit:

- `.env`
- API keys
- tokens
- webhook URLs
- account IDs
- project IDs
- invoice IDs
- card data
- emails from provider payloads
- raw billing profiles
- raw provider responses
- local AI prompt text
- shell history
- Codex or Claude auth files

All examples must be fake and clearly marked.

## Codex-Friendly Work Areas

Good Codex tasks:

- add fixture-backed provider parser tests;
- improve README, install docs, and release notes;
- refactor dashboard view models;
- add redaction tests;
- update issue templates;
- review CI workflow safety;
- improve fake fixture coverage;
- improve local dashboard empty states.

High-risk areas requiring careful review:

- provider auth;
- local AI CLI auth file access;
- billing payload normalization;
- notification payloads;
- Slack webhook handling;
- GitHub release signing;
- any code touching secrets, tokens, account IDs, local auth files, raw provider payloads, or local AI logs.

## Provider Connector Expectations

New or changed provider connectors must document:

- provider name;
- auth mechanism;
- minimum required scope;
- read-only guarantee;
- fixture source and redaction rules;
- normalized output schema;
- persistence boundaries;
- dashboard/report exposure boundaries.

## Review Requirements

Every implementation slice must report:

- changed files
- commands run
- test results
- typecheck result
- pending risks
- security impact

## Planning Gate

For large feature or security-sensitive changes, produce a short plan first and
wait for maintainer confirmation when working interactively.

Small documentation, fixture, copy, and test improvements may proceed directly
if they follow this AGENTS.md and preserve the local-first security model.
