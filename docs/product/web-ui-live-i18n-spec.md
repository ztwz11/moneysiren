# MoneySiren Web UI Live + i18n Spec

```text
SPEC_LOCKED: YES
CODING_LOOP_ALLOWED: YES
```

## Goal

Replace the alpha single-page SQLite-only dashboard with a route-based local operations dashboard that separates finalized historical data from provisional live data and supports Korean, English, and Japanese UI strings.

## Product Model

MoneySiren displays two different data classes:

- `canonical`: normalized SQLite data finalized through the previous local dashboard day.
- `live_today`: provisional data fetched on demand for the current dashboard day.

`live_today` must not be written to the canonical SQLite snapshot tables. It may be kept in a short-lived local cache and must always be labeled provisional.

## Time Boundary

- `MONEYSIREN_TIMEZONE` defines the dashboard day boundary.
- If unset, MoneySiren uses the host OS timezone.
- Stored timestamps remain UTC ISO strings.
- Dashboard grouping converts timestamps into the dashboard timezone.
- `Confirmed through yesterday` means the last complete day before the current dashboard date.
- `Today live` means the current dashboard date from 00:00 to now.

## Routes

The dashboard uses route-based navigation:

- `/[locale]/dashboard/overview`
- `/[locale]/dashboard/today`
- `/[locale]/dashboard/forecast`
- `/[locale]/dashboard/risks`

`/[locale]` redirects to `/[locale]/dashboard/overview`.

`/` detects `Accept-Language` and redirects to `ko`, `en`, or `ja`. Unsupported languages fall back to `en`.

## Dashboard Tabs

Dashboard navigation is visually presented as tabs, but each tab has a URL.

### Overview

The overview answers: "Is this month on track, and what needs attention now?"

Top metrics:

- `Month forecast`: confirmed data plus safe live values plus simple projection.
- `Confirmed through yesterday`: canonical SQLite cost through the previous dashboard day.
- `Today live`: only live provider values safe to aggregate.
- `Providers needing attention`: providers with stale, error, partial, critical, or down states.

### Today Live

The Today Live view shows read-only provider live checks:

- manual refresh only.
- default TTL: 60 seconds.
- no automatic polling in this slice.
- provider rows show last live check, TTL state, live granularity, confidence, and provisional status.

### Forecast

Forecasting must stay simple and explainable:

```text
confirmedThroughYesterday + todayLiveIncluded + projectedRemainingDays
```

The projection uses the month-to-date canonical daily average. Forecast output must show:

- canonical coverage end date.
- included live providers.
- excluded live providers.
- remaining days.
- calculation confidence.

No machine learning, seasonality, advanced anomaly detection, or enterprise FinOps forecasting is in scope.

### Risks

The risks view consolidates:

- live check failures.
- stale canonical data.
- stale live cache.
- provider sync alerts.
- service health degradation.
- partial or unavailable provider surfaces.

## Live Granularity

Provider live capability must be explicit:

- `exact_today`: exact current-day cost/usage is available.
- `daily_bucket`: daily bucket is available but may lag.
- `month_to_date`: current month total is available, but current day is not separable.
- `current_period`: provider billing period total is available.
- `usage_only`: usage or health is available without reliable cost.
- `unavailable`: live check is not supported.

Overview aggregates only values with safe current-day meaning. Other values are excluded and counted as partial.

## Freshness

Canonical and live freshness are separate.

Canonical freshness:

- `fresh`: canonical data exists through yesterday.
- `stale`: yesterday is missing.
- `missing`: no provider data exists.

Live freshness:

- `live`: successful value inside TTL.
- `stale`: TTL expired.
- `error`: last live check failed.
- `unavailable`: provider does not support live today.
- `not_configured`: no credential is configured.
- `locked`: credential store is locked.

If a live check fails, the provider is excluded from live totals. A previous successful value may be shown as stale reference data, but it must not be included in the default total or forecast.

## i18n

Supported locales:

- `ko`
- `en`
- `ja`

Implementation:

- use App Router `[locale]` routes.
- use typed local dictionaries, not inline UI strings.
- use `Intl.DateTimeFormat` and `Intl.NumberFormat` for dates, numbers, and currencies.
- fallback locale is `en`.
- translation key coverage must be testable.

Translate:

- navigation labels.
- dashboard cards.
- tables.
- buttons.
- tooltips.
- aria labels.
- empty, stale, error, provisional, and planned states.

Do not translate:

- provider official names.
- metric keys.
- provider source identifiers.
- currency codes.
- redacted identifiers.
- normalized provider data values.

## Visual Direction

MoneySiren is an operational tool, not a marketing page.

- Use a quiet, dense dashboard layout.
- Prefer tables, compact panels, status badges, segmented navigation, and clear hierarchy.
- Avoid hero sections, decorative gradients, and oversized marketing cards.
- Use state colors intentionally:
  - ok: green.
  - live/provisional: blue.
  - warning/stale: amber.
  - critical/down: red.
  - neutral: gray.
- Use border radius of 8px or less.
- Layout must survive Korean, English, and Japanese text length differences.

## Out Of Scope

- storing live today values in canonical SQLite tables.
- automatic polling.
- hosted SaaS.
- multi-user accounts.
- enterprise FinOps workflows.
- connector expansion beyond the current provider set.
