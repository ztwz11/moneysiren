# AWS Provider

## v0.1 Scope

Collect AWS Cost Explorer billing snapshots and service-level cost grouping.

## Credentials

Use env-only configuration. Recommended v0.1 input:

```text
AWS_PROFILE=stackspend-readonly-fake
```

For fixture-only local verification, use a fake Cost Explorer response file:

```text
STACKSPEND_AWS_COST_EXPLORER_FIXTURE=tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json
```

Do not store AWS credentials in StackSpend. Do not commit `.env`, account IDs, payer account metadata, invoice IDs, billing profiles, or raw Cost Explorer responses.

## Required API Surface

- AWS Cost Explorer read-only APIs.
- Monthly cost grouped by service.
- Current billing period cost.

## Minimum Permission Direction

Use a read-only IAM principal scoped to Cost Explorer. The current v0.1 connector only needs Cost Explorer usage/cost read access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StackSpendCostExplorerReadOnlyFakeExample",
      "Effect": "Allow",
      "Action": ["ce:GetCostAndUsage"],
      "Resource": "*"
    }
  ]
}
```

This example is fake guidance for local setup review. Do not add write actions, billing profile access beyond the connector scope, or provider account identifiers to repository files.

## Data Handling

Persist normalized billing snapshots only. Do not persist raw AWS Cost Explorer responses, account IDs, or payer account metadata.

## Risks

- Cost Explorer can have delayed data.
- AWS org/payer account setups may affect visibility.
- Currency, credits, taxes, and discounts require careful labeling.
