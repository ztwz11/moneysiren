# Launch Post Draft

MoneySiren is a local-first dashboard for AI/cloud/SaaS usage and cost risk.

Developers increasingly use AI coding agents, LLM APIs, cloud services, and small SaaS tools at the same time. The costs and limits live in different places, and some of the most sensitive context is local: CLI logs, prompt text, shell commands, provider identifiers, and billing payloads.

MoneySiren focuses on a narrow local-first workflow:

- install a CLI and local dashboard;
- sync read-only provider data or fake fixture data;
- store normalized snapshots in local SQLite;
- view cost, usage, stale data, and connection risks locally;
- use emergency readiness checklists and official links without provider execution.

Try it with fake data:

```bash
npm install -g @moneysiren/app
msiren sync --provider mock
msiren start
```

What MoneySiren intentionally does not do:

- no hosted dashboard;
- no credential upload;
- no default telemetry;
- no provider write APIs;
- no emergency execution buttons;
- no raw local AI prompt/log exposure.

The project is early and pre-1.0. Good first contributions include docs, fake fixtures, redaction tests, connection diagnostics tests, official provider links, and UI copy improvements.

Repository: https://github.com/ztwz11/moneysiren
