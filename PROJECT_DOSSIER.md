# MoneySiren Project Dossier

Status: approved for v0.1 planning gate.

The canonical detailed dossier lives at `docs/product/dossier.md`.

## Approved Product Definition

MoneySiren is a local-first, open-source cloud/SaaS usage, status, and expected billing dashboard for individual developers and small teams.

## Approved v0.1 Scope

- TypeScript pnpm monorepo.
- CLI-first workflow.
- Local SQLite.
- Local Next.js dashboard.
- Read-only connectors for AWS Cost Explorer, OpenAI Usage/Costs, Supabase usage/health, and Cloudflare experimental billing usage.
- Korean daily report.
- Slack webhook.
- Env-only secrets.
- Redaction before persistence.
- No telemetry by default.

## Approved Out-of-Scope

- OAuth.
- Hosted SaaS.
- Multi-user/team mode.
- GCP, Vercel, GitHub Actions, Anthropic, Railway, Fly.io connectors.
- Advanced anomaly detection or ML.
- Enterprise FinOps features.
