# Unified Connect and First Sync Specification

Status: implemented locally for `M13/S13-unified-connect-first-sync` on 2026-07-13.

## User outcome

An operator can submit an OpenAI Admin API key once and receive an honest,
secret-free result for the full first-value path:

```text
validate read-only access -> save env-only credential -> persist canonical data
```

The operator does not need to open a terminal or run `moneysiren sync` for the
first OpenAI history.

## Scope

Included:

- OpenAI Admin API key submitted from the local Connections page;
- read-only Usage and Costs collection;
- a bounded read-only request timeout with abort propagation;
- Windows/user-environment persistence through the existing provider-env helper;
- normalized canonical SQLite persistence;
- a combined in-progress state plus success, invalid-credential, partial,
  unknown-result, and retry states;
- local-session, CSRF, no-store, and safe-response tests.

Excluded:

- AWS, Supabase, Cloudflare, and local AI orchestration;
- background scheduler and retries after the request ends;
- credential-store multi-connection canonical sync;
- live-today refresh, HUD refresh, notifications, backup, restore, and export.

## State contract

```text
idle -> working -> success
working -> invalid_credential
working -> save_failed
working -> partial -> retrying -> success | partial | invalid_credential
working | retrying -> unknown_result
```

The server may perform collection before the environment write so the same
normalized result proves read-only access and supplies the canonical snapshot.
The UI describes the request as validation, saving, and first sync without
inventing intermediate progress that the non-streaming response cannot verify.

## Persistence rules

- Collection status must be `ok` before environment persistence begins.
- Failed collection writes neither environment state nor canonical SQLite data.
- Failed environment persistence writes no canonical SQLite data.
- Canonical persistence receives normalized snapshots only.
- Repeated successful submissions preserve the existing idempotent snapshot
  semantics.

## API response boundary

Allowed fields:

- fixed status and error code;
- generated timestamp;
- provider key;
- numeric usage, billing, health, estimate, and alert counts;
- `credentialSaved`, `canonicalSynced`, `localOnly`, and `secretsReturned` flags.

Forbidden fields:

- submitted key or authorization header;
- raw request/response payloads;
- provider error bodies;
- account, project, invoice, or connection identifiers;
- email addresses;
- filesystem or log paths;
- prompts, responses, tool input, and command bodies.

The initial POST accepts only an OpenAI Admin API key. An authenticated retry
may send an empty object and reuse the already-saved process environment value.

## Acceptance tests

- missing local session or CSRF is rejected;
- malformed or unsupported input is rejected before collection;
- invalid read-only access calls neither env persistence nor SQLite persistence;
- env persistence failure calls no SQLite persistence;
- successful collection is reused for canonical persistence;
- SQLite failure returns a fixed partial result and no exception text;
- response serialization contains none of the forbidden data classes;
- the OpenAI secret input is cleared once the save boundary succeeds;
- a partial result retains a retry action even if the retry response is lost;
- stalled provider requests abort and return a fixed validation failure;
- existing live-today and HUD refresh endpoints are unchanged.
