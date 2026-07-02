# MoneySiren and Codex for Open Source

MoneySiren is a local-first open-source observability tool for AI coding agent, cloud, and SaaS usage. It is designed for open-source maintainers, indie developers, and small teams who need to understand AI/cloud usage and cost risk without sending secrets, raw billing data, or local AI logs to a hosted SaaS.

## Problem

AI coding agents make software maintenance faster, but they also introduce new operational risks:

- OpenAI/Codex, Claude CLI, and other AI tools can consume usage limits quickly.
- Maintainers often use multiple providers across OpenAI, AWS, Supabase, Cloudflare, and local AI CLIs.
- Billing data, local AI logs, project identifiers, and CLI session metadata can be sensitive.
- Existing hosted dashboards often require users to upload API keys or raw provider responses.
- Small OSS projects need safe local visibility before they can automate more workflows.

MoneySiren addresses this by keeping provider connectors read-only, normalizing snapshots into local SQLite, and keeping telemetry off by default.

## Current scope

MoneySiren currently supports:

- OpenAI organization usage/cost sync;
- AWS Cost Explorer sync;
- Supabase usage/health fixture sync;
- Cloudflare billing/usage fixture sync;
- local Codex CLI and Claude CLI usage estimates;
- local Next.js dashboard;
- Tauri tray/HUD;
- Korean daily reports and optional Slack webhook delivery.

## Why this matters for open-source maintainers

OSS maintainers increasingly rely on AI agents for triage, documentation, test generation, release notes, PR review, and security checks. As those workflows grow, maintainers need a local, inspectable way to understand:

- usage limits;
- cost risk;
- provider fragmentation;
- secret handling;
- safe fixture-based testing;
- release automation safety.

MoneySiren is intended to become a reusable reference implementation for local-first AI/cloud usage observability.

## How Codex would be used

Codex support would be used for core open-source maintenance work.

### 1. Provider connector maintenance

- Implement and review provider sync changes.
- Generate fixture-backed tests.
- Detect unsafe persistence of raw provider payloads.
- Improve connector error handling and empty states.

### 2. PR review and triage

- Review changes that touch provider auth, billing normalization, local AI CLI parsing, and notification payloads.
- Check that new code follows the local-first security model.
- Identify missing tests or unsafe fixture examples.

### 3. Release workflow hardening

- Review GitHub Actions changes.
- Validate release scripts.
- Improve public release notes and package verification.
- Keep source-free install paths documented and testable.

### 4. Documentation and onboarding

- Keep install docs accurate across Windows and macOS.
- Generate clear issue templates and good-first-issue tasks.
- Document safe local usage patterns for OSS maintainers.
- Improve Korean and English documentation quality.

### 5. Security-focused maintenance

- Identify accidental secret exposure risks.
- Review code paths that touch credentials, local auth files, provider payloads, dashboard JSON, logs, fixtures, and screenshots.
- Add regression tests for redaction and persistence boundaries.

## Requested program benefits

Primary request:

- Six months of ChatGPT Pro with Codex for day-to-day coding, triage, review, documentation, and release workflow maintenance.

Optional request:

- API credits for maintainer automation experiments, especially fixture-backed PR review and release workflow checks.

Conditional request:

- Codex Security access if OpenAI considers MoneySiren's local-first provider connector and secret-handling surface suitable for deeper security review.

## Public outputs

If supported, MoneySiren will publish:

- reusable `AGENTS.md` instructions for local-first AI/cloud observability projects;
- fixture-based provider connector testing patterns;
- secret-safety regression examples;
- documented Codex-assisted maintenance workflows;
- release workflow hardening notes for small OSS maintainers.

## Honest status

MoneySiren is early and actively maintained. It should not be described as a widely used project unless public repository, npm, or release metrics support that claim. The current application story should emphasize relevance, safety, maintenance readiness, and public outputs rather than claiming broad adoption.
