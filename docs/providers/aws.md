# AWS Provider

## v0.1 Scope

Collect AWS Cost Explorer billing snapshots and service-level cost grouping.

## Credentials

Use env-only configuration. AWS does not use a MoneySiren-managed API key. Install AWS CLI v2 locally,
create a read-only profile, then point MoneySiren at that profile.

Recommended v0.1 input:

```text
AWS_PROFILE=moneysiren-readonly-fake
```

The live CLI path uses the AWS SDK default credential chain and Cost Explorer region `us-east-1` by default. `MONEYSIREN_AWS_REGION` can override the region when needed.

Recommended local setup:

```text
aws --version
aws configure sso
aws sso login --profile moneysiren-readonly-fake
```

Then register `AWS_PROFILE` for MoneySiren. The web UI can save this as a Windows user environment variable, or you can run:

```powershell
setx AWS_PROFILE moneysiren-readonly-fake
```

New terminals inherit the saved value. The MoneySiren web UI also updates the current server process after using the save action.

For fixture-only local verification, use a fake Cost Explorer response file:

```text
MONEYSIREN_AWS_COST_EXPLORER_FIXTURE=tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json
```

Do not store AWS credentials in MoneySiren. Do not commit `.env`, account IDs, payer account metadata, invoice IDs, billing profiles, or raw Cost Explorer responses.

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
      "Sid": "MoneySirenCostExplorerReadOnlyFakeExample",
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
