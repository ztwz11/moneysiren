# Local-First Architecture

MoneySiren is designed as a local developer tool, not a hosted SaaS.

## Components

- CLI: setup, sync, report, runtime management, and local review commands.
- Local Next.js dashboard: reads normalized SQLite snapshots and safe local overlays.
- Local SQLite snapshots: canonical normalized usage, billing, health, cost, alert, and audit records.
- Read-only connectors: OpenAI, AWS, Supabase, Cloudflare, mock fixtures, and local AI usage surfaces.
- Optional local credential store: local read-only credential handling without hosted upload.
- Desktop tray/HUD: local shell that opens the same local runtime and HUD route.
- Secret scanner: blocks common committed secrets and sensitive local artifacts.

## Data Flow

1. User runs a CLI sync or local dashboard refresh.
2. Connector reads a provider or fake fixture using read-only access.
3. Raw provider payloads are normalized and redacted before persistence.
4. SQLite stores normalized local snapshots only.
5. Dashboard, HUD, reports, and notifications read sanitized local state.

## What Is Not In The Architecture

- hosted dashboard;
- hosted credential upload;
- user accounts or team mode;
- remote MoneySiren database;
- default telemetry;
- provider write APIs;
- emergency execution buttons.

## Telemetry

Telemetry is off by default. Any future telemetry must be explicit opt-in and must preserve the same redaction boundaries for credentials, raw provider payloads, local AI logs, prompt text, and shell command bodies.

## Emergency Readiness

Emergency readiness is a local readiness and audit surface. It can show official provider links and manual checklists, but it must not execute provider actions.
