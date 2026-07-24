# Codex Reset-Credit Expiry

Status: local-only. The primary Codex app-server integration is official; the direct ChatGPT fallback is experimental and unofficial.

This integration is not required for OpenAI Usage/Costs sync, provider billing snapshots, local dashboard usage, or the core MoneySiren security model.

## Purpose

The feature can show local Codex reset-credit expiry information when the user has a local Codex installation and authentication state on the same machine running MoneySiren.

MoneySiren first reads the stable local Codex app-server method:

```text
account/rateLimits/read
```

Codex CLI `0.144.0` and newer can return `rateLimitResetCredits.credits` detail rows with each available credit's ID, reset type, status, grant time, and expiry time. MoneySiren keeps only normalized display fields and never returns the Codex auth token or raw app-server response.

`rateLimitResetCredits.availableCount` is authoritative. The backend may return fewer detail rows than that count, so MoneySiren displays known expiry dates while keeping unresolved credits visible without inventing dates.

## Stability warning

The local app-server protocol is the preferred integration and should fail safely when Codex is unavailable or too old to return detail rows.

When the local app-server does not provide exact expiry details, explicit non-HUD refreshes and the dedicated reset-credit route can fall back to an undocumented ChatGPT internal API:

```text
GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits
```

The fallback endpoint may change without notice. MoneySiren keeps it isolated, returns only normalized fields, and marks direct API responses as `unofficial: true`. The 5-second HUD poll does not call this endpoint.

## Local dashboard

When enabled locally, the dashboard is available at:

```text
http://127.0.0.1:3000/codex-reset-credits
```

## Requirements

- Codex CLI or Codex App must be installed and logged in on the same computer running the local Node.js server.
- Codex CLI `0.144.0` or newer is recommended for official reset-credit detail and expiry fields.
- Run `codex login` again if the API returns `UPSTREAM_UNAUTHORIZED`.
- Do not upload `~/.codex/auth.json` to Vercel, GitHub, or any remote server.
- Vercel and other remote hosts cannot read your local Codex auth file. This feature is for local Node.js or self-hosted machines that already have Codex installed.

## Environment variables

Use empty values as examples only. Do not paste real secrets in docs, issues, logs, screenshots, or pull requests.

```bash
CODEX_AUTH_FILE=
CODEX_HOME=
CODEX_RESET_CREDIT_ENDPOINT=https://chatgpt.com/backend-api/wham/rate-limit-reset-credits
CODEX_API_TIMEOUT_MS=15000
APP_TIME_ZONE=Asia/Seoul
RESET_CREDIT_API_KEY=
CRON_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Auth file lookup order:

1. `CODEX_AUTH_FILE`
2. `CODEX_HOME/auth.json`
3. `~/.codex/auth.json`

## Local API examples

API example without exposing real secrets:

```bash
curl http://127.0.0.1:3000/api/codex/reset-credits
```

If `RESET_CREDIT_API_KEY` is set, direct API calls must include a bearer token:

```bash
curl -H "Authorization: Bearer <RESET_CREDIT_API_KEY>" http://127.0.0.1:3000/api/codex/reset-credits
```

The browser dashboard intentionally does not receive `RESET_CREDIT_API_KEY`. For normal local dashboard use, leave `RESET_CREDIT_API_KEY` unset and keep the server bound to `127.0.0.1`. Set `RESET_CREDIT_API_KEY` only when calling the API route from a trusted local script or scheduler.

Do not expose the API route to an external network without `RESET_CREDIT_API_KEY`. Never pass Codex access tokens, refresh tokens, account IDs, or auth JSON through browser inputs, URLs, logs, screenshots, or issue reports.

Cron notification route:

```bash
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron/codex-reset-credits
```

Windows Task Scheduler example:

```powershell
schtasks /Create /SC HOURLY /TN MoneySirenCodexResetCredits /TR "powershell -NoProfile -ExecutionPolicy Bypass -Command ""Invoke-RestMethod -Method POST -Uri http://127.0.0.1:3000/api/cron/codex-reset-credits -Headers @{Authorization='Bearer <CRON_SECRET>'}"""
```

Linux/macOS cron example:

```cron
*/30 * * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron/codex-reset-credits >/dev/null
```

Telegram notifications are optional. Set both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to send reset-credit expiry alerts. If either value is missing, MoneySiren uses the console notifier.

## Safety rules

Do not:

- upload Codex auth files to remote hosts;
- expose the route on a public network without explicit bearer protection;
- log access tokens, refresh tokens, account IDs, or raw auth JSON;
- include real Codex auth data in tests, fixtures, screenshots, docs, or issues;
- use this feature in hosted demos;
- make this feature required for the core MoneySiren dashboard.

Do:

- keep this feature local-only;
- keep responses normalized;
- mark returned data as unofficial if applicable;
- keep the last known safe dashboard state when refresh fails;
- document errors without printing secret material.

## Recommended docs wording

Use wording like:

> MoneySiren includes optional local-only experiments for AI CLI usage visibility. Experimental integrations are isolated and documented separately because upstream behavior may change.

Avoid wording that makes this feature sound like an official OpenAI API integration.

## Application note

This feature should not be the main reason for applying to an open-source support program. The stronger application story is MoneySiren's official provider usage/cost visibility, local-first design, read-only connectors, fake fixtures, and Codex-assisted maintainer workflows.
