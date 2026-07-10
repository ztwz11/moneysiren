# MoneySiren Security Model

MoneySiren is a local-first dashboard for cloud, SaaS, and AI usage visibility. The security model is built around read-only provider access, local storage, and sanitized outputs.

Related docs:

- [Data we never store](data-we-never-store.md)
- [Provider permissions](provider-permissions.md)
- [Local-first architecture](local-first-architecture.md)
- [Codex rate-limit and account usage](codex-reset-credits.md)
- [Troubleshooting](troubleshooting.md)

## Secret Sources

MoneySiren may read secrets from:

- process environment variables;
- OS keychain through the local credential backend;
- encrypted local vault backend when explicitly configured.

MoneySiren must not store credential material in SQLite.

For official local Codex measurements, the Codex child process owns authentication. MoneySiren starts the documented App Server stdio transport and does not ingest Codex credentials into the web process.

## Local Storage

SQLite stores normalized snapshots only. Raw provider responses, raw JSON-RPC messages, process output streams, billing profiles, API keys, tokens, webhook URLs, account IDs, project IDs, invoice IDs, card data, and emails must not be persisted.

A Codex measurement may be persisted only after it conforms to schema v2 and has passed the sanitization boundary described below.

## Browser Output Policy

Dashboard JSON and rendered UI must not expose credential material, account identifiers, raw provider payloads, raw App Server messages, or raw local AI records. Local session and CSRF values are local web controls, not provider credentials.

## Logging Policy

Logs should use sanitized messages. Do not log provider Authorization headers, API keys, OAuth refresh tokens, Slack webhook URLs, raw JSONL lines, App Server stdout or stderr, prompt text, tool input, shell commands, or local file context.

## Slack Webhook Policy

Slack delivery is opt-in per run. `SLACK_WEBHOOK_URL` is treated as a local secret and must not appear in repository files, logs, fixtures, reports, or test snapshots.

## Official Codex App Server Boundary

MoneySiren runs `codex app-server --listen stdio://` locally and limits its measurement calls to:

- `account/rateLimits/read`;
- `account/usage/read`.

Only normalized schema v2 output crosses from the transport adapter into application code. The adapter must enforce timeouts and response-size bounds, reject malformed results, map failures to sanitized reason codes, and discard raw messages after normalization.

Allowed normalized fields include:

- authoritative rate-limit counts and windows;
- reset times;
- reset-credit details supplied by App Server, without opaque identifiers;
- official account usage summary values and daily buckets;
- source, accuracy, timestamp, and coverage metadata.

The authoritative `availableCount` is independent of the number of supplied detail rows. When `detailsComplete` is false, UI and reports must label the coverage as partial and must not synthesize missing credits. A lifetime awarded-credit total remains unavailable unless a documented source explicitly provides one.

Official Codex account usage and locally parsed per-model estimates are separate measurements. They must not be summed, substituted, or presented with the same accuracy label.

## Local AI Record Policy

Local Codex and Claude records may include sensitive user content. MoneySiren may parse them only to derive sanitized metadata:

- token counts;
- quota percentages;
- reset times;
- safe model identifiers;
- timestamps;
- confidence, freshness, and coverage labels.

Raw lines and content-bearing fields must not appear in logs, fixtures, dashboard JSON, reports, screenshots, tests, or persisted snapshots.

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
