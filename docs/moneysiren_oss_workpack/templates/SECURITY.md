# Security Policy

## Supported versions

MoneySiren is currently pre-1.0. Security fixes are prioritized on the default branch.

## Security model

MoneySiren is local-first. It reads provider usage and cost data using read-only credentials and stores normalized snapshots locally.

MoneySiren must not store credential material in SQLite.

MoneySiren must not persist raw provider payloads.

MoneySiren must not expose secrets in:

- browser localStorage/sessionStorage/readable cookies
- dashboard JSON
- reports
- Slack payloads
- logs
- fixtures
- test snapshots
- screenshots

## Sensitive data

Do not share the following in public issues or pull requests:

- API keys
- OAuth tokens
- webhook URLs
- AWS account IDs
- OpenAI organization IDs
- Supabase project refs
- Cloudflare account IDs
- invoice IDs
- card data
- billing profile data
- email addresses
- local prompt text
- raw provider responses

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue with exploit details or secrets.

Include:

- affected version or commit
- affected provider or package
- reproduction steps using fake/synthetic data
- expected impact
- suggested fix if available

## Local AI CLI privacy

Codex CLI and Claude CLI logs may contain prompt text, tool input, shell commands, and local file context. MoneySiren should only collect sanitized usage metadata such as token counts, quota percentages, reset times, model names, and timestamps.
