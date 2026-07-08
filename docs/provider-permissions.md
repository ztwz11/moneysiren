# Provider Permissions

MoneySiren connectors are read-only. Do not add provider write APIs, hosted credential upload, or emergency execution flows.

| Provider | Purpose | Minimum access | Write access used? | Notes |
|---|---|---|---:|---|
| OpenAI | Usage/cost read | Organization Admin API key for usage and cost surfaces | No | The MoneySiren process must see `OPENAI_ADMIN_KEY` or a local read-only credential. |
| AWS | Cost Explorer read | AWS profile, IAM Identity Center, or SDK credential chain with Cost Explorer read permissions | No | Cost Explorer permissions such as cost and usage reads are enough for the current connector. |
| Supabase | Project usage/health read | Supabase access token or OAuth read scopes for Management API usage/health data | No | MoneySiren models Supabase as usage/health, not billing. |
| Cloudflare | Billing/usage read | API token with account billing/usage read access where available | No | Some billing surfaces can be restricted by account capability. |
| Codex App/CLI | Local usage/quota metadata | Local app/CLI metadata and session status files | No | Prompt text, shell command bodies, raw JSONL lines, and auth files must not be exposed. |
| Claude CLI | Local usage/status metadata | Local CLI/statusline/log metadata where available | No | Treat raw local logs as sensitive. |

## Connector Requirements

New or changed connectors must document:

- provider name;
- auth mechanism;
- minimum required scope;
- read-only guarantee;
- fixture source and redaction rules;
- normalized output schema;
- persistence boundaries;
- dashboard/report exposure boundaries.

## Emergency Readiness Boundary

Emergency readiness uses local planning state, official provider links, and manual checklists. It must not call provider write APIs or reuse read-only credentials for write actions.
