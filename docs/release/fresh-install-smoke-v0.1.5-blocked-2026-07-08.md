# Fresh Install Smoke: v0.1.5 — BLOCKED

Date: 2026-07-08 KST  
Status: preserved historical evidence  
Scope: isolated Windows npm global install into .tmp/fresh-install-* directories

This run used fake local mock data only. It did not include provider credentials,
webhook URLs, account or project IDs, local AI content, raw JSONL, or auth files.

## Commands

    npm install -g @moneysiren/app --prefix .tmp\fresh-install-prefix
    msiren --version
    msiren install --status
    msiren doctor
    msiren sync --provider mock
    msiren start --no-open --port 3210

## Results

| Check | Result | Evidence |
|---|---:|---|
| npm global install | PASS | @moneysiren/app installed into the isolated prefix. |
| PATH command shim | PASS | msiren shims were created. |
| Version | PASS | msiren --version printed 0.1.5. |
| Install status | PASS | Status was not configured; CLI, web, and HUD were selected by default. |
| Doctor | PASS | Local readiness returned without secret values. |
| Mock sync | PASS | usage=1 billing=1 health=1 estimates=1 alerts=0. |
| Start dashboard | BLOCKED | No installed web runtime asset was found. |
| Strict postinstall asset fetch | BLOCKED | ztwz11/moneysiren@v0.1.5 returned 404 at the time of this run. |

## Blocker at observation time

The npm package installed the CLI command, but the matching v0.1.5 GitHub
Release web runtime was not available during this smoke run. The result proves
only the state observed at that time.

A later Release page showing an asset does not retroactively convert this run
to PASS. A new isolated public-registry smoke must create a separate PASS
document.

## Required rerun

    npm install -g @moneysiren/app@0.1.5 --prefix <isolated-prefix>
    msiren --version
    msiren install --status
    msiren doctor
    msiren install --web
    msiren sync --provider mock
    msiren start --no-open --port <ephemeral-port>
    GET http://127.0.0.1:<port>/api/local/health
    msiren stop
    node tools/scripts/check-release-readiness.mjs --tag v0.1.5

When that rerun succeeds, create:

    docs/release/fresh-install-smoke-v0.1.5-pass-YYYY-MM-DD.md

and link it here. Do not edit the historical results above.

## Safety

- No provider write API was called.
- No hosted MoneySiren service was used.
- No telemetry was enabled.
- No secrets or raw local AI content were returned.
