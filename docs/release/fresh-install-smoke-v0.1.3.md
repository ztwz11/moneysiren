# Fresh Install Smoke: v0.1.4

Date: 2026-07-08 KST

Scope: isolated Windows npm global install into `.tmp/fresh-install-*` directories. The smoke run used fake local mock data only and did not include provider credentials, webhook URLs, account IDs, project IDs, local AI prompt text, shell command bodies, raw JSONL logs, or auth files.

## Commands

```powershell
npm install -g @moneysiren/app --prefix .tmp\fresh-install-prefix
msiren --version
msiren install --status
msiren doctor
msiren sync --provider mock
msiren start --no-open --port 3210
```

## Results

| Check | Result | Evidence |
|---|---:|---|
| npm global install | PASS | `@moneysiren/app` installed into the isolated prefix. |
| PATH command shim | PASS | `msiren`, `msiren.cmd`, and `msiren.ps1` shims were created. |
| Version | PASS | `msiren --version` printed `0.1.4`. |
| Install status | PASS | `msiren install --status` returned `Status: not configured` with CLI, Web dashboard, and HUD selected by default. |
| Doctor | PASS | `msiren doctor` returned local readiness without secret values. |
| Mock sync | PASS | `usage=1 billing=1 health=1 estimates=1 alerts=0`. |
| Start dashboard | BLOCKED | `msiren start --no-open --port 3210` could not find an installed web runtime asset. |
| Strict postinstall release asset fetch | BLOCKED | `MONEYSIREN_APP_STRICT_POSTINSTALL=1 npm install -g @moneysiren/app` failed because `ztwz11/moneysiren@v0.1.4` returned `404 Not Found`. |

## Blocker

`@moneysiren/app@0.1.4` installs the CLI command successfully, but the matching GitHub Release web runtime asset was not available for `v0.1.4` during this smoke run. External users can run CLI-only commands and fixture sync, but source-free `msiren start` remains blocked until a matching GitHub Release web runtime is published.

## Next Action

Publish or repair the `v0.1.4` GitHub Release assets, or cut a new patch tag with matching web runtime assets. After that, rerun:

```powershell
npm install -g @moneysiren/app --prefix .tmp\fresh-install-prefix
msiren doctor
msiren install --web
msiren sync --provider mock
msiren start --no-open --port 3210
```

## Safety Notes

- No provider write APIs were called.
- No hosted MoneySiren service was used.
- No telemetry was enabled.
- No secrets were returned.
