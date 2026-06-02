# StackSpend Review Gate Template

Every implementation slice must report and be reviewed with this format.

## Required Report From Implementation

- Changed files
- Commands run
- Test result
- Typecheck result
- Build result, if relevant
- Pending risks
- Security impact
- Whether `.env`, credentials, provider auth, or external delivery was touched

## Review Verdict Format

```text
Verdict: PASS | FAIL
Spec compliance: PASS | FAIL
Security posture: PASS | FAIL
Validation evidence: PASS | FAIL
Blocking issues:
- ...
Non-blocking suggestions:
- ...
Planning escalation needed: YES | NO
Recommended next step:
- ...
```

## Blocking Conditions

A review must fail if any of these happen:

- Product files are created in `auto-driver`.
- Real secrets, tokens, webhook URLs, account IDs, project IDs, invoice IDs, card data, or emails are committed.
- Raw provider payloads are persisted.
- Provider connector performs write operations.
- Telemetry is enabled by default.
- `.env` is created or committed.
- Actual Slack delivery happens without explicit send flag or operator approval.
- Implementation changes scope beyond the approved slice.

## M1/S1 Review Criteria

- TypeScript pnpm monorepo skeleton exists.
- CLI help/version works.
- Vitest test for `maskSecret` passes.
- `pnpm test` passes.
- `pnpm typecheck` passes.
- No real provider APIs are implemented.
- No `.env` file exists.
