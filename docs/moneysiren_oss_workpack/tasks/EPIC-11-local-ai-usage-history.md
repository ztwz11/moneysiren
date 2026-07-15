# EPIC-11: Local AI Usage History

Status: Done locally on 2026-07-13

## Goal

Persist safe Codex CLI and Claude CLI daily usage buckets and expose day, week,
and month history on the local provider dashboard.

## Owned files

- `apps/web/lib/local-tools.ts`
- `apps/web/lib/local-ai-history.ts`
- `apps/web/app/api/local-ai/usage-history/route.ts`
- `apps/web/components/LocalAiUsageHistory.tsx`
- `apps/web/components/OperationsViews.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/migrate.ts`
- `packages/db/src/index.ts`
- `packages/db/src/local-store.ts`
- `packages/db/migrations/0004_local_ai_usage_daily.sql`
- focused tests and product documentation

## Security boundary

- Read local logs only through existing read-only local collector boundaries.
- Persist only numeric counters, safe timestamps, provider/date/timezone keys,
  source scope, parser version, and local-only metadata.
- Do not persist or expose prompts, responses, shell command bodies, tool input,
  source paths, raw JSONL, auth files, credentials, authentication tokens, or
  native session/turn IDs.

## Acceptance criteria

- [x] SQLite daily bucket migration is idempotent.
- [x] Repeated scans update rather than duplicate a provider/date bucket.
- [x] Daily, Monday-based weekly, and calendar-month queries are correct.
- [x] Codex/Claude fake fixtures prove prompt and command text do not escape.
- [x] Local-only API returns normalized history only.
- [x] Provider detail UI offers day/week/month controls.
- [x] Existing quota cards and HUD tests remain green.
- [x] Test, typecheck, build, diff check, and secret scan pass.

## Validation commands

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npm run secret:scan
git diff --check
```
