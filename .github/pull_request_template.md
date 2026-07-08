## Summary

<!-- What changed? -->

## Type of Change

- [ ] Docs
- [ ] Feature
- [ ] Bug fix
- [ ] Security hardening
- [ ] Provider connector
- [ ] Local AI CLI usage
- [ ] CI/release

## Files Changed

<!-- List important files. -->

## Security Impact

- [ ] Does not expose API keys/tokens/webhook URLs
- [ ] Does not persist raw provider payloads
- [ ] Does not expose browser-side secrets
- [ ] Does not expose local AI CLI prompt text/tool input
- [ ] Does not expose shell command bodies, raw JSONL lines, or auth file contents
- [ ] Keeps provider connector read-only
- [ ] Adds no provider write APIs or emergency execution buttons
- [ ] Adds no telemetry, or telemetry remains explicit opt-in
- [ ] Not security-sensitive

Notes:

## Verification

- [ ] `git diff --check`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `npm run secret:scan`

## Remaining Risks

<!-- What should reviewers watch for? -->
