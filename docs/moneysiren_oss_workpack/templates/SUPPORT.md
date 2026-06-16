# Support

MoneySiren is an open-source local-first tool.

## Before opening an issue

Please check:

- README
- docs/security-model.md
- docs/provider-connectors.md
- docs/local-ai-cli-usage.md
- existing issues

## Safe bug reports

Do not include real secrets or provider identifiers.

Use fake values:

```text
OPENAI_ADMIN_KEY=sk-admin-FAKE
AWS_PROFILE=moneysiren-readonly
CLOUDFLARE_ACCOUNT_IDS=acct_FAKE
```

For local AI CLI issues, do not paste raw Codex or Claude log lines if they contain prompt text or tool input. Provide sanitized usage metadata only.

## Good issue contents

- OS and version
- Node and pnpm version
- MoneySiren commit/version
- provider name
- command executed
- sanitized error message
- expected behavior
- actual behavior
