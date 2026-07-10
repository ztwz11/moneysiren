# Experimental and Local Integrations

This document defines the boundary for optional local-only MoneySiren integrations. None of them is required for the core provider-sync workflow.

The core workflow remains:

- read-only provider sync;
- fake or redacted fixtures for review;
- normalized local SQLite snapshots;
- local dashboard and HUD views;
- telemetry off by default;
- no persistence of credential material;
- no persistence of raw provider or process payloads.

Optional integrations must not weaken those rules.

## Policy for experimental integrations

An experimental integration must be:

- optional and local-first;
- isolated from hosted demo paths;
- explicit about source, accuracy, coverage, and failure states;
- safe when an upstream schema changes;
- bounded by timeouts and response-size limits;
- conservative about logging and persistence.

It must not:

- accept local provider credentials through browser inputs;
- expose tokens or account identifiers through URLs, logs, screenshots, reports, or issue templates;
- persist raw upstream responses, process streams, or local AI record lines;
- invent values when a source provides only partial detail;
- become required for the main dashboard;
- be the primary application story for OSS support.

When an official local interface exists, a MoneySiren adapter must use that documented interface and keep the provider process in control of authentication.

## Current official local integration

- [Codex App Server rate-limit and account usage](./codex-reset-credits.md)

The Codex integration now launches `codex app-server --listen stdio://` and reads the documented `account/rateLimits/read` and `account/usage/read` methods. It labels normalized results as schema v2 with an official accuracy source.

`availableCount` is authoritative. Supplied reset-credit details may cover only part of that count; `detailsComplete=false` is displayed as partial coverage and missing rows are never synthesized. Official account totals remain separate from local session-derived estimates.

The transport migration does not relax the experimental-integration policy: raw JSON-RPC messages, App Server process output, credential material, account identifiers, prompts, tool input, shell commands, and raw local AI records stay outside persistence and browser output.

## Application positioning note

When describing MoneySiren for open-source support, focus on:

- official OpenAI organization usage and cost sync;
- official local Codex App Server measurements;
- local-first AI and cloud usage observability;
- read-only provider connectors;
- fake fixture-based tests;
- secret scanning;
- Codex-assisted maintenance workflows.

Always distinguish OpenAI Platform organization billing data, official Codex account usage, and local per-model estimates. They have different sources and must not be combined into a single total.
