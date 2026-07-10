# Codex Rate-Limit and Account Usage

Status: local-only integration over the official Codex App Server protocol.

This integration is optional. It is separate from the OpenAI Platform Usage/Costs connector and is not required for provider billing snapshots or the main MoneySiren dashboard.

## Official local transport

MoneySiren launches a local Codex child process with the documented stdio transport:

```text
codex app-server --listen stdio://
```

Stdio is also the default transport. MoneySiren exchanges newline-delimited JSON-RPC messages with that child process and uses these documented methods:

- `account/rateLimits/read` for rate-limit windows and reset-credit availability;
- `account/usage/read` for Codex account usage summaries and daily buckets.

See the [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server).

The Codex process owns authentication. MoneySiren does not accept Codex credentials through the browser, copy credential material, or construct a separate HTTP request with a user token.

## Measurement schema v2

MoneySiren normalizes App Server results into schema v2 before they reach an API response, dashboard, report, or persisted snapshot.

The reset-credit compatibility route returns normalized data with these semantics:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Always `2` for this contract. |
| `source` | `codex-app-server`. |
| `accuracy` | `official` because the value came from the documented App Server method. |
| `availableCount` | The authoritative number currently reported by `account/rateLimits/read`. |
| `credits` | Only the individual detail rows supplied by App Server. |
| `detailsComplete` | Whether the supplied detail rows cover the authoritative available count. |
| `totalEarnedCount` | `null`; App Server does not provide a lifetime awarded-credit total in this contract. |

Never derive `availableCount` from `credits.length`. For example, if App Server reports five available credits but supplies two detail rows, MoneySiren displays five available, two supplied details, and partial coverage. It does not synthesize the three missing rows.

`account/usage/read` is normalized as a separate account-usage measurement. Its official account totals must not be added to, substituted for, or labeled as local session-log estimates. Local per-model estimates remain a distinct measurement with their own coverage and confidence labels.

## Local dashboard

The compatibility dashboard is available on the loopback server at:

```text
http://127.0.0.1:3000/codex-reset-credits
```

The page labels the source as **Official Codex App Server**, shows `availableCount` separately from supplied detail rows, and marks partial detail coverage. It never invents credits or an awarded total.

## Requirements

- Install a current Codex CLI and make `codex` available on `PATH`.
- Sign in through Codex itself on the same computer that runs the local MoneySiren server.
- Keep the MoneySiren web server bound to `127.0.0.1` unless you have deliberately configured a trusted local reverse proxy.
- Run this integration only on a machine that is allowed to start the local Codex process.

## Environment variables

Use empty values as examples only. Do not put real secrets in documentation, issues, logs, screenshots, or pull requests.

```bash
CODEX_HOME=
CODEX_API_TIMEOUT_MS=15000
APP_TIME_ZONE=Asia/Seoul
RESET_CREDIT_API_KEY=
CRON_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

`CODEX_HOME` is optional and is inherited by the Codex child process. MoneySiren does not inspect credential material within it.

`CODEX_API_TIMEOUT_MS` bounds App Server startup and request waits. Timeouts and unsupported methods return a sanitized unavailable result; they do not fall back to a hidden network endpoint.

## Local API access

A loopback request needs no bearer value when `RESET_CREDIT_API_KEY` is unset:

```bash
curl http://127.0.0.1:3000/api/codex/reset-credits
```

When `RESET_CREDIT_API_KEY` is set, a trusted local script must include it:

```bash
curl -H "Authorization: Bearer <RESET_CREDIT_API_KEY>" http://127.0.0.1:3000/api/codex/reset-credits
```

The browser dashboard never receives `RESET_CREDIT_API_KEY`. Do not expose this compatibility route to an external network without explicit bearer protection.

The optional notification route remains:

```bash
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron/codex-reset-credits
```

Set both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to enable Telegram delivery. If either is absent, MoneySiren uses its local console notifier.

## Security and persistence boundary

MoneySiren may keep the minimum request state in memory while the child process is active. It must not persist or expose:

- raw JSON-RPC request or response messages;
- App Server stdout or stderr streams;
- Codex credential material or account identifiers;
- prompt text, tool input, shell commands, or local file context;
- opaque upstream credit identifiers;
- raw local session-log lines.

Only normalized schema v2 measurements, sanitized errors, timestamps, counts, rate windows, safe model identifiers, and coverage metadata may cross into SQLite, dashboard JSON, reports, fixtures, screenshots, or tests.

## Failure behavior

- A missing Codex executable, missing sign-in state, unsupported method, malformed response, oversized response, or timeout becomes an explicit sanitized unavailable state.
- A failed refresh does not transform a prior official count into an estimate.
- Partial detail coverage remains visible instead of being filled with guessed rows.
- Account usage and local estimates remain separated even when one source is unavailable.
