# MoneySiren Sidebar + Service Detail Spec

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
```

## Goal

Add a persistent navigation model and read-only service detail pages so users can move between global spend views and provider-specific operational views.

## Navigation

Desktop:

- fixed left sidebar.
- content area to the right.
- active route is visible.

Mobile and narrow viewports:

- top bar with menu button.
- drawer containing the same navigation tree.
- opening or closing the drawer must not reset current route state or live cache.

## Sidebar Structure

Dashboard:

- Overview
- Today Live
- Forecast
- Risks

Services:

- All services
- AWS
- OpenAI
- Supabase
- Cloudflare

Settings:

- Connections
- Preferences

The former dashboard `Providers` tab is removed. Its summary table role moves to `Services > All services`.

## Routes

- `/[locale]/services`
- `/[locale]/services/aws`
- `/[locale]/services/openai`
- `/[locale]/services/supabase`
- `/[locale]/services/cloudflare`
- `/[locale]/settings/connections`
- `/[locale]/settings/preferences`

Provider detail routes must reject unknown provider keys with a safe not-found or unsupported state.

## All Services

The All services page summarizes every available provider:

- provider name.
- connection state.
- canonical freshness.
- live freshness.
- month estimate.
- today live inclusion state.
- risk level.
- latest canonical sync.
- latest live check.

## Service Detail

Each service detail page is read-only in this slice.

Header:

- provider name.
- connection status.
- access level: `read-only`.
- last canonical sync.
- last live check.

Cost section:

- confirmed through yesterday.
- today live value when available.
- month forecast.
- billing versus estimate difference.

Usage section:

- important metrics.
- recent usage buckets.
- units and aggregation windows.

Health and risk section:

- provider sync errors.
- stale data.
- service health status.
- partial or unavailable API surfaces.

Data confidence section:

- live granularity.
- confidence.
- canonical coverage date.
- TTL state.

Security and permission section:

- required environment key names.
- configured or missing status only.
- credential store state.
- no token, API key, account id, project id, invoice id, email, or raw billing identifier display.

Emergency actions section:

- visible as a planned future capability.
- no destructive execution buttons.
- allowed command: `View requirements`.
- prohibited commands: revoke, delete, stop, disable, rotate, terminate, or any provider write action.

## Emergency Access Boundary

Emergency actions require a separate future spec before implementation:

- provider-specific write permission matrix.
- separate emergency credential slot.
- explicit re-authentication.
- dry-run.
- two-step confirmation.
- audit log.
- recovery guidance.

This slice may show `Emergency access: planned` or `not configured`, but must not perform write calls.

## Preferences

Preferences are dashboard display settings only:

- locale.
- dashboard timezone.
- default start route.
- currency display policy.
- live refresh TTL.
- density: comfortable or compact.
- telemetry: off, with future opt-in placeholder only.

Preferences must not contain API keys, OAuth setup, provider permissions, or emergency action configuration.
