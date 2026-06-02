# StackSpend Architecture

## Overview

StackSpend is a local-first TypeScript monorepo. The CLI collects normalized snapshots from read-only provider connectors and writes them to local SQLite. The local web dashboard reads the same SQLite database and presents spend, usage, risk, and health summaries.

## Components

- `apps/cli`: command-line interface for init, doctor, sync, report, and serve.
- `apps/web`: local Next.js dashboard.
- `packages/core`: provider contracts, collection orchestration, snapshot types, risk engine.
- `packages/db`: SQLite client, migrations, schema helpers.
- `packages/config`: env/config schema and loader.
- `packages/security`: redaction and masking utilities.
- `packages/report`: daily report rendering and Slack webhook sender.
- `packages/connectors/*`: read-only provider connectors.

## Data Flow

1. User runs `stackspend sync`.
2. Config loader reads env-only provider credentials.
3. Provider connector performs read-only API calls.
4. Connector normalizes data into snapshots.
5. Security layer redacts sensitive identifiers before persistence.
6. DB layer writes normalized snapshots to SQLite.
7. Reports and dashboard read normalized snapshots.

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
- Slack sending requires explicit user action or explicitly configured scheduled command.
