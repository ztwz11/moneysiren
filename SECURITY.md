# Security Policy

## Supported versions

MoneySiren is pre-1.0.

| Version | Security support |
|---|---|
| Default branch | Yes |
| Latest published patch release | Yes |
| Older releases | No; upgrade first |

A fix may exist only on the default branch until a new patch is published.

## Reporting a vulnerability

Use GitHub private vulnerability reporting:

https://github.com/ztwz11/moneysiren/security/advisories/new

Do not open a public issue, Discussion, or pull request containing exploit
details, secrets, identifiers, private data, or reproduction artifacts.

Include only:

- affected MoneySiren version or commit;
- affected provider, package, or product surface;
- sanitized reproduction steps using fake or synthetic data;
- expected security impact;
- suggested mitigation if available.

Do not attach credentials, real payloads, databases, local AI logs, auth files,
environment files, screenshots from real accounts, or signing material.

## Response targets

These are best-effort targets, not a service-level agreement.

- critical report acknowledgement: one business day;
- other report acknowledgement: three business days;
- initial severity and next-step assessment: seven business days.

The maintainer coordinates validation, remediation, release, and disclosure.
Public disclosure waits until affected users have a reasonable upgrade window.

## Security model

MoneySiren is local-first. Provider connectors use minimum read-only credentials
and store normalized snapshots locally.

MoneySiren must not:

- store credentials in SQLite;
- persist raw provider payloads;
- upload local usage or billing data;
- enable telemetry by default;
- expose browser-readable secrets;
- execute provider write actions.

## Sensitive data

MoneySiren must not expose the following in issues, pull requests, logs, reports,
dashboard JSON, Slack payloads, fixtures, test snapshots, screenshots, or
release artifacts:

- API keys, OAuth tokens, webhook URLs, or credential files;
- provider account, organization, project, invoice, billing, card, or email
  data;
- real provider payloads or provider-account screenshots;
- local prompt or assistant text, tool input, command bodies, shell history,
  raw JSONL, full paths, session identifiers, or local AI auth files;
- private keys, certificates, signing credentials, or real local databases.

Use clearly marked fake or synthetic examples.

## Local AI privacy

Codex and Claude sources can contain prompt text, responses, tool input, shell
commands, file context, tokens, and account metadata.

Allowed output is bounded to sanitized usage metadata such as token counts,
percentages, reset times, model names, timestamps, freshness, and accuracy.

Raw stdout, stderr, JSON-RPC envelopes, JSONL, opaque account or credit IDs, and
auth files must not be logged, persisted, returned through APIs, or captured in
screenshots.

### Codex App Server child environment

MoneySiren must not pass its complete environment to the Codex App Server
process. The child receives only explicitly allowlisted process-execution,
OS/home/config, `CODEX_HOME`, locale, proxy, and CA-certificate variables.
Windows matching is case-insensitive and emits canonical keys; POSIX matching
is exact. Prefix wildcards such as `LC_*` and `MONEYSIREN_*` are forbidden.

Provider API keys, cloud credential variables, webhook or bot credentials,
reset and cron secrets, OAuth or vault tokens, `NODE_OPTIONS`, debug/log
controls, and SSH agent state must remain outside the child environment.
Proxy and CA variables are narrow network-runtime exceptions and must never be
logged or returned. `CODEX_HOME` may be passed so Codex can own its sign-in
state, but MoneySiren must not read or expose its auth contents.

## Public repository safeguards

Before pushing:

    npm run secret:scan

Before publishing or reviewing a public branch:

    npm run secret:scan:all

CI performs a full-history secret scan with fetch-depth 0.

Keep GitHub Secret Scanning, Push Protection, Dependabot, private vulnerability
reporting, protected main, and immutable v* tag rules enabled.

If sensitive data is accidentally committed, do not rely on deletion alone.
Revoke or rotate it immediately, notify the Security Responder privately, and
follow coordinated cleanup guidance.
