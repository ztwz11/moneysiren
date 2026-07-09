# Codex Measurement v2 Contract

Status: APPROVED CONTRACT FOR COD-002 THROUGH COD-005  
Schema version: 2  
Last reviewed: 2026-07-10  
Official reference: https://learn.chatgpt.com/docs/app-server

## Purpose

Codex Measurement v2 separates provider-reported ChatGPT/Codex account
measurements from locally estimated model usage.

It answers independently:

1. What quota windows and reset credits does Codex App Server report?
2. What aggregate account token activity does Codex App Server report?
3. What model/token breakdown can MoneySiren estimate from sanitized local
   session metadata?
4. How complete was the local scan?

Official account values and local estimates are never summed into a synthetic
billing or credit total.

## Non-goals

- Calculating OpenAI Platform API dollars.
- Calculating Codex subscription credits from tokens.
- Consuming reset credits.
- Reading Codex auth files.
- Calling undocumented ChatGPT HTTP endpoints.
- Persisting raw App Server envelopes or raw JSONL.
- Reconstructing prompts, responses, commands, tool inputs, or account identity.

## Sources and precedence

| Domain | Source | Accuracy | Fallback |
|---|---|---|---|
| Quota windows | account/rateLimits/read | official | unavailable |
| Reset-credit count/details | account/rateLimits/read | official | unavailable |
| Account token summary/daily buckets | account/usage/read | official | unavailable |
| Model/token breakdown | sanitized local session metadata | estimated or bounded | unavailable |
| Codex subscription credit estimate | none | unavailable | none |

Within account/rateLimits/read, rateLimitsByLimitId.codex takes precedence over
the backward-compatible rateLimits field. The latter is used only when the
codex bucket is absent.

Provider values always outrank local estimates. A failed official read does not
promote local token counts into an official quota value.

## Availability and accuracy

Each domain is a discriminated available or unavailable measurement.

- official: allowlisted values normalized from Codex App Server.
- estimated: a supported local metadata corpus was scanned without a known
  coverage bound, but the result is still not provider billing.
- bounded: file caps, skipped files, unknown schemas, or ambiguous cumulative
  records make the local result incomplete.
- unavailable: no trustworthy safe source exists.

An unavailable result contains a stable reason code and a sanitized message. It
contains no stderr, stdout, JSON-RPC envelope, path, auth data, or upstream body.

Stable unavailable reasons:

- not-installed
- not-authenticated
- unsupported-auth-mode
- unsupported-method
- timeout
- malformed-response
- oversized-response
- no-data
- unknown

## Rate limits

A normalized window contains used percent, duration minutes, and an ISO-8601
reset time. MoneySiren does not infer a token limit.

Non-finite values are rejected. A valid percentage is bounded to 0 through 100.
Missing primary or secondary windows remain null.

## Reset credits

availableCount is authoritative.

The upstream credits field means:

- null: only the count is known;
- empty array: detail retrieval completed with no returned rows;
- shorter array than availableCount: details are partial or capped.

MoneySiren derives:

    detailsComplete =
      credits is not null and credits.length >= availableCount

It does not invent rows, expiry dates, titles, or descriptions.

The upstream credit id is opaque and is omitted from normalized, persisted, API,
and browser output. Consuming a reset credit is outside this read-only contract.

grantedAt and expiresAt become ISO-8601 or null. Unsupported status and reset
types become unknown rather than echoing arbitrary strings.

## Account token activity

account/usage/read is an official aggregate domain. It can provide summary
metrics and optional daily buckets.

It does not provide model, input, cache, output, or reasoning splits. It remains
separate from local model estimates. Null summary fields remain null. Missing
daily buckets remain null; MoneySiren does not manufacture zero days.

## Local model usage

A supported local record is reduced to a sanitized intermediate event before
aggregation. It may contain only:

- a synthetic deduplication key;
- timestamp;
- safe model identifier;
- incremental or cumulative semantics;
- numeric token components;
- request count.

It contains no raw session/request ID, path, prompt, response, command, tool
input, account identifier, or original record.

## Token arithmetic

- Input includes cached input when upstream defines cache as an input subset.
- Cached input is never added again.
- Cache write remains separate only when explicitly observable; otherwise null.
- Reasoning is never added again when it is an output subset.
- Explicit total is the total or validation value, not another component.
- Without an explicit total, total is input plus output.
- Cumulative snapshots are differenced or replaced by a stable sanitized series
  key. Repeated snapshots are not added as new deltas.

Example:

    input=100, cachedInput=40, output=20, reasoning=5, total=120

The total remains 120, not 185.

## Model normalization

Exact mappings:

| Observed safe ID | Canonical ID |
|---|---|
| gpt-5.6 | gpt-5.6-sol |
| gpt-5.6-sol | gpt-5.6-sol |
| gpt-5.6-terra | gpt-5.6-terra |
| gpt-5.6-luna | gpt-5.6-luna |

No fuzzy or prefix match is allowed. A safe model ID matches:

    ^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$

A future safe model stays an unknown model until approved. An invalid value
becomes unknown without echoing the original.

No model receives a Codex credit rate in schema v2. The official rate pages
conflicted at contract review time, and raw tokens are not subscription credits.

## Coverage

Local coverage exposes counts only:

- period start and end;
- eligible and scanned files;
- parsed, duplicate, malformed, and unknown-schema records;
- truncation.

It exposes no filenames or paths.

The result is bounded if eligible files exceed scanned files, truncation is true,
unknown schemas exist, or a cumulative series cannot be safely differenced.

## Freshness and failure

Each domain records fetchedAt or observedAt in ISO-8601 UTC.

A failed attempt returns unavailable. Later freshness work may retain the last
normalized snapshot, but it must mark that snapshot stale and preserve the
failed-attempt time separately.

App Server failure does not erase a safe local model estimate. Local parser
failure does not change an official quota into an estimate.

## Privacy boundary

Forbidden in normalized output, persistence, fixtures, logs, screenshots, and
errors:

- prompt, response, content, text, or message bodies;
- command, command line, shell input, or tool input;
- raw JSONL or JSON-RPC envelopes;
- full paths, home directories, or cwd;
- access/refresh tokens and Authorization headers;
- account, organization, workspace, project, invoice, session, or opaque credit
  IDs;
- emails and auth-file fields.

Input fixtures that exercise upstream normalization may contain only clearly
FAKE opaque IDs, which must disappear from normalized output. Fixtures are
synthetic and never captured from a real installation.

## Compatibility

Schema v2 is additive beside LocalCliUsageSummary while COD-002 and COD-004 are
implemented.

The compatibility facade derives legacy quota fields from official rate limits
and legacy token totals/top models from local estimates. It never relabels an
estimate as official.

## UI

Service detail shows:

- official rate limits and reset-credit count/details;
- official aggregate account token activity;
- separately labeled local model estimates;
- Sol, Terra, and Luna token components;
- coverage and freshness warnings.

HUD remains compact. It keeps quota/reset values inline and moves source, model,
and coverage detail to a popover or service page. Credit estimates remain hidden
while unavailable.

## Acceptance

- availableCount remains authoritative for null, empty, or capped details.
- No synthetic reset-credit row or expiry is produced.
- Opaque credit IDs disappear from normalized output.
- gpt-5.6 and gpt-5.6-sol share one Sol bucket.
- Terra and Luna remain separate.
- Unknown safe models have no rate.
- Unsafe labels become unknown without being echoed.
- Explicit totals and subset components are not double-counted.
- Official account usage and local model usage remain separate objects.
- Truncated coverage is bounded.
- Errors and output pass forbidden-content regression tests.
