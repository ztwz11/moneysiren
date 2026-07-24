# MoneySiren CLI

Public packaging metadata for `moneysiren`.

MoneySiren is local-first. The CLI reads configuration and secrets from the process environment only, writes normalized data to local SQLite, and does not enable telemetry by default.

## Requirements

- Node.js 22.13 or newer.
- MoneySiren uses the Node SQLite runtime when available. `sqlite3` on `PATH` or `MONEYSIREN_SQLITE_BIN` is an optional fallback.
- No live provider credentials are required for `moneysiren --version`, `moneysiren doctor`, or `moneysiren sync --provider mock`.

## Published Usage

For normal source-free installs, prefer the app package because it downloads the matching web runtime during global npm install. HUD artifacts require signed release metadata by default; before signing is ready, unsigned HUD smoke testing requires explicit local opt-in:

```bash
npm install -g @moneysiren/app
msiren start
msiren hud
```

For CLI-only automation:

```bash
npm install -g @moneysiren/cli
moneysiren
moneysiren --version
moneysiren /version
moneysiren install --status
moneysiren install --all
moneysiren modes
moneysiren /modes
moneysiren doctor
moneysiren /doctor
moneysiren dashboard check
```

During a PowerShell, cmd, or shell install with an interactive TTY, `postinstall` prompts for the local surfaces to enable:

- CLI
- Web dashboard
- HUD

Press Enter to accept the recommended default, which selects all three. In CI or non-interactive npm installs, MoneySiren writes that all-selected profile automatically. Run `moneysiren install --all` to download GitHub Release assets for the web runtime and HUD desktop shell. Use `moneysiren install --profile-only` to change only the local profile, or `moneysiren install --status` to inspect it.

One-off execution:

```bash
npx --package @moneysiren/cli moneysiren
npx --package @moneysiren/cli moneysiren --version
npx --package @moneysiren/cli moneysiren /version
npx --package @moneysiren/cli moneysiren modes
npx --package @moneysiren/cli moneysiren doctor
npx --package @moneysiren/cli moneysiren /doctor
npx --package @moneysiren/cli moneysiren dashboard check
npx --package @moneysiren/cli moneysiren sync --provider aws --profile <profile>
```

`aws sso login --profile <profile>` refreshes AWS SSO credentials, but it does not set `AWS_PROFILE` in the current shell. Pass `--profile <profile>` or export `AWS_PROFILE` before live AWS sync.

## Local Tarball Review

From the repository root:

```bash
pnpm --filter moneysiren build
cd apps/cli
npm pack
```

Install the generated tarball into a temporary project:

```bash
mkdir -p /tmp/moneysiren-release-review
cd /tmp/moneysiren-release-review
npm init -y
npm install /path/to/moneysiren-cli-0.1.7.tgz
npm exec moneysiren
npm exec moneysiren -- --version
npm exec moneysiren -- /version
npm exec moneysiren -- modes
npm exec moneysiren -- doctor
npm exec moneysiren -- /doctor
npm exec moneysiren -- dashboard check
```

PowerShell equivalent for the temporary project:

```powershell
New-Item -ItemType Directory -Force -Path $env:TEMP\moneysiren-release-review
Set-Location $env:TEMP\moneysiren-release-review
npm init -y
npm install C:\path\to\moneysiren-cli-0.1.7.tgz
npm exec moneysiren
npm exec moneysiren -- --version
npm exec moneysiren -- modes
npm exec moneysiren -- /doctor
```

Do not create `.env`, paste real API keys, or write Slack webhook URLs into local project files. Fixture mode and `mock` sync are the intended no-credentials review paths.

Live provider sync is read-only and env-only. Use fixture mode for no-credentials review; export live credentials only in the shell for one run.

## Publishing

From the repository root:

```bash
npm run publish:cli:dry-run
npm run publish:cli:latest
```

The dry run checks the full secret scan, package metadata, npm registry version availability, and tarball contents. The publish command requires `npm login` in the local terminal and publishes this package with the `latest` tag and public access.

If npm requires passkey or browser approval, complete the URL printed by npm and rerun the publish command. For CI publishing, add a granular npm token with publish access and bypass 2FA enabled as the `NPM_TOKEN` GitHub repository secret, then run the `npm-publish-cli` workflow manually.

## Slash Home

Running `moneysiren` without subcommands prints a readable slash-command home guide. In a TTY it may enter a minimal line-based slash prompt; in CI or non-TTY package review it prints the guide and exits `0`.

Supported slash aliases:

```bash
moneysiren /help
moneysiren /version
moneysiren /doctor
moneysiren /install
moneysiren /modes
moneysiren /init
moneysiren /dashboard
moneysiren /dashboard check
moneysiren /sync mock
moneysiren /sync aws
moneysiren /sync openai
moneysiren /sync supabase
moneysiren /sync cloudflare
moneysiren /report ko
moneysiren /quit
```

Slash aliases are thin wrappers around the existing CLI commands. Home/help does not call provider APIs, read secret values, create `.env`, or enable telemetry. ANSI color respects `NO_COLOR`, `FORCE_COLOR`, and `TERM=dumb`.

## Runtime Modes

`moneysiren modes` prints the three supported surfaces after an npm install:

- CLI automation from the npm package.
- Local web dashboard/runtime, with `moneysiren serve` providing the sanitized local API runtime.
- Desktop tray/notifier status and notification preview commands, while the native Tauri tray binary remains a separate repo/native build artifact for this initial public local release.

The mode list includes the local install profile selected by npm `postinstall` or `moneysiren install`.

The shared runtime lock defaults to `%APPDATA%\MoneySiren\runtime.json` on Windows and `~/Library/Application Support/MoneySiren/runtime.json` on macOS so a globally installed CLI and the desktop tray can discover the same local runtime. Set `MONEYSIREN_RUNTIME_LOCK_PATH` only when you intentionally need an isolated runtime lock for testing.

## Dashboard Check

`moneysiren dashboard check` probes `http://localhost:3000/api/dashboard` by default and reports the sanitized dashboard URL, API status, local DB path/existence, payload source, provider count, and generated time.

Use `--url` only for a local dashboard origin:

```bash
moneysiren dashboard check --url http://localhost:3000
```

Path, query, and hash values are ignored before printing or probing, and URLs with credentials are rejected. The command does not package, start, or serve the Next.js dashboard; from this repository, start it with `pnpm --filter @moneysiren/web dev`.
