# MoneySiren Security Model

MoneySiren is a local-first dashboard for cloud, SaaS, and AI usage visibility. The security model is built around read-only provider access, local storage, and sanitized outputs.

Related docs:

- [Data we never store](data-we-never-store.md)
- [Provider permissions](provider-permissions.md)
- [Local-first architecture](local-first-architecture.md)
- [Troubleshooting](troubleshooting.md)

## Secret Sources

MoneySiren may read secrets from:

- process environment variables
- OS keychain through the local credential backend
- encrypted local vault backend when explicitly configured

MoneySiren must not store credential material in SQLite.

## Local Storage

SQLite stores normalized snapshots only. Raw provider responses, billing profiles, API keys, tokens, webhook URLs, account IDs, project IDs, invoice IDs, card data, and emails must not be persisted.

## Browser Output Policy

Dashboard JSON and rendered UI must not expose credential material or raw provider payloads. Local session and CSRF values are local web controls, not provider credentials.

## Logging Policy

Logs should use sanitized messages. Do not log provider Authorization headers, API keys, OAuth refresh tokens, Slack webhook URLs, raw JSONL lines, or local AI CLI prompt text.

## Slack Webhook Policy

Slack delivery is opt-in per run. `SLACK_WEBHOOK_URL` is treated as a local secret and must not appear in repository files, logs, fixtures, reports, or test snapshots.

## Local AI CLI Prompt Policy

Codex CLI and Claude CLI logs may include prompt text, tool input, shell commands, and local file context. MoneySiren should only read and display sanitized metadata:

- token counts
- quota percentages
- reset times
- model names
- timestamps
- confidence/freshness labels

## Emergency Actions Policy

Emergency actions are staged and local-first. The preparedness implementation may show requirements, manual runbooks, local dry-run readiness, and sanitized audit records.

Provider write execution remains disabled until a separate provider-specific spec defines:

- emergency credential scope;
- minimum write permission;
- local dry-run behavior;
- two-step confirmation;
- sanitized audit record fields;
- recovery guidance.

Read-only credentials must not be used for emergency actions, and emergency credentials must not be used for dashboard sync.

## Telemetry

Telemetry is off by default. Any future telemetry must be opt-in only.
