# Troubleshooting

Use fake or redacted examples when filing issues. Do not paste API keys, OAuth tokens, webhook URLs, provider account IDs, project IDs, invoice IDs, emails, raw provider responses, local AI prompt text, shell command bodies, raw JSONL lines, or auth file contents.

## OpenAI ADMIN API Key Is Set But MoneySiren Says Not Configured

MoneySiren must be able to see `OPENAI_ADMIN_KEY` from the server or CLI process that is doing the read-only check.

On Windows and PowerShell, setting an environment variable after the MoneySiren server has already started does not update that running server process. Start MoneySiren from a shell where the key is already visible, or save the key from Connections as a local read-only credential.

Useful checks:

```powershell
$env:OPENAI_ADMIN_KEY
msiren sync --provider openai
msiren restart
```

Do not paste the key into GitHub issues, screenshots, logs, fixtures, or docs.

## `msiren start` Says No Web Runtime Is Installed

`@moneysiren/app` installs the `moneysiren` and `msiren` commands first. The local web dashboard runtime is a matching GitHub Release asset and must also be installed.

Run:

```bash
msiren install --web
msiren doctor
msiren sync --provider mock
msiren start
```

If `msiren install --web` reports `404 Not Found` for a release such as `ztwz11/moneysiren@v0.1.7-beta.9`, the npm command package is installed but the matching source-free dashboard runtime asset is not available on GitHub Releases for that tag. Use the source setup in `docs/install.md` until the release asset is published.

Do not work around this by pasting provider credentials into issue reports. Include only the MoneySiren version, OS, command names, and sanitized error summary.

## Codex App Is Connected But Codex CLI Warning Appears

MoneySiren models Codex App and Codex CLI as local usage surfaces. In the operations dashboard, they should be merged into one visible `Codex` row when either surface has healthy local usage data.

One inactive secondary surface should not degrade the merged row's health, risk, canonical freshness, live freshness, missing env state, or remediation state. If this warning appears incorrectly, report:

- MoneySiren version;
- OS;
- whether the visible row is Codex App, Codex CLI, or merged Codex;
- sanitized `/api/operations-dashboard` status shape.

Do not include raw Codex logs, prompt text, shell command bodies, auth files, or raw JSONL lines.

## AWS_PROFILE Is Configured But AWS Is Not Ready

MoneySiren must be started from a process that can see `AWS_PROFILE` or the AWS SDK default credential chain.

If you use AWS IAM Identity Center / SSO, confirm login state in the same shell:

```powershell
aws sso login --profile <profile-name>
$env:AWS_PROFILE = "<profile-name>"
msiren sync --provider aws
```

The profile needs read-only Cost Explorer access such as cost and usage reads. MoneySiren does not modify AWS resources.

## Emergency Readiness Does Not Execute Actions

MoneySiren emergency readiness is manual-first and local-only. It does not call provider write APIs.

MoneySiren does not:

- stop AWS instances;
- disable Cloudflare Workers;
- revoke OpenAI keys;
- pause Supabase projects;
- execute emergency action buttons.

It provides readiness state, official provider links, manual checklists, and local audit records so the user can decide what to do in the provider console.

## Live Data Is Stale

Canonical sync and live refresh are different:

- canonical sync writes normalized local SQLite snapshots;
- live refresh is provisional and may be shorter-lived;
- local AI usage overlays can be fresh, stale, or empty depending on local metadata availability.

Run a canonical sync when a provider needs a durable local snapshot:

```bash
msiren sync --provider <provider>
```

Use the dashboard refresh control for live data, then inspect connection diagnostics if freshness still looks wrong.

## Windows Environment Variables

PowerShell variables set with `$env:KEY = "..."` apply to the current shell and child processes started after the assignment. They do not update a MoneySiren server that was already running.

For provider setup:

1. Stop the current MoneySiren runtime.
2. Open a new shell.
3. Set the environment variable.
4. Start or sync MoneySiren from that same shell.

Example:

```powershell
msiren stop
$env:AWS_PROFILE = "<profile-name>"
msiren start
```

Use local read-only credential storage from Connections when you do not want to depend on shell environment state.
