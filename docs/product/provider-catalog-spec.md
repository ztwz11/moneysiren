# MoneySiren Provider Catalog + Connections Spec

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
```

## Goal

Provide a scalable provider catalog and convenient local connection flows while keeping MoneySiren local-first, read-only by default, and secret-safe.

## Provider Catalog

Route:

- `/[locale]/providers`

Entry point:

- `Settings > Connections > Add provider`

Catalog controls:

- search.
- category filter.
- implementation status filter.

Categories:

- Cloud
- AI
- Database
- Hosting
- Observability

Provider states:

- `available`: connector and connection UI are implemented.
- `planned`: intended future connector.
- `research`: provider API or auth model needs more review.
- `unsupported`: no practical automated collection path yet.

Provider cards show:

- provider name.
- category.
- implementation status.
- supported auth methods.
- supported data surfaces: cost, usage, health, forecast, emergency planned.
- `Connect` for available providers.
- `View roadmap` for planned or research providers.

## Initial Catalog

Available in this implementation:

- AWS
- OpenAI
- Supabase
- Cloudflare

Shown as planned or research only:

- GCP
- Azure
- Oracle Cloud
- Anthropic Claude
- Google Gemini / Vertex AI
- Vercel
- GitHub Actions
- Railway
- Fly.io
- Netlify
- Render
- Neon
- MongoDB Atlas
- Datadog
- Sentry

No new provider connector is implemented in this web UI slice.

## Connections

Route:

- `/[locale]/settings/connections`

Connections show:

- provider.
- saved read-only connections for the provider.
- auth method.
- configured state.
- credential source.
- read-only test status.
- emergency access state.
- required env key names or credential requirements.
- static setup links to provider documentation for finding or creating the required values.

Connection states:

- `not_configured`
- `env_configured`
- `credential_store_configured`
- `oauth_connected`
- `locked`
- `expired`
- `invalid`
- `read_only_ready`
- `emergency_not_configured`
- `emergency_planned`

## Local Auth Broker

`Connect` flows are mediated by the local Next.js server:

- browser starts provider auth from the Connections or Catalog UI.
- server route owns OAuth state, nonce, and PKCE verifier.
- OAuth callbacks use localhost only, for example `http://127.0.0.1:3000/api/auth/callback/[provider]`.
- API key or token input is verified before storage.
- tokens and API keys are never stored in browser localStorage, sessionStorage, or readable cookies.
- UI responses return only status values, not secret material.

## Credential Store

Create a shared credential abstraction:

- package: `packages/credentials`.
- interface:
  - `listCredentials(provider, scope)`.
  - `getCredential(provider, scope, connectionId?)`.
  - `setCredential(provider, scope, secretOrConnectionInput)`.
  - `deleteCredential(provider, scope, connectionId?)`.
  - `listCredentialStatuses(provider, scope)`.
  - `testCredentialStore()`.

Credentials are stored per provider, scope, and connection id. A provider can have multiple read-only keys or accounts. Deleting from the UI removes only the selected local connection, not all credentials for the provider.

Backends:

- preferred: OS keychain through `@napi-rs/keyring`.
- fallback: passphrase-based encrypted local vault.

OS keychain targets:

- Windows Credential Manager.
- macOS Keychain.
- Linux Secret Service.

Fallback vault:

- passphrase is never stored.
- unlock key is kept in server process memory only.
- locked vault makes provider credentials unavailable.
- unlock has a timeout.
- passphrase loss is unrecoverable; user may reset credentials without deleting SQLite usage/cost data.

## Provider Auth Policies

AWS:

- prefer existing `AWS_PROFILE`, SDK default credential chain, and IAM Identity Center/SSO profile setup.
- do not build a UI that stores raw AWS secret access keys in MoneySiren.
- validate read-only Cost Explorer access.

OpenAI:

- support Admin API key input.
- store in credential store.
- validate Usage/Costs read-only access.
- show sanitized current-period LLM usage totals when live usage data is available.
- never redisplay the key.

Supabase:

- prefer OAuth2 where practical.
- support PAT fallback.
- validate Management API read-only access.

Cloudflare:

- support API token input.
- provide permission guidance.
- validate billing/usage read-only access.
- treat account ids as sensitive and avoid raw display.

## Access Protection

The local dashboard defaults to local-only operation:

- bind to `127.0.0.1` by default for credential features.
- sensitive actions require a local session.
- session cookie contains only an opaque session id.
- no credential material in cookies.
- use CSRF, state, and nonce validation for auth flows.
- separate dashboard read-only viewing from credential mutation actions.

## Read-Only And Emergency Separation

Default connections are read-only and power dashboard, live checks, forecasts, and service detail pages.

Emergency access is a separate future credential slot. It may be shown as planned or not configured, but this slice must not implement provider write calls.
