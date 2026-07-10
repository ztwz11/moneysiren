# Support

MoneySiren is an open-source, local-first project. Support is best effort and
does not include access to user credentials, provider accounts, or private
billing data.

## Choose the right route

- Reproducible bug:
  https://github.com/ztwz11/moneysiren/issues/new?template=bug_report.yml
- Product improvement:
  https://github.com/ztwz11/moneysiren/issues/new?template=feature_request.yml
- New provider:
  https://github.com/ztwz11/moneysiren/issues/new?template=provider_request.yml
- Setup or usage question:
  https://github.com/ztwz11/moneysiren/discussions/categories/q-a
- Vulnerability:
  https://github.com/ztwz11/moneysiren/security/advisories/new

Do not report vulnerabilities or sensitive data through a public issue or
Discussion.

## Before reporting a bug

Check:

- README.md
- docs/install.md
- docs/troubleshooting.md
- docs/security-model.md
- docs/provider-connectors.md
- docs/local-ai-cli-usage.md
- existing GitHub issues

Try to reproduce the problem with the credential-free mock provider.

## Safe diagnostics

The bug form asks for:

- operating system and public version;
- Node.js version;
- MoneySiren version or commit;
- provider or product surface;
- MoneySiren command family;
- safe reproduction steps;
- expected and actual behavior;
- a sanitized error code or short message.

Do not paste shell history or full command bodies. Select the command family and
describe steps in plain language.

## Never include

- API keys, OAuth tokens, webhook URLs, or credential files;
- provider account, organization, project, invoice, billing, card, or email
  data;
- real provider screenshots or raw responses;
- prompt or assistant text, tool input, command bodies, shell history, raw
  JSONL, session IDs, full local paths, or auth files;
- real SQLite databases, logs, environment files, certificates, or signing
  material.

Use fake or synthetic values only. If sanitization would make the report unsafe,
stop and use private vulnerability reporting.

## Support boundaries

Maintainers can help with MoneySiren behavior and documentation. They cannot:

- recover or inspect credentials;
- access a provider account;
- resolve provider billing disputes;
- accept credential uploads or raw payloads;
- guarantee response or resolution times;
- support provider write actions outside MoneySiren's read-only scope.

Best-effort response targets are documented in GOVERNANCE.md.
