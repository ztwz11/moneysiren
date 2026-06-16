# OpenAI Provider

## v0.1 Scope

Collect normalized OpenAI usage and cost snapshots for the local MoneySiren dashboard.

The CLI supports fake fixture mode for local review and a read-only live Usage/Costs path when `OPENAI_ADMIN_KEY` is configured in the invoking environment.

## Verification

- `verified_at`: 2026-06-05
- Official API reference checked:
  - `https://platform.openai.com/docs/api-reference/usage`
  - `https://platform.openai.com/docs/api-reference/administration`
- Endpoints used by the injectable client:
  - `GET /v1/organization/usage/completions`
  - `GET /v1/organization/costs`
- Request shape:
  - `start_time`
  - `end_time`
  - `bucket_width=1d`
  - `group_by=model` for usage
  - `group_by=line_item` for costs
- Response fields normalized:
  - Usage: `model`, `input_tokens`, `output_tokens`, `num_model_requests`
  - Costs: `amount.currency`, `amount.value`, bucket `start_time`, bucket `end_time`

## Credentials

Live usage/cost access requires an OpenAI admin key with organization-level access where supported by the current API.

```text
# FAKE EXAMPLE ONLY. Do not commit real keys.
OPENAI_ADMIN_KEY=sk-admin-fake-moneysiren-example-do-not-use
```

Do not store the key in MoneySiren. v0.1 uses env-only secrets.

## Fixture Mode

CLI fixture mode uses fake local JSON payloads and does not require credentials. When fixture env vars are set, they take precedence over live sync.

```text
# FAKE EXAMPLE ONLY. Local test fixture paths only.
MONEYSIREN_OPENAI_USAGE_FIXTURE=tests/fixtures/providers/openai/usage-costs.json
MONEYSIREN_OPENAI_COSTS_FIXTURE=tests/fixtures/providers/openai/usage-costs.json
```

The fixture loader accepts either section-specific payloads or a combined fake payload with top-level `usage` and `costs` fields.

## Data Handling

Persist normalized snapshots only:

- usage snapshots by service and metric
- billing snapshots by period and currency
- cost estimates by period and currency

Do not persist raw OpenAI payloads, API keys, account IDs, project IDs, user IDs, API key IDs, invoice IDs, billing profiles, or email addresses.

## Known Limitations

- Live Usage/Costs access depends on organization/admin key permissions and current OpenAI API availability.
- Usage and costs may not reconcile exactly because they are separate provider surfaces.
- Costs are treated as estimated snapshots in v0.1.
- Additional OpenAI usage surfaces beyond completions are out of scope for this minimal M5 slice.
