# MoneySiren Decision Log

## D001 — Separate product repository from automation controller

Decision: MoneySiren product files live only in the `moneysiren` repository. `auto-driver` remains an automation controller.

Reason: avoid mixing reusable workflow tooling with product code and product documentation.

Status: accepted.

## D002 — Local-first storage

Decision: v0.1 uses local SQLite by default.

Reason: users can run MoneySiren without hosted infrastructure, and sensitive billing data remains local.

Status: accepted.

## D003 — Env-only secrets for v0.1

Decision: v0.1 reads provider credentials from environment variables only.

Reason: simpler, safer MVP with no secret persistence layer.

Status: superseded for local web convenience by D012. CLI sync remains env-first.

## D004 — Read-only provider connectors

Decision: all v0.1 provider connectors are read-only.

Reason: minimize blast radius and simplify user trust.

Status: accepted.

## D005 — No raw provider payload persistence

Decision: raw provider responses must be normalized and redacted before persistence.

Reason: billing payloads can contain account IDs, project IDs, invoice IDs, emails, and other sensitive metadata.

Status: accepted.

## D006 — Cloudflare connector is experimental

Decision: Cloudflare billing/usage connector ships behind an experimental designation until API availability is verified.

Reason: Cloudflare usage/billing APIs may be restricted or alpha depending on account and endpoint.

Status: accepted.

## D007 — Korean daily report is first-class

Decision: v0.1 includes a Korean daily report template.

Reason: the primary operator wants readable Korean Slack reports.

Status: accepted.

## D008 - Separate canonical history from live today overlays

Decision: dashboard canonical data is finalized through yesterday, while current-day provider data is fetched as provisional live data and excluded from canonical SQLite snapshot tables.

Reason: users need current visibility without mixing incomplete current-day values into historical records.

Status: accepted.

## D009 - Route-based multilingual web UI

Decision: the web app uses `ko`, `en`, and `ja` path locales with typed dictionaries and route-based dashboard navigation.

Reason: locale-aware routes make bookmarks, refreshes, active navigation, and future docs easier to reason about.

Status: accepted.

## D010 - Sidebar service model

Decision: provider summaries move from a dashboard Providers tab into `Services > All services`, with provider detail pages under `/[locale]/services/[provider]`.

Reason: the dashboard should answer global spend questions, while service pages should support provider-specific operations.

Status: accepted.

## D011 - Provider catalog before broad connector expansion

Decision: MoneySiren shows a broad provider catalog, but only current implemented providers are connectable in this slice.

Reason: connector implementation requires provider-specific auth, normalization, redaction, fixtures, tests, and docs; cataloging planned providers keeps the UI extensible without overstating support.

Status: accepted.

## D012 - Local credential store for convenient connections

Decision: convenient connection flows use a local credential abstraction with OS keychain preferred and an encrypted passphrase vault fallback.

Reason: users want OAuth-like convenience, but credentials must stay local and outside SQLite, logs, API responses, screenshots, and reports.

Status: accepted.

## D013 - Read-only and emergency access separation

Decision: default provider connections are read-only, and future emergency actions require a separate access slot and separate locked spec before implementation.

Reason: destructive provider operations such as key revocation, instance stops, and worker disablement require stronger auth, confirmation, audit, and recovery controls.

Status: accepted.

## D014 - Staged emergency action preparedness

Decision: emergency actions are implemented in stages. The first implementation is requirements-only, manual runbook, and local dry-run readiness. Provider write execution remains disabled until provider-specific specs, a permission matrix, emergency credential validation, audit logging, dry-run behavior, two-step confirmation, and recovery guidance are complete.

Reason: critical spend and credential states need operator guidance, but MoneySiren's default provider connectors must remain read-only and local-first until destructive operations have stronger controls.

Status: accepted.

## D015 - Persist local AI usage as daily numeric buckets

Decision: Codex CLI and Claude CLI history is persisted as sanitized daily
numeric buckets. Weekly and monthly views are derived from those daily rows.
Quota percentages remain live gauges and are not summed as historical tokens.

Reason: the existing local collector returns a mutable current-month aggregate.
Snapshotting that value as if it were a daily delta would misstate usage, while
daily timestamp-based buckets provide idempotent storage and correct week/month
aggregation without retaining raw local logs.

Security boundary: persisted rows contain numeric counters, safe timestamps,
provider/date/timezone keys, source scope, parser version, and local-only metadata
only. Prompt/response text, command bodies, tool input, raw JSONL, source paths,
auth data, credentials, and native IDs remain outside SQLite and API JSON.

Status: accepted.

## D016 - Explicit local OpenAI connection orchestration

Decision: the OpenAI connection form uses one explicit, CSRF-protected local
POST to collect read-only Usage/Costs data, save the submitted Admin API key
through the existing env-only boundary, and persist the already-normalized
collection as canonical SQLite history.

Reason: saving a key and telling the user to run a separate CLI command leaves
the first-value path incomplete. Reusing one successful read-only collection for
validation and persistence avoids a duplicate provider request while preserving
the canonical/live separation.

Failure boundary: a failed collection saves neither the key nor canonical data;
a failed env save writes no canonical data; a failed SQLite write returns a safe
partial result because the env save may already have completed. Provider error
bodies, credentials, raw payloads, identifiers, and paths never enter the API
response.

Scope: OpenAI only. Scheduler work, all-provider sync, live-today refresh,
credential-store multi-connection sync, backup/export, and native notifications
remain separate slices.

Status: accepted.

## D017 - Deterministic installed desktop runtime resolution

Decision: CLI and web HUD launch paths share deterministic desktop application
candidates. Resolution order is an explicit process-owned configuration, fixed
operating-system installation locations, then fixed repository artifacts for
source-checkout execution. Repository discovery is not a prerequisite for a
packaged production launch.

Reason: the standalone web runtime does not contain repository scripts, while
the installed Windows tray lives under `%LOCALAPPDATA%`. Requiring a repository
root made a valid installation appear unavailable and returned HTTP 500.

Security boundary: HTTP input never controls an executable path. Resolved
commands must use an absolute expected MoneySiren executable path, direct spawn
without a shell, and fixed secret-free error responses. A configured but invalid
path fails closed instead of silently launching another executable.

Status: accepted.

## D018 - npm package waits for complete Windows release assets

Decision: the global `@moneysiren/app` postinstall requests both web and HUD
surfaces. The public release workflow must assemble and candidate-smoke matching
web and Windows desktop artifacts before the matching npm package is published.

Rationale: a web-only postinstall leaves the dashboard HUD button dependent on a
manual follow-up command, while independent tag-triggered npm and desktop jobs
can expose an npm version before its runtime assets exist. Ordering the release
and keeping the existing verified release installer produces a retryable,
source-free install without weakening credential or artifact trust boundaries.

Status: accepted.
