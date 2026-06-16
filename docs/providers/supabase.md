# Supabase Provider

## M6/S6 Scope

Collect Supabase project usage and project health/status signals where available through the Management API.

The CLI supports fake fixture mode for local review and a read-only live Management API path when `SUPABASE_ACCESS_TOKEN` is configured in the invoking environment.

## Credentials

Use env-only secrets in the invoking shell or process environment. Do not create `.env`, commit credentials, or store the token in MoneySiren.

```text
# FAKE EXAMPLE ONLY. Do not use or commit real tokens.
SUPABASE_ACCESS_TOKEN=sbp_fake_supabase_access_token_for_docs
```

## Fixture Mode

CLI fixture mode uses fake local JSON payloads and does not require credentials. When `MONEYSIREN_SUPABASE_FIXTURE` is set, it takes precedence over live sync.

```text
# FAKE EXAMPLE ONLY. Local test fixture path only.
MONEYSIREN_SUPABASE_FIXTURE=tests/fixtures/providers/supabase/usage-health.json
```

Fixture payloads must use fake project refs, fake organization IDs, and fake usage values only. Do not copy provider exports that include real project IDs, account IDs, invoice IDs, emails, billing profiles, card data, or access tokens.

## Read-only Management API Guidance

Allowed Management API behavior for the connector:

- read project lists.
- read per-project usage or analytics counters where available.
- read project health/status where available.
- treat unavailable or plan-restricted surfaces as alerts.

The connector must not call mutation endpoints, create or modify projects, change billing settings, rotate credentials, or write back to Supabase. Any live client path must use read-only request methods only.

## Expected Data

- project list metadata after identifier redaction.
- project status/health snapshots.
- usage counters where available.
- addon or billing-related metadata only after normalization and redaction.
- alerts for unavailable API surfaces.

## Data Handling

Project IDs, project refs, and organization IDs must be redacted or hashed before persistence. Raw Management API responses, raw project payloads, raw billing profiles, and provider payload dumps must not be stored.

Persist normalized MoneySiren snapshots only. Do not persist `SUPABASE_ACCESS_TOKEN`, fixture paths containing secrets, real project refs, real organization IDs, invoice IDs, emails, card data, or telemetry.

## Risks

- Some billing/usage surfaces may be limited or plan-dependent.
- API responses can include project identifiers and metadata.
- Usage may not map directly to final invoices.
- Management API rate limits may affect live sync, especially project analytics endpoints.
