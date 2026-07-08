---
name: Provider connector issue
about: Report a provider sync, fixture, or normalization issue without sharing secrets
title: "provider: "
labels: provider
---

## Safety reminder

Do not include API keys, OAuth tokens, webhook URLs, AWS account IDs, OpenAI organization IDs, Supabase project refs, Cloudflare account IDs, invoice IDs, emails, raw provider responses, screenshots containing real billing data, local prompt text, shell command bodies, raw JSONL lines, or local AI auth files.

Use fake, synthetic, or heavily redacted data only.

## Provider

Choose one:

- [ ] OpenAI Usage/Costs
- [ ] AWS Cost Explorer
- [ ] Supabase
- [ ] Cloudflare
- [ ] Codex CLI
- [ ] Claude CLI
- [ ] Other:

## Area

- [ ] Auth/setup
- [ ] Fixture sync
- [ ] Live sync
- [ ] Normalization
- [ ] SQLite snapshot
- [ ] Dashboard display
- [ ] Report/notification
- [ ] Docs

## Problem

Describe the issue using fake or redacted data.

## Expected behavior

Describe what should happen.

## Sanitized example

```json
{
  "fake": true,
  "provider": "example",
  "note": "Replace this with synthetic data only."
}
```

## Validation already run

- [ ] `npm run secret:scan`
- [ ] Provider fixture test
- [ ] Not applicable
