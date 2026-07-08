# Good First Issues

These are safe contribution areas for new contributors. They should not require real credentials, real billing payloads, provider account IDs, project IDs, invoice IDs, webhook URLs, local AI prompt text, shell command bodies, raw JSONL lines, or auth file contents.

## Docs

- Improve Windows environment variable troubleshooting.
- Add screenshots generated from fake fixture data.
- Improve OpenAI Admin API key setup docs without showing real keys.
- Improve `AWS_PROFILE` and AWS SSO setup docs.
- Translate UI copy.
- Improve the provider support matrix.
- Clarify emergency readiness manual-only behavior.

## Fixtures and Tests

- Add fake provider fixture scenarios.
- Add redaction tests for new sanitized fields.
- Add connection diagnostics tests.
- Add dashboard empty-state tests.
- Add parser tests that use synthetic provider payloads only.

## Provider Links

- Add official provider console links.
- Verify provider docs links are current.
- Improve link labels and next-action copy.

## UI Copy

- Improve first-run empty states.
- Improve local-only and read-only explanations.
- Improve warning copy for stale live data.
- Improve settings labels for notification thresholds.

## Not Good First Issues

These areas need maintainer review and should not be first contributions:

- new provider auth flows;
- OAuth;
- hosted services;
- credential upload;
- provider write APIs;
- emergency execution actions;
- local AI raw log parsing that could expose prompt or command content;
- release signing changes.
