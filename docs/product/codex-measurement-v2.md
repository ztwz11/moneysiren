# Codex Measurement v2 Contract

Status: APPROVED CONTRACT FOR COD-002 THROUGH COD-005  
Schema version: 2  
Last reviewed: 2026-07-10  
Official references:
- https://learn.chatgpt.com/docs/app-server
- https://help.openai.com/en/articles/20001106-codex-rate-card

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
- Treating a local Codex credit estimate as official account spend.
- Estimating credits when the workspace rate card or execution mode is unknown.
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
| Codex subscription credit estimate | dated official rate card × local model tokens | estimated or bounded | unavailable |

Within account/rateLimits/read, rateLimitsByLimitId.codex takes precedence over
the backward-compatible rateLimits field. The latter is used only when the
codex bucket is absent.

Provider values always outrank local estimates. A failed official read does not
promote local token counts into an official quota value.

## App Server transport

MoneySiren starts the official local stdio listener explicitly:

    codex app-server --listen stdio://

The child process is launched without a shell. Stdout is treated as bounded
newline-delimited JSON-RPC, stderr is discarded, and only allowlisted normalized
measurements may leave the transport boundary. The undocumented `--stdio` flag
is not used.

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

No fuzzy or prefix match is allowed. A safe model ID is already trimmed and
lowercase and matches:

    ^[a-z0-9][a-z0-9._:-]{0,79}$

A future safe model stays an unknown model until approved. An invalid value
becomes unknown without echoing the original.

## GPT-5.6 Codex credit estimate

The official Codex rate card was re-verified on 2026-07-10. The dated rates are
credits per one million tokens:

| Model | Input | Cached input | Output |
|---|---:|---:|---:|
| GPT-5.6 Sol | 125 | 12.5 | 750 |
| GPT-5.6 Terra | 62.5 | 6.25 | 375 |
| GPT-5.6 Luna | 25 | 2.5 | 150 |

The estimate source is explicitly
`official-rate-card-x-local-token-estimate`. It is not an App Server account
total, remaining balance, invoice, or official spend observation.

Because local input includes cached input, the calculation is:

    uncachedInput = max(0, input - cachedInput)
    credits =
      uncachedInput * inputRate / 1_000_000 +
      cachedInput * cachedInputRate / 1_000_000 +
      output * outputRate / 1_000_000

Reasoning is an output subset and is not added again. Explicit totals are
validation values and are not priced. A positive cache-write counter makes the
estimate unavailable until the Codex rate card defines an applicable
cache-write rate.

Applicability fails closed:

- Plus, Pro, and Business workspaces can use the token-based card documented by
  OpenAI, but MoneySiren still requires the local operator to confirm the card
  because local logs do not expose plan or migration state.
- Enterprise, Edu, Gov, Health, Teachers, and unknown workspaces require
  explicit confirmation. OpenAI documents a small legacy Enterprise subset.
- Legacy or unknown rate-card mode is unavailable.
- Fast or unknown execution mode is unavailable. GPT-5.6 is not currently
  listed as fast-mode supported in the official Speed documentation, so
  MoneySiren infers neither a multiplier nor a rate.
- Future safe model IDs remain visible but receive no guessed rate.

The non-secret applicability settings are:

    MONEYSIREN_CODEX_RATE_CARD_MODE=token-based
    MONEYSIREN_CODEX_EXECUTION_MODE=standard

The estimate inherits `estimated` or `bounded` from local scan coverage.
Official App Server quota, reset credits, and account aggregates remain separate
objects and are never reconciled to this estimate.

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
coverage, and credit-estimate detail to a popover or service page. An
unavailable estimate is shown as unavailable with its safe applicability
reason; no numeric value is fabricated.

## Acceptance

- availableCount remains authoritative for null, empty, or capped details.
- No synthetic reset-credit row or expiry is produced.
- Opaque credit IDs disappear from normalized output.
- gpt-5.6 and gpt-5.6-sol share one Sol bucket.
- Terra and Luna remain separate.
- Unknown safe models have no rate.
- Credit estimates require token-based standard-mode applicability.
- Credit estimates use official dated rates but remain local estimated/bounded
  values, never official account spend.
- Unsafe labels become unknown without being echoed.
- Explicit totals and subset components are not double-counted.
- Official account usage and local model usage remain separate objects.
- Truncated coverage is bounded.
- Errors and output pass forbidden-content regression tests.
