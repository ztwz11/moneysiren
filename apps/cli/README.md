# StackSpend CLI

Public alpha packaging metadata for `@stackspend/cli`.

StackSpend is local-first. The CLI reads configuration and secrets from the process environment only, writes normalized data to local SQLite, and does not enable telemetry by default.

## Requirements

- Node.js 20.11 or newer.
- StackSpend uses the Node SQLite runtime when available. `sqlite3` on `PATH` or `STACKSPEND_SQLITE_BIN` is an optional fallback.
- No live provider credentials are required for `stackspend --version`, `stackspend doctor`, or `stackspend sync --provider mock`.

## Published Alpha Usage

The package is prepared for a public npm alpha, but this repository task does not publish it.

After an alpha is published:

```bash
npm install -g @stackspend/cli@alpha
stackspend
stackspend --version
stackspend /version
stackspend install --status
stackspend modes
stackspend /modes
stackspend doctor
stackspend /doctor
stackspend dashboard check
```

During a PowerShell, cmd, or shell install with an interactive TTY, `postinstall` prompts for the local surfaces to enable:

- CLI
- Web dashboard
- HUD

Press Enter to accept the recommended default, which selects all three. In CI or non-interactive npm installs, StackSpend writes that all-selected profile automatically. Re-run `stackspend install` later to change the profile, or use `stackspend install --status` to inspect it.

One-off execution:

```bash
npx --package @stackspend/cli@alpha stackspend
npx --package @stackspend/cli@alpha stackspend --version
npx --package @stackspend/cli@alpha stackspend /version
npx --package @stackspend/cli@alpha stackspend modes
npx --package @stackspend/cli@alpha stackspend doctor
npx --package @stackspend/cli@alpha stackspend /doctor
npx --package @stackspend/cli@alpha stackspend dashboard check
npx --package @stackspend/cli@alpha stackspend sync --provider aws --profile <profile>
```

`aws sso login --profile <profile>` refreshes AWS SSO credentials, but it does not set `AWS_PROFILE` in the current shell. Pass `--profile <profile>` or export `AWS_PROFILE` before live AWS sync.

## Local Tarball Review

From the repository root:

```bash
pnpm --filter @stackspend/cli build
cd apps/cli
npm pack
```

Install the generated tarball into a temporary project:

```bash
mkdir -p /tmp/stackspend-alpha-review
cd /tmp/stackspend-alpha-review
npm init -y
npm install /path/to/stackspend-cli-0.1.0-alpha.0.tgz
npm exec stackspend
npm exec stackspend -- --version
npm exec stackspend -- /version
npm exec stackspend -- modes
npm exec stackspend -- doctor
npm exec stackspend -- /doctor
npm exec stackspend -- dashboard check
```

PowerShell equivalent for the temporary project:

```powershell
New-Item -ItemType Directory -Force -Path $env:TEMP\stackspend-alpha-review
Set-Location $env:TEMP\stackspend-alpha-review
npm init -y
npm install C:\path\to\stackspend-cli-0.1.0-alpha.0.tgz
npm exec stackspend
npm exec stackspend -- --version
npm exec stackspend -- modes
npm exec stackspend -- /doctor
```

Do not create `.env`, paste real API keys, or write Slack webhook URLs into local project files. Fixture mode and `mock` sync are the intended no-credentials review paths.

Live provider sync is read-only and env-only. Use fixture mode for no-credentials review; export live credentials only in the shell for one run.

## Slash Home

Running `stackspend` without subcommands prints a readable slash-command home guide. In a TTY it may enter a minimal line-based slash prompt; in CI or non-TTY package review it prints the guide and exits `0`.

Supported slash aliases:

```bash
stackspend /help
stackspend /version
stackspend /doctor
stackspend /install
stackspend /modes
stackspend /init
stackspend /dashboard
stackspend /dashboard check
stackspend /sync mock
stackspend /sync aws
stackspend /sync openai
stackspend /sync supabase
stackspend /sync cloudflare
stackspend /report ko
stackspend /quit
```

Slash aliases are thin wrappers around the existing CLI commands. Home/help does not call provider APIs, read secret values, create `.env`, or enable telemetry. ANSI color respects `NO_COLOR`, `FORCE_COLOR`, and `TERM=dumb`.

## Runtime Modes

`stackspend modes` prints the three supported surfaces after an npm install:

- CLI automation from the npm package.
- Local web dashboard/runtime, with `stackspend serve` providing the sanitized local API runtime.
- Desktop tray/notifier status and notification preview commands, while the native Tauri tray binary remains a separate repo/native build artifact for this alpha.

The mode list includes the local install profile selected by npm `postinstall` or `stackspend install`.

The shared runtime lock defaults to `%APPDATA%\StackSpend\runtime.json` on Windows and `~/Library/Application Support/StackSpend/runtime.json` on macOS so a globally installed CLI and the desktop tray can discover the same local runtime. Set `STACKSPEND_RUNTIME_LOCK_PATH` only when you intentionally need an isolated runtime lock for testing.

## Dashboard Check

`stackspend dashboard check` probes `http://localhost:3000/api/dashboard` by default and reports the sanitized dashboard URL, API status, local DB path/existence, payload source, provider count, and generated time.

Use `--url` only for a local dashboard origin:

```bash
stackspend dashboard check --url http://localhost:3000
```

Path, query, and hash values are ignored before printing or probing, and URLs with credentials are rejected. The command does not package, start, or serve the Next.js dashboard; from this repository, start it with `pnpm --filter @stackspend/web dev`.
