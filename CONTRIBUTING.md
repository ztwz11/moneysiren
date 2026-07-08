# Contributing to MoneySiren

Thank you for helping improve MoneySiren.

MoneySiren is a local-first AI/cloud/SaaS usage, cost, and risk dashboard for open-source maintainers, individual developers, and small teams. Because it touches billing context, provider metadata, and local AI CLI usage signals, contributions must avoid exposing secrets or raw provider data.

## Good First Contributions

Good first contributions include:

- improving install docs;
- fixing UI copy;
- improving Korean or English documentation;
- adding fake fixture examples;
- adding parser tests with synthetic data;
- improving dashboard empty states;
- improving local review instructions;
- improving release notes;
- adding troubleshooting notes for Windows or macOS.

See [docs/good-first-issues.md](docs/good-first-issues.md) for a maintained list of safe starter areas.

## Development Principles

- Keep changes small and reviewable.
- Preserve the TypeScript monorepo structure.
- Keep provider connectors read-only.
- Do not persist raw provider payloads.
- Do not expose secrets in logs, reports, browser JSON, fixtures, or test snapshots.
- Keep fixture mode working.
- Consider Windows local execution.

## Do Not Include Sensitive Data

Do not include any of the following in issues, pull requests, fixtures, screenshots, docs, logs, or tests:

- API keys.
- OAuth tokens.
- Webhook URLs.
- AWS account IDs.
- OpenAI organization IDs.
- Supabase project refs.
- Cloudflare account IDs.
- Invoice IDs.
- Card data.
- Billing profile data.
- Email addresses.
- Local prompt text.
- Shell command bodies.
- Raw JSONL log lines.
- Shell history.
- Raw provider responses.
- Codex or Claude auth files.

Use fake or synthetic examples only.

## Setup

```bash
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install
```

Run a fixture-backed local review:

```bash
pnpm --filter moneysiren dev -- init
pnpm --filter moneysiren dev -- sync --provider mock
npm run dev:web
```

## Verification

Run these before opening a pull request:

```bash
git diff --check
npm run typecheck
npm run test
npm run build
npm run secret:scan
```

For release-related or public-review changes, also run:

```bash
npm run secret:scan:all
```

## Security-Sensitive Changes

If your change touches credentials, provider connectors, reports, local logs, Slack webhooks, browser API routes, local AI CLI usage parsing, desktop notifications, or release signing, include a `Security impact` section in the pull request.

## Pull Request Checklist

Before opening a pull request, confirm:

- [ ] I used fake or synthetic data only.
- [ ] I did not commit secrets, local auth files, raw provider responses, or real billing data.
- [ ] I did not add screenshots containing real provider or local AI CLI data.
- [ ] I ran `pnpm test` or explained why it could not be run.
- [ ] I ran `pnpm typecheck` or explained why it could not be run.
- [ ] I ran `npm run secret:scan`.
- [ ] I updated docs where needed.

## Provider Connector Rules

- Use read-only APIs only.
- Normalize data before storage.
- Do not store raw provider responses.
- Add fixture tests with synthetic data.
- Handle rate limits and partial failures.
- Mark provisional data clearly.
- Document auth scope, redaction behavior, normalized output, and persistence boundaries.

## Local AI CLI Rules

Codex CLI and Claude CLI usage is local subscription or local tool usage estimation. It must not be mixed with API billing.

Never expose:

- prompt text;
- assistant text;
- tool input;
- shell command body;
- raw JSONL lines;
- local file content.

Allowed outputs are counts, percentages, timestamps, model names, and sanitized metadata.

## Reporting Security Issues

Please do not open a public issue with exploit details or sensitive information. Follow the guidance in [SECURITY.md](SECURITY.md).
