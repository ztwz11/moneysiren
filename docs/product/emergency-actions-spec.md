# MoneySiren Emergency Actions Spec

```text
SPEC_LOCKED: YES
EMERGENCY_ACTIONS_IMPLEMENTATION_ALLOWED: YES
PROVIDER_WRITE_EXECUTION_ALLOWED: NO
```

## Goal

Emergency Actions Center helps a local MoneySiren operator respond when provider cost, usage, health, or credential signals become critical.

The first implementation is a preparedness feature. It shows requirements, manual runbooks, dry-run readiness, and audit-ready local plans without executing provider write actions.

## Non-Goals

The first implementation must not:

- revoke, delete, rotate, or create provider credentials;
- stop, pause, terminate, disable, scale, or mutate provider resources;
- call provider write APIs;
- use read-only credentials for emergency actions;
- use emergency credentials for dashboard sync;
- expose provider account IDs, project IDs, invoice IDs, emails, webhook URLs, API keys, tokens, raw provider payloads, raw local AI logs, shell command bodies, or local AI prompt text;
- enable telemetry.

## Staged Rollout

### Stage 1 - Requirements and Manual Runbooks

- Build emergency action candidates from existing provider state.
- Show risk, connection, read-only test, emergency credential readiness, and manual guidance.
- Provide safe commands such as View requirements, Open runbook, Open provider console, and Copy manual checklist.
- Keep every execution command disabled.

### Stage 2 - Local Dry-Run Readiness

- Add a local-only dry-run API that computes readiness without provider write calls.
- Require local session and CSRF.
- Return `localOnly: true`, `secretsReturned: false`, and `executeEnabled: false`.
- Persist only sanitized audit events.

### Stage 3 - Disabled Confirmation Scaffold

- Add the two-step confirmation UI state.
- Require provider name plus action phrase entry.
- Keep execution disabled until provider-specific write adapters are separately reviewed and approved.

### Stage 4 - Provider Write Adapters

Provider write adapters are out of scope for this spec. They require a new locked provider-specific spec, reviewed permissions, emergency credential validation, recovery guidance, dry-run behavior, confirmation behavior, and tests.

## Emergency Credential Boundary

MoneySiren already separates credential scopes into `read-only` and `emergency`.

Rules:

- Read-only credentials are for sync and live reads only.
- Emergency credentials are not used for dashboard sync or live data.
- Emergency credentials must not make `providerWriteActionsEnabled` true by themselves.
- Emergency credential presence can improve readiness from `missing_emergency_credential` to a later non-execute readiness state only.
- Credential material must stay in the configured local credential backend and must never be stored in SQLite.

## Execution Modes

Allowed in the first implementation:

- `requirements_only`
- `manual`
- `dry_run`

Reserved for a later separately approved implementation:

- `execute`

The first implementation must never return an executable candidate.

## Readiness States

The emergency action model uses readiness states that explain why execution is unavailable:

- `not_supported`
- `planned`
- `missing_emergency_credential`
- `requires_confirmation`
- `dry_run_ready`
- `manual_ready`

The first implementation must not return `execute_ready`.

## Safe Candidate Kinds

The first implementation may show:

- manual runbook;
- provider console link;
- credential recovery guidance;
- sync or live refresh guidance;
- notification escalation guidance.

It may describe future destructive candidates only as planned requirements. It must not render destructive execution buttons.

## Two-Step Confirmation Requirements

Execution remains disabled in this spec, but any future execution must require:

- local request;
- valid local session;
- CSRF token;
- separate emergency credential;
- recent dry-run;
- redacted target label and target hash;
- provider name and action phrase typed by the operator;
- audit pre-record;
- recovery guidance acknowledgement.

## Audit Log Requirements

Audit records are local-only and must be sanitized.

Allowed fields:

- provider key;
- action key;
- mode;
- readiness;
- requested timestamp;
- confirmation timestamp when present;
- status;
- reason code;
- redacted target label;
- target hash;
- sanitized result summary;
- sanitized error code;
- `localOnly`;
- `secretsReturned`.

Forbidden fields:

- raw provider response;
- API key or token;
- account ID or project ID in plain text;
- invoice ID;
- email;
- webhook URL;
- raw billing profile;
- local AI prompt text;
- shell command body;
- raw JSONL line;
- local auth file content.

## Provider Coverage

The first implementation covers available providers and local AI providers with safe guidance only.

- AWS: Cost Explorer review, Budgets review, top-service cost runbook, AWS profile recovery.
- OpenAI: usage/cost dashboard review, admin key validation guidance, manual key rotation runbook.
- Supabase: usage/health review, PAT or OAuth recovery guidance, project usage runbook.
- Cloudflare: billing/usage review, token permission guidance, Workers/Pages/Zone usage runbook.
- Codex CLI/App: local quota and log visibility runbook without exposing prompts, commands, auth files, or raw JSONL.
- Claude CLI/App: local quota and log visibility runbook without exposing prompts, commands, auth files, or raw JSONL.
- Antigravity: local app usage visibility runbook without exposing local app data contents.

Planned catalog providers may show `planned` or `not_supported` readiness only.

## Completion Criteria

The v0.2 preparedness implementation is complete when:

- every emergency candidate has `executeEnabled: false`;
- provider write actions remain disabled globally;
- service UI has no destructive execution buttons;
- dry-run, if present, is local-only and does not call provider write APIs;
- audit records are sanitized;
- tests assert secret-safety and disabled execution;
- documentation states that provider write execution is not included.
