# MoneySiren Demo Scenarios

These scenarios help reviewers understand MoneySiren with fake or local-only data first. Do not paste or commit real credentials, account IDs, project IDs, invoice IDs, webhook URLs, local prompt text, shell command bodies, raw JSONL lines, auth file contents, or raw provider payloads.

## Scenario 1: First Five Minutes

Goal: show the product without credentials.

```bash
npm install -g @moneysiren/app
msiren sync --provider mock
msiren start
```

Review:

- dashboard overview;
- cost services table;
- usage services table;
- connection diagnostics;
- notification and HUD preferences.

Expected safety boundary: only fake local snapshots are created.

## Scenario 2: OpenAI Cost Risk

Goal: explain why an OpenAI Admin API key is needed for real usage/cost reads, while avoiding any live key in the demo.

Credential-free path:

```bash
MONEYSIREN_OPENAI_USAGE_FIXTURE=tests/fixtures/providers/openai/usage-costs.json \
MONEYSIREN_OPENAI_COSTS_FIXTURE=tests/fixtures/providers/openai/usage-costs.json \
  pnpm --filter moneysiren dev -- sync --provider openai
```

Review:

- OpenAI appears as a cost service;
- normalized usage and cost snapshots are shown;
- raw fixture payloads are not persisted as dashboard JSON;
- diagnostics should not ask for a hosted MoneySiren account.

Real provider path: set `OPENAI_ADMIN_KEY` in the same shell that runs MoneySiren or save it as a local read-only credential. Do not put the key in issues, docs, screenshots, or fixtures.

## Scenario 3: Codex Local Usage

Goal: show local AI usage visibility without exposing prompts or logs.

Review:

- Codex App and Codex CLI collapse into one visible Codex row when either surface is healthy;
- an inactive secondary surface must not degrade the primary surface health/risk;
- only sanitized usage/quota metadata is shown;
- prompt text, assistant text, tool input, shell command bodies, and raw JSONL lines are not exposed.

If the row looks wrong, include the MoneySiren version and sanitized `/api/operations-dashboard` status shape in the issue. Do not include raw local logs.

## Scenario 4: AWS Spend Review

Goal: show read-only cloud cost visibility.

Credential-free path:

```bash
MONEYSIREN_AWS_COST_EXPLORER_FIXTURE=tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json \
  pnpm --filter moneysiren dev -- sync --provider aws
```

Real provider path:

```bash
aws sso login --profile <profile-name>
$env:AWS_PROFILE = "<profile-name>"
msiren sync --provider aws
```

Expected safety boundary: MoneySiren reads Cost Explorer data only. It does not stop instances, change budgets, or modify AWS resources.

## Scenario 5: Emergency Readiness

Goal: show what MoneySiren does during a cost or quota incident.

Review:

- readiness state;
- official provider links;
- manual checklist;
- local audit records for dry-run/readiness flow.

MoneySiren must not execute emergency provider write actions. It does not stop AWS resources, disable Cloudflare Workers, revoke OpenAI keys, pause Supabase projects, or add execution buttons.
