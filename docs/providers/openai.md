# OpenAI Provider

## v0.1 Scope

Collect OpenAI usage and cost snapshots where supported by current official APIs.

## Credentials

```text
OPENAI_ADMIN_KEY=
```

Do not store the key in StackSpend.

## Required Verification

Before implementation, verify the current official OpenAI Usage/Costs API documentation and record:

- `verified_at`
- endpoint names
- required permissions
- response fields used
- known limitations

## Data Handling

Persist normalized usage/cost snapshots only. Redact project IDs, user IDs, organization IDs, and any provider-specific identifiers before storage.

## Risks

- API surface may change.
- Admin-level permissions may be required.
- Cost attribution may differ from invoices.
