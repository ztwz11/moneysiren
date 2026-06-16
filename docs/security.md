# MoneySiren Security Model

## Principles

- Local-first by default.
- Env-only secrets for v0.1.
- Read-only provider connectors.
- Redact before persistence.
- No telemetry by default.
- All example credentials must be fake.

## Secrets

MoneySiren CLI sync remains env-first for v0.1:

- `AWS_PROFILE`
- `OPENAI_ADMIN_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_IDS`
- `SLACK_WEBHOOK_URL`

The local web dashboard also supports a convenience credential store for read-only connections:

- preferred backend: OS keychain through `@napi-rs/keyring`.
- fallback backend: passphrase-encrypted local vault.
- vault passphrases are never stored by MoneySiren and must stay in the server process memory only.
- credentials are never written to SQLite, localStorage, sessionStorage, readable cookies, logs, reports, dashboard API responses, or screenshots.
- local session cookies contain only an opaque session id; CSRF tokens and OAuth state/nonce/PKCE verifier are held server-side.
- OAuth client secrets, if configured for local provider OAuth, must remain process environment secrets and must not be committed.

`.env.example` must keep secret values blank and may only include fake local fixture paths. Do not create or commit `.env`.

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

## Local Storage

MoneySiren stores alpha data in local SQLite. The default path is `.moneysiren/moneysiren.sqlite`; Docker Compose uses `/data/moneysiren.sqlite` in the `moneysiren_data` volume.

SQLite may contain normalized usage, cost, health, alert, risk, and report run records. Treat local database files as operator data:

- do not commit SQLite files or database exports.
- do not include SQLite files in screenshots, docs, fixtures, or release artifacts.
- do not persist raw provider payloads alongside normalized rows.
- do not store real provider account IDs, project IDs, invoice IDs, emails, billing profiles, card data, API keys, tokens, or webhook URLs.

`live_today` dashboard data is stored only in a short-lived server memory cache by default. It is provisional, expires after the configured TTL, and must not be copied into canonical SQLite snapshot tables.

The encrypted credential vault, when used, is separate from SQLite and is ignored by git through `.moneysiren/`.

## Docker And Compose

Docker support is for local self-host/dev review only. It is not a hosted SaaS deployment path.

- `Dockerfile` builds the workspace without ARG or ENV secrets.
- `.dockerignore` excludes `.env`, `.env.*`, local SQLite data, logs, dependencies, and build output from the Docker context.
- `compose.yaml` sets only non-secret defaults and fake fixture paths.
- real provider credentials or identifiers used for live review must be exported in the operator shell for one run and must not be written into `compose.yaml`, `.env`, Docker build args, images, or committed docs.
- `NEXT_TELEMETRY_DISABLED=1` is set for Docker and Compose.

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

## Slack Report Delivery

Slack delivery is disabled unless the CLI run explicitly requests `report daily --lang ko --send slack`.
`SLACK_WEBHOOK_URL` is read from the process environment for that run only. Tests must use an injected transport and must not call live Slack.
Slack delivery status may be persisted in `report_runs`, but webhook URLs and response payloads must not be persisted.

## Telemetry

Telemetry is disabled by default. If telemetry is added later, it must be opt-in only and documented clearly.
