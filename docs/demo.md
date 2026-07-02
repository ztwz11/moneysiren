# MoneySiren Demo

This demo should use fake fixture data only.

Do not use live credentials, real provider account IDs, OpenAI organization IDs, webhook URLs, local AI prompt text, billing profiles, invoices, or real screenshots of account dashboards.

## What the demo should show

A two-minute demo should show:

1. Source-free install or local source setup.
2. Fixture-backed mock sync.
3. Local dashboard overview.
4. AI usage/cost area.
5. Cloud/SaaS usage or cost area.
6. Local AI CLI usage estimate view.
7. HUD or notification settings.
8. Validation commands.

## Suggested script

```bash
npm install -g @moneysiren/app
msiren --version
msiren install --status
msiren sync --provider mock
msiren start
msiren hud
msiren status
```

For source review:

```bash
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install
pnpm --filter moneysiren dev -- init
pnpm --filter moneysiren dev -- sync --provider mock
npm run dev:web
```

## Screenshots

All screenshots must be generated from fake fixture data.

Screenshot checklist:

- [ ] No live API keys.
- [ ] No OpenAI organization IDs.
- [ ] No AWS account IDs.
- [ ] No Supabase project refs.
- [ ] No Cloudflare account IDs.
- [ ] No webhook URLs.
- [ ] No emails.
- [ ] No invoice IDs.
- [ ] No card data.
- [ ] No local prompt text.
- [ ] No raw provider payloads.

## Demo narrative

Use this narrative:

> MoneySiren helps OSS maintainers and indie developers understand AI/cloud usage and cost risk locally. It keeps provider access read-only, stores normalized snapshots in local SQLite, and avoids uploading secrets or raw billing data to a hosted SaaS.

Avoid this narrative:

> MoneySiren is mainly a way to inspect unofficial internal API data.
