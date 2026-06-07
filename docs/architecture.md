# StackSpend Architecture

## Overview

StackSpend is a local-first TypeScript monorepo. The CLI collects normalized snapshots from read-only provider connectors and writes them to local SQLite. The local web dashboard reads the same SQLite database and presents spend, usage, risk, and health summaries.

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

1. User runs `stackspend sync`.
2. Config loader reads env-first provider credentials.
3. Provider connector performs read-only API calls.
4. Connector normalizes data into snapshots.
5. Security layer redacts sensitive identifiers before persistence.
6. DB layer writes normalized snapshots to SQLite.
7. Reports and dashboard read normalized snapshots.

`stackspend dashboard check` is a local HTTP probe for the web dashboard. It calls `/api/dashboard`, reports sanitized status and payload summary fields, and does not start or package the Next.js app.

The route-based web dashboard separates canonical SQLite data from `live_today` overlays. `GET /api/live-today` reads the current in-memory live cache. `POST /api/live-today` performs a manual read-only live refresh and keeps the result provisional.

Local web connection flows use `/api/auth/session` for an opaque local session plus CSRF token, `/api/connections/[provider]/credentials` for read-only credential mutation, and `/api/auth/start|callback/[provider]` for localhost OAuth broker state/nonce/PKCE handling. Supabase OAuth can exchange a localhost callback code for a read-only token when local OAuth env is configured. Provider write operations are not implemented.

## Storage

Default local DB path:

```text
.stackspend/stackspend.sqlite
```

The path can be overridden with:

```text
STACKSPEND_DB_PATH
```

## Design Constraints

- No raw provider payload persistence.
- No telemetry by default.
- No provider write operations.
- No credentials in SQLite.
- No credential material in browser localStorage, sessionStorage, readable cookies, dashboard JSON responses, reports, or logs.
- Slack sending requires explicit user action or explicitly configured scheduled command.
