# Emergency Actions Threat Model

```text
SPEC_LOCKED: YES
PROVIDER_WRITE_EXECUTION_ALLOWED: NO
```

## Assets

Protected assets:

- provider credentials and emergency credentials;
- local SQLite data;
- provider account, project, invoice, and billing identifiers;
- local AI prompt text, shell command bodies, auth files, and raw logs;
- Slack webhook URLs;
- local session and CSRF tokens.

## Trust Boundaries

MoneySiren emergency actions cross these boundaries:

- browser UI to local Next.js API;
- local API to SQLite;
- local API to credential backend;
- future provider adapters to external provider APIs.

The first implementation must not cross from local API to provider write APIs.

## Threats and Controls

| Threat | Control |
|---|---|
| Read-only credential reused for destructive action | Model separates read-only and emergency scopes; tests assert no sync path uses emergency scope. |
| Emergency credential makes execution available accidentally | Global `providerWriteActionsEnabled` remains false; candidates keep `executeEnabled: false`. |
| UI presents a destructive action as clickable | Only requirements, runbook, provider console, and checklist commands are allowed. |
| Dry-run leaks credential or target identifiers | Dry-run response is local-only, sanitized, and returns `secretsReturned: false`. |
| Audit log stores raw provider payloads | Audit schema allows redacted labels and hashes only. |
| Local AI prompts or shell commands leak through emergency guidance | Local AI runbooks can reference metadata and paths only at a high level; raw log lines and command bodies are forbidden. |
| CSRF or non-local caller triggers dry-run | Dry-run requires `requireLocalSession`, localhost, and CSRF. |
| Future provider write adapter lacks recovery plan | Provider-specific locked spec must include recovery guidance before execution is allowed. |

## Abuse Cases

### Browser Origin Abuse

A non-local site attempts to call the emergency dry-run API.

Required behavior: reject through local host, origin, referer, session, and CSRF checks.

### Credential Scope Confusion

A read-only provider credential exists and a critical state is detected.

Required behavior: show manual requirements only. Do not treat read-only credentials as emergency credentials.

### Target Identifier Leakage

A future emergency target includes an account ID, project ID, invoice ID, or email.

Required behavior: store a redacted target label and a hash only. Do not return the raw identifier to dashboard JSON.

### Local AI Log Leakage

A local AI provider is critical because quota is near a limit.

Required behavior: show quota and configuration guidance only. Do not show prompt text, shell command bodies, raw JSONL, auth files, or full local file contents.

## Required Tests

Implementation slices must include tests for:

- disabled execution on every candidate;
- secret-safe serialized model output;
- critical provider candidate generation;
- healthy low-risk provider candidate suppression;
- credential recovery candidate generation;
- local-only dry-run security when dry-run API is added;
- audit log redaction when audit storage is added.

## Residual Risk

The first implementation improves operator readiness but cannot stop provider spend directly. That limitation is intentional until write adapters receive provider-specific review and recovery controls.
