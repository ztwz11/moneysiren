# StackSpend Security Model

## Principles

- Local-first by default.
- Env-only secrets for v0.1.
- Read-only provider connectors.
- Redact before persistence.
- No telemetry by default.
- All example credentials must be fake.

## Secrets

StackSpend v0.1 reads secrets from environment variables:

- `AWS_PROFILE`
- `OPENAI_ADMIN_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `SLACK_WEBHOOK_URL`

Secrets must not be written to SQLite, logs, reports, dashboard API responses, or screenshots.

## Data That Must Not Be Persisted Raw

- provider raw responses
- API keys
- tokens
- Slack webhook URLs
- account IDs
- project IDs
- invoice IDs
- billing profile objects
- card data
- emails from provider payloads

## Redaction Requirements

Before writing to SQLite, connectors must normalize provider data into explicit fields and pass all provider-sourced identifiers through masking/redaction utilities.

## Logs

Logs may include:

- provider name
- sync status
- high-level error class
- timing
- number of normalized records

Logs must not include:

- raw API responses
- credentials
- billing profile payloads
- unmasked identifiers

## Telemetry

Telemetry is disabled by default. If telemetry is added later, it must be opt-in only and documented clearly.
