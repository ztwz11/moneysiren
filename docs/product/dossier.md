# StackSpend Product Dossier

## Product

StackSpend is an open-source, local-first cloud/SaaS usage, service status, and expected billing dashboard for individual developers and small teams.

## Problem

Developers often use many services at once: AWS, Google Cloud, Supabase, Cloudflare, OpenAI, Vercel, GitHub Actions, Railway, Fly.io, and others. Each service exposes usage, status, billing, and quota information differently. The result is scattered dashboards, late surprise bills, and weak visibility into daily spend changes.

## Target Users

1. Individual developers running side projects or AI products.
2. Small teams that want spend visibility without buying enterprise FinOps tooling.
3. Open-source maintainers who self-host infrastructure and SaaS tooling.
4. AI builders tracking API usage and expected monthly spend.

## Value Proposition

- One local dashboard for cloud/SaaS spend and health.
- Daily Korean report with expected billing and risk hints.
- Local SQLite storage by default.
- Read-only connectors with minimal permissions.
- No telemetry by default.
- Extensible connector model for additional SaaS providers.

## v0.1 MVP

Included:

- TypeScript monorepo.
- CLI-first workflow.
- SQLite local storage.
- Local Next.js dashboard.
- AWS Cost Explorer connector.
- OpenAI Usage/Costs connector.
- Supabase usage/health connector.
- Cloudflare billing usage experimental connector.
- Korean daily report.
- Slack webhook delivery.
- Env-only secrets.
- Redaction before persistence.

Out of scope:

- OAuth.
- Hosted SaaS.
- Multi-user/team mode.
- Enterprise FinOps controls.
- GCP, Vercel, GitHub Actions, Anthropic, Railway, Fly.io connectors.
- Advanced anomaly ML.

## Non-goals

- Replacing enterprise FinOps platforms.
- Performing write operations against provider accounts.
- Storing raw billing or usage payloads.
- Becoming a hosted service in v0.1.

## Existing Tool Landscape

- Komiser: broad cloud asset/cost visibility; less focused on local-first developer SaaS billing.
- OpenCost: strong Kubernetes cost allocation; not a general SaaS billing dashboard.
- CloudQuery: excellent data extraction framework; not a productized local spend dashboard by itself.
- Infracost: estimates IaC changes before deployment; not current monthly usage/billing monitoring.
- Koku: cloud/hybrid cost management; more enterprise-oriented.

## Product Thesis

A small, secure, local-first dashboard for developer spend fills a gap between manual dashboard checking and heavy FinOps tooling.
