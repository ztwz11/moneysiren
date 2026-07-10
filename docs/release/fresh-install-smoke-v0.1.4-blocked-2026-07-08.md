# Fresh Install Smoke: v0.1.4 — BLOCKED

Date: 2026-07-08 KST  
Status: preserved historical evidence

This isolated Windows npm global-install smoke used fake local mock data only.

## Results

| Check | Result |
|---|---:|
| npm global install | PASS |
| PATH command shims | PASS |
| msiren --version reported 0.1.4 | PASS |
| msiren install --status | PASS |
| msiren doctor | PASS |
| mock sync | PASS |
| source-free dashboard start | BLOCKED |
| strict postinstall release-asset fetch | BLOCKED |

At observation time, @moneysiren/app@0.1.4 installed the CLI, but no matching
v0.1.4 GitHub Release web runtime existed. The strict asset fetch returned 404.

This version was tagged but no GitHub Release was published. Preserve this
document as historical evidence; do not rewrite it as PASS.

## Commands used

    npm install -g @moneysiren/app --prefix .tmp\fresh-install-prefix
    msiren --version
    msiren install --status
    msiren doctor
    msiren sync --provider mock
    msiren start --no-open --port 3210

## Safety

- No provider credentials, identifiers, payloads, local AI content, JSONL, auth
  files, or webhook URLs were used.
- No provider write API was called.
- No telemetry or hosted MoneySiren service was used.
