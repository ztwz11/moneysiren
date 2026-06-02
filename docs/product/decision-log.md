# StackSpend Decision Log

## D001 — Separate product repository from automation controller

Decision: StackSpend product files live only in the `stackspend` repository. `auto-driver` remains an automation controller.

Reason: avoid mixing reusable workflow tooling with product code and product documentation.

Status: accepted.

## D002 — Local-first storage

Decision: v0.1 uses local SQLite by default.

Reason: users can run StackSpend without hosted infrastructure, and sensitive billing data remains local.

Status: accepted.

## D003 — Env-only secrets for v0.1

Decision: v0.1 reads provider credentials from environment variables only.

Reason: simpler, safer MVP with no secret persistence layer.

Status: accepted.

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
