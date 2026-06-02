# Cloudflare Provider

## v0.1 Scope

Experimental connector for Cloudflare usage and billing-related data where available.

Verified against Cloudflare public docs on 2026-06-02:

- Cloudflare API reference: billing usage includes `GET /accounts/{account_id}/paygo-usage` and restricted alpha `GET /accounts/{account_id}/billable/usage`.
- Cloudflare billing permissions: billing API endpoints require Account > Billing > Read, or Billing Edit for write operations. StackSpend only needs read.
- Cloudflare API token permissions reference: Billing Read grants read access to billing profile, subscriptions, invoices, and entitlements.

## Credentials

```text
CLOUDFLARE_API_TOKEN=FAKE_CLOUDFLARE_API_TOKEN_DO_NOT_USE
```

Do not store the token in StackSpend.

The M7 CLI implementation is fixture-only for local review. It fails gracefully if neither `CLOUDFLARE_API_TOKEN` nor fixture mode is configured, and it does not make live Cloudflare API calls.

Fixture mode:

```bash
STACKSPEND_CLOUDFLARE_FIXTURE=tests/fixtures/providers/cloudflare/billing-usage.json \
  pnpm --filter @stackspend/cli dev -- sync --provider cloudflare
```

All examples in this repository are fake. Do not commit real Cloudflare account IDs, zone IDs, subscription IDs, billing profile data, invoice IDs, emails, payment details, API tokens, or webhook URLs.

## API Token Guide

Create a custom token in the Cloudflare dashboard:

1. Go to `My Profile > API Tokens`.
2. Select `Create Token`.
3. Use the custom token template.
4. Add `Account > Billing > Read`.
5. Scope the token to the minimum account needed for local review.
6. Store the token only in the shell environment for the command session.

Fake shell example:

```bash
export CLOUDFLARE_API_TOKEN=FAKE_CLOUDFLARE_API_TOKEN_DO_NOT_USE
```

Do not add this token to `.env`; StackSpend v0.1 uses env-only secrets and does not create `.env` files.

## Experimental Status

Cloudflare billing/usage APIs may be alpha, restricted, or account-dependent. The connector must degrade gracefully if APIs are unavailable.

StackSpend treats Cloudflare as experimental and default-off:

- live Cloudflare sync is not enabled in the M7 CLI path
- fixture mode is enabled with `STACKSPEND_CLOUDFLARE_FIXTURE`
- restricted billing usage APIs produce warning alerts and degraded health snapshots
- available billable usage records are normalized into local SQLite snapshots

## Data Handling

Do not persist raw billing profiles, account IDs, zone IDs, subscription payloads, or emails.

Normalized local data only:

- account identifiers become redacted hash refs
- zone IDs and subscription IDs are dropped
- Cloudflare account names, zone names, emails, card data, and billing profile fields are not persisted
- raw provider payloads are not stored
- connector access remains read-only

## Fallback Behavior

If billing usage is restricted:

- record a warning alert
- report connector status as partial
- write normalized degraded health/status data only
- continue syncing any available billable usage or PayGo usage records
- do not fail the entire sync

## Risks

- API availability may vary.
- Billing profile payloads may contain sensitive metadata.
- Cost estimates may not be possible for all accounts.
- Cloudflare v2 billable usage is alpha/restricted and may be unavailable to many accounts.
- Cloudflare Billing Read may expose more billing surfaces than StackSpend stores; keep token scope narrow.

## References

- Cloudflare API Billing reference: https://developers.cloudflare.com/api/resources/billing/
- Cloudflare Billing permissions: https://developers.cloudflare.com/billing/understand/billing-permissions/
- Cloudflare API token permissions: https://developers.cloudflare.com/fundamentals/api/reference/permissions/
