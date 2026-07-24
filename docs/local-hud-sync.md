# Local HUD Sync Contract

MoneySiren HUD is a local-only desktop surface for short-lived usage and reset-credit signals. It must remain safe to run beside live provider credentials.

## Refresh Path

- `/hud` renders an initial server-side HUD view model, then polls `/api/local/hud` every 5 seconds.
- The polling request reads local AI usage only. It must not refresh remote cloud or SaaS billing providers every 5 seconds.
- Manual HUD refresh and the tray `refresh-now` action call `/api/local/refresh-live` with a local session and CSRF token.
- Refresh scopes are:
  - `hud`: local AI providers used by the HUD.
  - `local_ai`: all local AI providers.
  - `all`: explicit manual refresh for all configured live providers.

## Data States

HUD items carry sync state independently from risk state.

- `fresh`: latest read is inside its TTL.
- `stale`: last good data is still shown, but a newer refresh is needed.
- `error`: latest attempt failed. The previous successful value may still be shown.
- `not_configured` and `unavailable`: neutral states that do not imply provider risk.

The HUD keeps the last successful local AI value when a refresh fails. Error messages are sanitized before entering the shared view model.

## Usage Progress

Usage progress is always displayed as used percent.

- 0% means unused.
- 100% means fully consumed.
- Remaining percent is stored as a separate field for labels and menus.

This avoids mixing remaining-quota direction with risk direction.

## Codex Reset Credits

Codex App and Codex CLI are separate usage providers. Their reset-credit pools must not be merged.

MoneySiren supports both exact and estimated reset-credit records:

- Exact records use `usage_reset_credit` with `resetAt`.
- Observation-based estimates use `usage_reset_credit_estimate` with `resetAt` and optional `resetAtLatest`.
- If exact and estimated records exist for the same provider, exact records win for that provider.
- Estimated records must preserve `itemKey`, `accuracy`, `source`, `resetAt`, and `resetAtLatest`.

The HUD reads reset-credit detail from the official local Codex app-server `account/rateLimits/read` snapshot. Exact app-server expiry rows take precedence over safe count-observation estimates. The undocumented ChatGPT reset-credit fallback is not polled every 5 seconds.

## Local API Security

Local HUD APIs are for `127.0.0.1`, `localhost`, and `::1` only.

- `/api/local/hud` is read-only and returns a sanitized view model.
- `/api/local/refresh-live` requires the local dashboard session cookie and `X-MoneySiren-CSRF`.
- API responses must not contain provider secrets, tokens, account IDs, raw provider payloads, or auth file paths.

Do not expose these routes to an external network.
