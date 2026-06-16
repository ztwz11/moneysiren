# MoneySiren Architecture

## Overview

MoneySiren is a local-first TypeScript monorepo. The CLI collects normalized snapshots from read-only provider connectors and writes them to local SQLite. The local web dashboard reads the same SQLite database and presents spend, usage, risk, and health summaries.

## Components

- `apps/cli`: command-line interface for init, doctor, sync, report, and local dashboard checks.
- `apps/web`: local Next.js dashboard.
- `packages/core`: provider contracts, collection orchestration, snapshot types, risk engine.
- `packages/db`: SQLite client, migrations, schema helpers.
- `packages/config`: env/config schema and loader.
- `packages/credentials`: local credential abstraction with OS keychain and encrypted vault backends.
- `packages/security`: redaction and masking utilities.
- `packages/report`: daily report rendering and Slack webhook sender.
- `packages/connectors/*`: read-only provider connectors.

## Data Flow

1. User runs `moneysiren sync`.
2. Config loader reads env-first provider credentials.
3. Provider connector performs read-only API calls.
4. Connector normalizes data into snapshots.
5. Security layer redacts sensitive identifiers before persistence.
6. DB layer writes normalized snapshots to SQLite.
7. Reports and dashboard read normalized snapshots.

`moneysiren dashboard check` is a local HTTP probe for the web dashboard. It calls `/api/dashboard`, reports sanitized status and payload summary fields, and does not start or package the Next.js app.

The route-based web dashboard separates canonical SQLite data from `live_today` overlays. `GET /api/live-today` reads the current in-memory live cache. `POST /api/live-today` performs a manual read-only live refresh and keeps the result provisional.

`live_today` may include sanitized current-period usage summaries for LLM subscription providers. The OpenAI implementation aggregates tokens and request counts from the read-only organization usage response and does not persist raw provider payloads or secret values.

Providers may have multiple local read-only connections, such as separate API keys or accounts for the same provider. Credential store entries are keyed by provider, scope, and connection id. The web dashboard keeps provider aggregate rows and connection rows separate: canonical SQLite history remains provider aggregate for now, while today's live overlay can be refreshed and displayed per connection.

Local web connection flows use `/api/auth/session` for an opaque local session plus CSRF token, `/api/connections/[provider]/credentials` for read-only credential mutation, and `/api/auth/start|callback/[provider]` for localhost OAuth broker state/nonce/PKCE handling. Supabase OAuth can exchange a localhost callback code for a read-only token when local OAuth env is configured. Provider write operations are not implemented.

The connection settings screen displays provider setup links for the values MoneySiren needs, such as env variable names, profile names, read-only permission references, and provider API documentation. These links are static metadata and never include operator account IDs, tokens, keys, or secrets.

## Storage

Default local DB path:

```text
.moneysiren/moneysiren.sqlite
```

The path can be overridden with:

```text
MONEYSIREN_DB_PATH
```

## Design Constraints

- No raw provider payload persistence.
- No telemetry by default.
- No provider write operations.
- No credentials in SQLite.
- No credential material in browser localStorage, sessionStorage, readable cookies, dashboard JSON responses, reports, or logs.
- Slack sending requires explicit user action or explicitly configured scheduled command.
