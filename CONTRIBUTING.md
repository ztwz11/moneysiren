# Contributing to MoneySiren

MoneySiren is a local-first usage, cost, and risk dashboard for individual developers and small teams.

## Development Principles

- Keep changes small and reviewable.
- Preserve the TypeScript monorepo structure.
- Keep provider connectors read-only.
- Do not persist raw provider payloads.
- Do not expose secrets in logs, reports, browser JSON, fixtures, or test snapshots.
- Keep fixture mode working.
- Consider Windows local execution.

## Setup

```bash
pnpm install
pnpm dev
```

## Verification

Run these before opening a pull request:

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

## Security-Sensitive Changes

If your change touches credentials, provider connectors, reports, local logs, Slack webhooks, browser API routes, or local AI CLI usage parsing, include a `Security impact` section in the pull request.

## Provider Connector Rules

- Use read-only APIs only.
- Normalize data before storage.
- Do not store raw provider responses.
- Add fixture tests with synthetic data.
- Handle rate limits and partial failures.
- Mark provisional data clearly.

## Local AI CLI Rules

Codex CLI and Claude CLI usage is local subscription or local tool usage estimation. It must not be mixed with API billing.

Never expose:

- prompt text
- assistant text
- tool input
- shell command body
- raw JSONL lines
- local file content

Allowed outputs are counts, percentages, timestamps, model names, and sanitized metadata.
