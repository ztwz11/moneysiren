# Codex Measurement v2

Status: APPROVED CONTRACT FOR v0.1.6 IMPLEMENTATION  
Security review required for transport, local-session parsing, and route changes  
Verified against official Codex App Server documentation: 2026-07-10

## Purpose

This contract separates official ChatGPT/Codex account signals from local,
sanitized model-usage estimates. It replaces the undocumented reset-credit HTTP
integration and direct Codex auth-file access.

It does not turn Codex subscription activity into OpenAI Platform billing, and
it does not authorize persistence or exposure of raw local AI logs.

## Source precedence

### Rate limits and reset credits

1. Codex App Server account/rateLimits/read.
2. Last known safe normalized App Server snapshot, marked stale.
3. Unavailable.

MoneySiren must not fall back to chatgpt.com backend-api endpoints, direct
auth.json parsing, browser tokens, or user-entered account IDs.

The App Server availableCount field is authoritative. The credits detail array
may be null or capped. MoneySiren must not replace the count with detail length,
fabricate missing rows, or estimate an expiry for an unavailable detail row.

### Account token activity

1. Codex App Server account/usage/read.
2. Unavailable.

The official response provides account summary and daily buckets. It is not a
model, input/output, or billing breakdown.

### Model and token breakdown

1. Sanitized numeric metadata from supported local Codex session schemas.
2. Unavailable.

This is always a local estimate. If eligible files are not all scanned or an
unknown schema is skipped, accuracy is bounded.

### OpenAI Platform usage and costs

OpenAI organization Usage and Costs APIs remain separate provider sources.
Provider-reported cost is authoritative. Codex subscription credits and API
dollars must never be summed or presented as the same unit.

## Accuracy values

| Value | Meaning |
|---|---|
| official | Returned by a documented provider interface and normalized without estimation |
| estimated | Derived from a complete supported local metadata corpus |
| bounded | Derived from a truncated or partly unsupported local metadata corpus |
| unavailable | No safe supported source is available |

Every displayed non-official number includes source, collected time, and
accuracy.

## GPT-5.6 model identity

Canonical IDs:

- gpt-5.6-sol
- gpt-5.6-terra
- gpt-5.6-luna

Alias rule:

- gpt-5.6 normalizes to gpt-5.6-sol.

The safe original model label may be retained for diagnostics when it matches a
strict model-label character and length policy. Unknown models remain unknown
and never receive a guessed rate.

## Token semantics

The normalized model bucket keeps:

- input tokens;
- cached input/read tokens;
- cache creation/write tokens when independently available;
- output tokens;
- reasoning tokens when independently available;
- explicit total tokens;
- request count.

Rules:

1. An explicit total is a total or validation value, not an additional
   component.
2. Cached input is not added again if it is already included in input.
3. Reasoning is not added again if it is already included in output.
4. A cumulative session total is not treated as a new incremental event.
5. Duplicate supported records count once.
6. Unknown relationships remain null or bounded rather than guessed.

## Credit estimates

The official OpenAI Help Center and Codex pricing pages showed conflicting
GPT-5.6 credit values at the contract verification time. Therefore v0.1.6 must
not hard-code or display a calculated Codex credit amount unless a maintainer
records:

- the authoritative source URL;
- verification timestamp;
- effective workspace/plan scope;
- a versioned rate-card identifier;
- fixtures and tests for the selected values.

Official quota percentages and provider-reported reset-credit counts continue to
display even while calculated credit estimates are unavailable.

Fast mode, plan-specific pools, and long-context API multipliers must not be
applied to Codex subscription usage unless the provider source explicitly
returns the required semantics.

## Proposed response model

    interface CodexMeasurementSummary {
      schemaVersion: 2;
      observedAt: string;
      sources: {
        rateLimits: "codex-app-server" | "stale-cache" | "unavailable";
        accountUsage: "codex-app-server" | "unavailable";
        modelBreakdown: "sanitized-session-metadata" | "unavailable";
      };
      rateLimits: CodexRateLimitSummary | null;
      resetCredits: CodexResetCreditSummary | null;
      accountUsage: CodexAccountUsage | null;
      models: readonly CodexModelUsage[];
      coverage: LocalUsageCoverage;
    }

Existing aggregate and top-model fields may be derived from this model for one
compatibility release. New consumers use schemaVersion 2 fields.

## Coverage

Local model estimates expose:

- eligible file count;
- scanned file count;
- parsed record count;
- duplicate record count;
- malformed record count;
- unknown schema count;
- truncated state.

Coverage must not expose session identifiers, complete paths, file names, raw
lines, prompts, responses, tool input, or commands.

## Failure behavior

- App Server missing: official fields unavailable; safe local model estimate may
  remain available.
- App Server timeout or malformed response: retain last normalized official
  snapshot as stale when available.
- Unsupported usage method: account usage unavailable; rate limits may remain.
- Local schema drift: skip unsafe records, increment coverage counters, and mark
  bounded.
- All errors are normalized codes with short remediation. Raw stdout, stderr,
  JSON-RPC envelopes, auth data, and local log content are not returned or
  logged.

## Persistence

Allowed:

- normalized quota percentages and reset timestamps;
- authoritative reset-credit count;
- allowlisted reset-credit detail timestamps/status;
- numeric daily/account token summaries;
- numeric per-model estimates;
- coverage counts, accuracy, source, and freshness;
- sanitized error codes.

Forbidden:

- App Server raw responses;
- raw JSONL or raw lines;
- prompt or assistant content;
- tool input or shell commands;
- auth files and token fields;
- account IDs and session IDs;
- full local paths.

## UI contract

Service detail:

- official rate-limit and reset-credit sections;
- official account token activity;
- separately labeled local model estimates;
- Sol, Terra, and Luna token components;
- coverage and freshness warnings.

HUD:

- keep compact quota/reset values;
- place model, source, and coverage details in a popover or service detail;
- never add a credit estimate while source status is unavailable.

## Fixture policy

Fixtures are minimal synthetic records authored from public field descriptions.
They must not be copied from a real account. Fake opaque IDs are clearly marked
FAKE. Tests must assert the absence of prompt, response, command, token, account,
path, and raw-payload fields.

## Acceptance tests

- availableCount greater than detail length is preserved;
- null details and empty details have distinct supported meanings;
- exact detail is not overwritten by an observation estimate;
- gpt-5.6 and gpt-5.6-sol share one canonical bucket;
- Sol, Terra, and Luna remain separate;
- component plus explicit total is not double-counted;
- cumulative and duplicate records are not added repeatedly;
- truncated coverage is bounded;
- App Server failure does not erase a safe local model estimate;
- no raw/auth/content field reaches API, log, fixture snapshot, or UI;
- Codex credits and API dollars remain different metrics.
