# AWS Provider

## v0.1 Scope

Collect AWS Cost Explorer billing snapshots and service-level cost grouping.

## Credentials

Use standard AWS SDK credential resolution. Recommended v0.1 input:

```text
AWS_PROFILE=default
```

Do not store AWS credentials in StackSpend.

## Required API Surface

- AWS Cost Explorer read-only APIs.
- Monthly cost grouped by service.
- Current billing period cost.

## Minimum Permission Direction

Use read-only Cost Explorer permissions. Exact IAM policy must be verified before connector implementation.

## Data Handling

Persist normalized billing snapshots only. Do not persist raw AWS Cost Explorer responses, account IDs, or payer account metadata.

## Risks

- Cost Explorer can have delayed data.
- AWS org/payer account setups may affect visibility.
- Currency, credits, taxes, and discounts require careful labeling.
