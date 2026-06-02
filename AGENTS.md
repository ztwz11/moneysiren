# StackSpend Development Rules

Role: this repository is the product codebase for StackSpend.

Goal: build a local-first, open-source cloud/SaaS usage, status, and expected billing dashboard for individual developers and small teams.

## Repository Boundary

- `auto-driver` is only the automation controller.
- StackSpend product files must live in this repository.
- Do not place product code, product docs, tests, release notes, or README content in `auto-driver`.
- Automation prompts may be launched from `auto-driver`, but implementation artifacts belong here.

## Core Principles

- CLI-first.
- Local SQLite by default.
- API keys and tokens must not be committed.
- v0.1 must use env-only secrets.
- Provider connectors must be read-only.
- Raw provider payloads must be redacted before persistence.
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

All examples must be fake and clearly marked.

## Review Requirements

Every implementation slice must report:

- changed files
- commands run
- test results
- typecheck result
- pending risks
- security impact

## Spec Lock

Do not begin implementation slices until the planning artifacts are reviewed and the verdict is:

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
```
