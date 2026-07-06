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
