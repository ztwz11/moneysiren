# Local AI Usage History Spec

Status: Implemented locally on 2026-07-13.

## Goal

Persist sanitized Codex CLI and Claude CLI usage locally and show it as daily,
weekly, and monthly history below the existing quota cards.

## Storage contract

- Store one idempotent daily bucket per provider, usage date, and timezone.
- Store only numeric counters and safe timestamps.
- Weekly aggregation starts on Monday; monthly aggregation follows calendar months.
- Unknown counters remain `NULL`.
- A newer observation may replace the same daily bucket; an older observation may not.
- Local App surfaces that fall back to shared CLI logs must not be double-counted.

Allowed fields:

- provider key and safe source scope;
- usage date, timezone, observed-at, first/last activity timestamps;
- activity/session/turn/tool counts;
- input, output, cache, reasoning, and total token counts;
- parser version, local-only flag, and secrets-returned flag.

Forbidden fields:

- prompt or response text;
- shell command bodies or tool input;
- raw JSONL or raw local file content;
- source paths, session IDs, turn IDs, or native provider IDs;
- credentials, auth files, authentication tokens, account IDs, project IDs, or billing profiles.

## API and UI contract

- History reads are local-only and no-store.
- Supported granularities are `day`, `week`, and `month`.
- The table shows period, activity, input/output/cache/reasoning/total tokens,
  coverage, and latest activity.
- Current five-hour and weekly quota cards remain live-only and backward compatible.

## Acceptance criteria

- Restarting MoneySiren preserves history in local SQLite.
- Re-scanning the same logs does not duplicate usage.
- Day, Monday-based week, and calendar-month totals are correct in `Asia/Seoul`.
- Missing values display as unavailable rather than zero.
- Existing quota cards and HUD behavior do not regress.
- Forbidden content does not appear in SQLite, API JSON, logs, fixtures, or UI snapshots.

## Validation checklist

- [x] Migration and local store tests prove idempotent upserts and bounded reads.
- [x] Parser tests prove timezone bucketing and forbidden-content containment.
- [x] API and UI tests cover local-only access and day/week/month controls.
- [x] Existing live quota card and HUD regression tests pass.
- [x] `npm run test`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run secret:scan`
- [x] `git diff --check`
