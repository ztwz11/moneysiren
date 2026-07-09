# MoneySiren Governance

MoneySiren is an early, maintainer-led open-source project. This document makes
decision, review, release, and support boundaries explicit while the project is
pre-1.0.

## Roles

### Maintainer

A maintainer may:

- merge pull requests;
- manage releases, repository settings, and security advisories;
- approve changes to provider authentication, local AI parsing, persistence,
  notification delivery, and release signing;
- define supported versions and close superseded work.

The current maintainer and default code owner is @ztwz11.

### Contributor

A contributor may propose issues and pull requests that follow CONTRIBUTING.md,
the local-first security model, and the repository's synthetic-data rules.
Contribution does not require commit access.

## Decision process

Small documentation, copy, fixture, and test improvements may be accepted through
normal review.

The following changes require a written plan and explicit maintainer approval
before implementation:

- provider authentication or permission changes;
- local AI auth-file or raw-log access;
- normalized billing schema or persistence changes;
- notification or Slack delivery changes;
- release signing, installer, or supply-chain changes;
- telemetry, hosted services, OAuth, multi-user behavior, or provider writes.

For those changes, the pull request must record alternatives, data boundaries,
security impact, safe-failure behavior, validation evidence, and rollback.

When there is disagreement, the maintainer documents the decision and rationale
in the issue, pull request, or product decision log. Security and privacy
boundaries take precedence over convenience.

## Review expectations

Best-effort targets:

- acknowledge a normal issue within three business days;
- acknowledge a private security report within one business day;
- provide a first review on a safe starter pull request within five business
  days.

These are targets, not a paid support SLA.

Every implementation slice reports:

- changed files;
- commands run;
- test results;
- typecheck and build results;
- pending risks;
- security impact;
- rollback or safe-failure behavior.

## Release ownership

Only a maintainer may publish npm packages, create a stable GitHub Release, or
approve signed desktop artifacts.

A stable release requires:

- matching package, tag, release-note, CHANGELOG, and runtime versions;
- required CI, secret scan, and fresh-install evidence;
- immutable release artifacts and required integrity metadata;
- valid signing evidence for any desktop artifact presented as Stable.

Unsigned desktop artifacts may be published only as explicitly labeled Preview
or prerelease assets.

## Security and sensitive reports

Never post credentials, real provider identifiers, raw billing payloads, prompt
text, command history, raw JSONL, local paths, or auth-file content in public
issues or pull requests. Use GitHub private vulnerability reporting when the
repository setting is available and follow SECURITY.md.

Maintainers may hide, edit, lock, or remove public content that exposes sensitive
data. The response should preserve a sanitized issue summary when it is safe to
do so.

## Becoming a maintainer

A contributor may be invited after sustained, safe, and constructive work across
multiple changes. The existing maintainer evaluates technical judgment,
security discipline, review quality, responsiveness, and project alignment.

Access is least-privilege and may be reduced after inactivity or security
concerns.

## Succession

If the current maintainer can no longer operate the project, they should identify
a trusted successor, transfer the minimum required repository and package
permissions, rotate release credentials, and document the transition publicly.

If no successor is available, the repository should remain readable and clearly
state that releases and security maintenance are paused.
