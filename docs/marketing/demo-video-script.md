# MoneySiren Demo Video Script

Goal: two-minute product walkthrough using fake fixture-backed data only.

Do not show real provider dashboards, credentials, account IDs, project IDs, invoice IDs, webhook URLs, raw billing payloads, local AI prompt text, shell command bodies, raw JSONL lines, or auth files.

## 0:00 Problem

AI coding agents and cloud tools move quickly, but usage limits and cost risk are fragmented across providers. Maintainers need visibility without sending secrets or raw billing data to another SaaS.

## 0:20 Install

Show:

```bash
npm install -g @moneysiren/app
msiren --version
msiren doctor
```

Say: MoneySiren is a local-first CLI, dashboard, and HUD.

## 0:40 Mock Demo

Show:

```bash
msiren install --web
msiren sync --provider mock
msiren start
```

Say: this uses fake local review data and requires no provider credentials.

## 1:00 OpenAI, Codex, AWS

Show dashboard areas:

- OpenAI usage/cost as a read-only provider surface;
- Codex App/CLI as sanitized local usage metadata;
- AWS Cost Explorer as read-only cloud cost visibility.

Say: local AI prompt text, shell command bodies, and raw logs are not shown.

## 1:20 Emergency Readiness

Show emergency readiness panel and official provider links.

Say: MoneySiren does not stop resources, revoke keys, pause projects, disable workers, or execute provider write actions.

## 1:40 Local-First Security

Show docs:

- Data we never store;
- Provider permissions;
- Local-first architecture;
- Troubleshooting.

Say: normalized snapshots stay in local SQLite, telemetry is off by default, and connectors are read-only.

## 2:00 GitHub and npm

Show README quickstart, CONTRIBUTING, and good first issues.

Say: contributors can start with docs, fixtures, redaction tests, diagnostics, and provider links.
