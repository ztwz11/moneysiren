# Supabase Provider

## v0.1 Scope

Collect Supabase project usage and project health/status signals where available through the Management API.

## Credentials

```text
SUPABASE_ACCESS_TOKEN=
```

Do not store the token in StackSpend.

## Expected Data

- organization/project list
- project status/health
- usage counters where available
- addon/billing-related metadata where available

## Data Handling

Project IDs and organization IDs must be redacted or hashed before persistence. Raw project payloads must not be stored.

## Risks

- Some billing/usage surfaces may be limited or plan-dependent.
- API responses can include project identifiers and metadata.
- Usage may not map directly to final invoices.
