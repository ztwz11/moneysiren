# Data We Never Store

MoneySiren is local-first, but local-first is not enough by itself. The project also defines data that must never be stored in SQLite, fixtures, screenshots, dashboard JSON, reports, Slack payloads, logs, or tests.

## MoneySiren Must Not Store

- API keys
- OAuth tokens
- Slack webhook URLs
- raw provider payloads
- raw billing profiles
- account IDs in plain text
- project IDs in plain text
- invoice IDs
- emails
- local AI prompt text
- assistant text from local AI logs
- tool input from local AI logs
- shell command bodies
- raw JSONL log lines
- auth file contents
- private keys or signing certificates

## MoneySiren May Store

- normalized usage snapshots
- normalized billing snapshots
- normalized service health snapshots
- normalized cost estimates
- redacted provider references
- local sync timestamps
- sanitized audit records
- non-secret provider names
- local display preferences
- local notification threshold settings
- sanitized local AI usage metadata such as counts, percentages, timestamps, model names, and reset windows

## Fixture Rule

Fixtures must be fake, synthetic, or clearly redacted. A fixture should be useful for parser and dashboard review without containing real provider identifiers, raw billing profiles, user emails, prompts, commands, or auth material.

## Issue and PR Rule

Public issues and pull requests must use fake or redacted examples only. If a bug requires sensitive context, use the private security reporting path in [SECURITY.md](../SECURITY.md).
