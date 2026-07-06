# Roadmap

MoneySiren is early and actively maintained. This roadmap describes intended direction, not a guarantee of dates or scope.

## v0.1 initial public local release

Current v0.1 focus:

- source-free local install through `@moneysiren/app`;
- local SQLite snapshots;
- local Next.js dashboard;
- Tauri tray/HUD;
- OpenAI usage/cost sync;
- AWS Cost Explorer sync;
- fixture-backed Supabase and Cloudflare connectors;
- local Codex CLI and Claude CLI usage estimates;
- Korean daily reports;
- optional Slack webhook delivery;
- secret scanning and release validation.

## v0.2

Planned focus:

- stabilize OpenAI usage/cost connector behavior;
- improve Windows and macOS install checks;
- add provider connector test harness documentation;
- add local subscription-cost model for flat-plan SaaS spend;
- improve dashboard risk scoring;
- add emergency action preparedness with requirements, manual runbooks, local dry-run readiness, and sanitized audit records;
- improve local AI CLI usage estimate docs;
- publish maintainer-oriented Codex workflow examples;
- add more redaction tests around provider payloads and notification output.

## v0.3

Possible focus:

- plugin-style provider connector interface;
- more complete provider redaction test suite;
- documented PR review automation pattern;
- optional local-only scheduler;
- expanded dashboard export formats;
- improved release artifact verification UX;
- local backup/export guidance for SQLite snapshots.

## Not planned

MoneySiren does not plan to add:

- hosted SaaS telemetry by default;
- storage of provider credentials in SQLite;
- persistence of raw provider payloads;
- provider write actions without separate emergency credentials, dry-run, confirmation, audit, and recovery controls;
- upload of local AI CLI logs to a remote service;
- public demos using real account data;
- screenshots containing live billing details or organization identifiers.

## Maintainer priorities

MoneySiren prioritizes:

1. Local-first safety.
2. Read-only provider access.
3. Inspectable normalized data.
4. Fake fixtures and reproducible review.
5. Clear install paths for individual developers and small teams.
6. Codex-friendly maintenance workflows.
