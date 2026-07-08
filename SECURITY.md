# Security Policy

## Supported Versions

MoneySiren is currently pre-1.0. Security fixes are prioritized on the default branch.

## Security Model

MoneySiren is local-first. It reads provider usage and cost data using read-only credentials and stores normalized snapshots locally.

MoneySiren must not store credential material in SQLite.

MoneySiren must not persist raw provider payloads.

MoneySiren must not expose secrets in:

- browser localStorage, sessionStorage, or readable cookies
- dashboard JSON
- reports
- Slack payloads
- logs
- fixtures
- test snapshots
- screenshots

## Sensitive Data

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
- shell command bodies
- raw JSONL log lines
- raw provider responses
- local AI auth files

## Public Repository Safeguards

The public repository is expected to contain source code, docs, fake fixtures, and generated mock screenshots only.

Before pushing changes, run:

```bash
npm run secret:scan
```

Before publishing or reviewing a public branch, run the full current-tree plus Git history scan:

```bash
npm run secret:scan:all
```

GitHub Actions also runs the full secret scan with `fetch-depth: 0` so deleted secrets in earlier commits are checked, not just the latest checkout.

The scanner is intentionally conservative for MoneySiren's threat model. It blocks common provider tokens, Slack webhooks, GitHub tokens, Supabase PAT-style tokens, private key blocks, committed environment files, local SQLite databases, local runtime files, logs, and private key/certificate material. Fake examples must be clearly labeled with terms such as `fake`, `fixture`, `example`, `dummy`, or `do-not-use`.

GitHub Dependabot is configured for npm and GitHub Actions updates. Keep GitHub Secret Scanning and Push Protection enabled for the repository when available.

## Reporting a Vulnerability

Please report security issues privately. Do not open a public issue with exploit details or secrets.

Include:

- affected version or commit
- affected provider or package
- reproduction steps using fake or synthetic data
- expected impact
- suggested fix if available

## Local AI CLI Privacy

Codex CLI and Claude CLI logs may contain prompt text, tool input, shell commands, and local file context. MoneySiren should only collect sanitized usage metadata such as token counts, quota percentages, reset times, model names, and timestamps.
