# MoneySiren Demo

This demo path is for people who want to understand MoneySiren before connecting any real provider. It uses fake fixture-backed local data only.

Do not use live credentials, provider account IDs, OpenAI organization IDs, project refs, webhook URLs, local AI prompt text, billing profiles, invoices, raw JSONL lines, auth file contents, or screenshots of real account dashboards.

## Fast Demo Without Credentials

```bash
npm install -g @moneysiren/app
msiren --version
msiren install --status
msiren sync --provider mock
msiren start
```

Open the dashboard that `msiren start` launches. Optional desktop HUD review:

```bash
msiren hud
msiren status
```

The `mock` provider creates local fake review snapshots. It does not call OpenAI, AWS, Supabase, Cloudflare, Codex, Claude, Slack, or any hosted MoneySiren service.

## Source Review Demo

```bash
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install
pnpm --filter moneysiren dev -- init
pnpm --filter moneysiren dev -- sync --provider mock
npm run dev:web
```

Open `http://127.0.0.1:3000/en/dashboard/overview`.

## What To Look At

- Dashboard overview: month estimate, confirmed cost, live usage, services needing attention.
- Provider rows: cost services and usage-only local AI surfaces are intentionally separated.
- Connection diagnostics: warnings should explain the next local action without exposing secrets.
- Emergency readiness: manual readiness, official links, and audit state only; no provider execution.
- HUD/settings: local display preferences and notification thresholds.

## What Fake Data Means

Fixture and mock data is synthetic. It is useful for reviewing layout, local SQLite persistence, redaction boundaries, and troubleshooting copy. It is not an adoption metric, real billing profile, real provider account, or benchmark.

## Credential-Free Versus Credential Paths

| Path | Requires real credential? | Calls provider API? | Purpose |
|---|---:|---:|---|
| `msiren sync --provider mock` | No | No | Fast local product review |
| Provider fixture env vars | No | No | Parser and dashboard review with committed fake payloads |
| `msiren sync --provider openai` | Yes | Yes, read-only | OpenAI usage/cost snapshots |
| `msiren sync --provider aws` | Yes | Yes, read-only | AWS Cost Explorer snapshots |
| Local Codex/Claude usage surfaces | No cloud credential | No provider billing API | Local sanitized usage/quota metadata |

## Two-Minute Demo Narrative

1. Install: `npm install -g @moneysiren/app`.
2. Run fake data: `msiren sync --provider mock`.
3. Open local dashboard: `msiren start`.
4. Show AI/cloud/SaaS usage risk areas.
5. Show Codex/Claude local usage surfaces without prompt text.
6. Show emergency readiness as manual links and readiness state, not execution.
7. Show local-first security docs and contribution paths.

Use this narrative:

> MoneySiren helps OSS maintainers and indie developers understand AI/cloud usage and cost risk locally. It keeps provider access read-only, stores normalized snapshots in local SQLite, and avoids uploading secrets, raw billing data, or local AI logs to a hosted SaaS.

Avoid this narrative:

> MoneySiren is mainly a way to inspect unofficial internal API data.

## Screenshots

All screenshots must be generated from fake fixture data.

Screenshot checklist:

- [ ] No live API keys.
- [ ] No OAuth tokens.
- [ ] No webhook URLs.
- [ ] No provider account IDs.
- [ ] No project IDs or refs.
- [ ] No organization IDs.
- [ ] No emails.
- [ ] No invoice IDs.
- [ ] No card data.
- [ ] No local prompt text.
- [ ] No shell command bodies.
- [ ] No raw JSONL lines.
- [ ] No auth file contents.
- [ ] No raw provider payloads.

More example flows are in [demo-scenarios.md](demo-scenarios.md).
