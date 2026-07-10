# Good First Issues

MoneySiren maintains small contribution tasks that require no real credentials
or private data.

Browse the current queue:

https://github.com/ztwz11/moneysiren/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22

## Current starter issues

- #13 Windows OPENAI_ADMIN_KEY troubleshooting
- #14 AWS_PROFILE setup screenshots
- #15 Codex App/CLI troubleshooting screenshots
- #16 Connection diagnostics regression cases
- #17 Mock emergency-readiness scenario

The GitHub label query is authoritative if this static list becomes stale.

## How to start

1. Read CONTRIBUTING.md.
2. Comment on the issue that you would like to work on it.
3. Confirm files, acceptance criteria, and verification.
4. Use fake or synthetic data only.
5. Keep the pull request limited to the issue scope.
6. Report changed files, commands, tests, typecheck/build status, remaining
   risks, and security impact.

An assignment prevents duplicate work but does not grant repository access.

## Safe starter areas

- install and troubleshooting documentation;
- Korean or English copy;
- fake-data screenshots;
- synthetic provider fixtures;
- parser and redaction tests;
- dashboard empty states;
- connection diagnostics;
- release notes;
- official provider documentation links.

## Data that must never be used

A starter issue must not require:

- real credentials, tokens, webhook URLs, or auth files;
- provider account, organization, project, invoice, billing, or email data;
- raw provider payloads or screenshots from real provider accounts;
- local prompt or assistant text, tool input, command bodies, shell history,
  raw JSONL, session IDs, or full local paths;
- real databases, logs, environment files, certificates, or signing material.

If an issue appears to require any of these, stop and ask the maintainer for a
synthetic fixture or safer scope.

## Not good first issues

These require maintainer ownership and security review:

- provider authentication or OAuth;
- hosted services or credential upload;
- provider write APIs or emergency execution;
- local AI raw-log discovery or auth access;
- persistence or retention deletion;
- desktop signing or release publication;
- security incident response;
- telemetry or scheduled network collection.

Remove starter labels if an issue grows beyond a safe bounded contribution.
