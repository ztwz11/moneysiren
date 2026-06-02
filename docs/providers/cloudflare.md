# Cloudflare Provider

## v0.1 Scope

Experimental connector for Cloudflare usage and billing-related data where available.

## Credentials

```text
CLOUDFLARE_API_TOKEN=
```

Do not store the token in StackSpend.

## Experimental Status

Cloudflare billing/usage APIs may be alpha, restricted, or account-dependent. The connector must degrade gracefully if APIs are unavailable.

## Data Handling

Do not persist raw billing profiles, account IDs, zone IDs, subscription payloads, or emails.

## Fallback Behavior

If billing usage is restricted:

- record a warning alert
- report connector status as partial/restricted
- do not fail the entire sync

## Risks

- API availability may vary.
- Billing profile payloads may contain sensitive metadata.
- Cost estimates may not be possible for all accounts.
