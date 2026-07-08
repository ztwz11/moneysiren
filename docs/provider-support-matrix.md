# Provider Support Matrix

This matrix reflects the current local product model. Do not upgrade a provider's status in docs unless the code, tests, and README support it.

| Provider | Status | Data | Auth | Notes |
|---|---|---|---|---|
| Mock | available | fake usage/cost/health review data | none | Fast credential-free demo path. |
| OpenAI | available | usage/cost | Admin API key or local read-only credential | The server process must see `OPENAI_ADMIN_KEY` or a saved local credential. |
| Codex App/CLI | available, local-only | local usage/quota metadata | local app/CLI metadata | Prompt text, shell command bodies, raw JSONL lines, and auth file contents are not exposed. |
| Claude CLI | available, local-only | local usage/status metadata | local CLI/status metadata | Usage-only surface; not API billing. |
| AWS | available | Cost Explorer cost, usage, forecast | `AWS_PROFILE` or SDK credential chain | Read-only Cost Explorer access. |
| Supabase | available for fixture/read-only usage-health review | usage and health | access token or OAuth read scopes | Usage/health model, not provider billing in v0.1; no write actions. |
| Cloudflare | available for fixture/account-dependent billing-usage review | billing, usage, health | API token and account IDs | Billing surfaces depend on account/API availability; no write actions. |
| GCP | planned/local setup only | connection readiness | gcloud/ADC setup | Not a v0.1 sync connector. |
| Vercel, GitHub Actions, Anthropic API, Railway, Fly.io and other catalog entries | planned or research | connection readiness only | provider-specific | Do not describe as available sync connectors yet. |

## Read-Only Rule

Available means MoneySiren can model or read the stated surface locally. It does not mean MoneySiren can or should modify provider resources.

## Local AI Rule

Local AI surfaces are usage visibility features. They must not expose raw local logs, prompts, assistant text, tool input, shell command bodies, or auth files.
