# Show HN Draft

Title:

Show HN: MoneySiren, a local-first usage and cost dashboard for AI/cloud tools

Post:

Hi HN,

I am building MoneySiren, an MIT-licensed local-first dashboard for developers who use AI coding tools and cloud/SaaS providers.

The basic idea: OpenAI/Codex, Claude, AWS, Supabase, and Cloudflare usage signals are scattered, and maintainers often want a quick local view without uploading credentials or raw billing data to another SaaS.

MoneySiren currently provides:

- a CLI-first setup flow;
- local SQLite snapshots;
- a local Next.js dashboard;
- a desktop tray/HUD surface;
- fixture-backed demo mode with no credentials;
- read-only provider connectors;
- local Codex/Claude usage metadata surfaces that avoid exposing prompt text or raw logs;
- emergency readiness guidance through manual checklists and official provider links, not provider write actions.

Quickstart:

```bash
npm install -g @moneysiren/app
msiren sync --provider mock
msiren start
```

The project is early and pre-1.0. It is not a hosted SaaS, does not add user accounts, and keeps telemetry off by default.

I would like feedback on the onboarding flow, local-first security model, provider permission docs, and which read-only provider surfaces are most useful for individual maintainers.

GitHub: https://github.com/ztwz11/moneysiren

Please do not post real credentials, provider account identifiers, billing payloads, local AI logs, or screenshots containing private data in public issues.
