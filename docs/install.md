# Windows and macOS Install Guide

MoneySiren is a local-first cloud, SaaS, and AI usage dashboard. The alpha has three local surfaces:

- CLI automation through `moneysiren` or the shorter `msiren` alias.
- Local web dashboard through Next.js.
- Desktop tray/notifier and HUD through the native Tauri shell.

The recommended npm app alpha installs all three surfaces without cloning this repository. It creates the command aliases and downloads source-free alpha artifacts for the built web dashboard runtime and native desktop tray/HUD shell from GitHub Releases.

## Requirements

Use Node.js 20.11 or newer for source-free npm installs.

Required for `npm install -g @moneysiren/app@alpha`:

- Node.js 20.11 or newer.

Required only for source development:

- Node.js 20.11 or newer.
- pnpm 11.5.0 through Corepack.
- Git.
- Node.js with the SQLite runtime, or `sqlite3` on `PATH`/`MONEYSIREN_SQLITE_BIN` as a fallback.

Required only when building the native desktop tray/HUD from source:

- Rust and Cargo.
- Windows: WebView2 Runtime and Visual Studio Build Tools with the Desktop development with C++ workload.
- macOS: Xcode Command Line Tools, or Xcode.

Do not create `.env` files with live credentials. For v0.1, use process-local environment variables only.

## Install The App From npm

For normal source-free installs, install the app package with npm.

Windows PowerShell:

```powershell
npm install -g @moneysiren/app@alpha
msiren --version
msiren install --status
msiren modes
msiren doctor
msiren sync --provider mock
msiren start
msiren hud
```

macOS zsh:

```bash
npm install -g @moneysiren/app@alpha
msiren --version
msiren install --status
msiren modes
msiren doctor
msiren sync --provider mock
msiren start
msiren hud
```

During global npm installs, `@moneysiren/app` creates the command aliases and runs `msiren install --all` so the matching GitHub Release web runtime and HUD desktop shell are downloaded immediately. The app package creates both command aliases during postinstall:

- `moneysiren`
- `msiren`

If npm reports `EEXIST` for `moneysiren` or `msiren`, an older alpha `@moneysiren/app` with npm-managed bin aliases may still be installed. Remove the old global packages and reinstall:

```powershell
npm uninstall -g @moneysiren/cli @moneysiren/app
npm install -g @moneysiren/app@alpha --force
```

If Web/HUD asset download fails during postinstall, npm still installs the command. Fix network or release access, then rerun:

```bash
msiren install --all
msiren install --status
```

For CLI-only automation, install `@moneysiren/cli@alpha` instead. Run `msiren install --all` only when Web/HUD assets are needed.

`msiren modes` should show the selected install profile plus the CLI, local web dashboard/runtime, and desktop tray/notifier surfaces. The same source tree supports Windows and macOS; npm installs the cross-platform command surface, while native tray/HUD artifacts are built per OS.

## Install Desktop Alpha Without Cloning Source

GitHub Releases publish three source-free artifact types:

- `moneysiren-web-runtime-*.tar.gz`: the built local Next.js dashboard runtime.
- Windows installer: signed Tauri NSIS `.exe` when release signing credentials are configured.
- macOS app archive: signed and notarized Tauri `.app` inside `.tar.gz` when Apple release signing credentials are configured.

Install the app package first:

```bash
npm install -g @moneysiren/app@alpha
msiren sync --provider mock
msiren start
msiren hud
```

`@moneysiren/app` bundles the CLI command and runs `msiren install --all` during global npm installs. That downloads the web runtime archive and the current OS desktop/HUD artifact from GitHub Releases. By default, the files are stored in the MoneySiren local application data directory. `msiren start` extracts and starts the installed web runtime, then opens the local dashboard. `msiren hud` ensures that runtime is running and launches the desktop HUD shell when a runnable desktop app is installed or configured.

For CLI-only automation, install `@moneysiren/cli@alpha` instead and run `msiren install --all` later if Web/HUD assets are needed.

To pin a release tag or choose a directory:

```bash
msiren install --all --tag v0.1.0-alpha.39 --dir ./moneysiren-release
```

If the desktop installer was installed to a non-default location, point the CLI at it before opening HUD:

```bash
MONEYSIREN_DESKTOP_APP="<path-to-installed-MoneySiren-app>" msiren hud
```

The web runtime listens at `http://127.0.0.1:3000` by default. The native shell opens the dashboard and HUD from that local address.

This alpha desktop shell is still a thin local shell. The CLI owns the source-free startup path, while Windows and macOS may warn when using older unsigned alpha artifacts or local unsigned builds.

MoneySiren is prepared to use the SignPath Foundation program for open-source Windows code signing. When a Windows Release artifact is signed through the SignPath Foundation, the GitHub Release notes and this install guide will identify that signature path so users can distinguish signed desktop artifacts from local unsigned builds.

## Install From Source On Windows

Install prerequisites:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install SQLite.SQLite
winget install Rustlang.Rustup
winget install Microsoft.EdgeWebView2Runtime
```

Install Visual Studio Build Tools 2022 with the Desktop development with C++ workload if you want to build the native tray.

Clone and install:

```powershell
git clone https://github.com/ztwz11/moneysiren.git
cd moneysiren
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install
```

Create a local SQLite database and seed safe demo data:

```powershell
New-Item -ItemType Directory -Force .moneysiren | Out-Null
$root = (Get-Location).Path
$env:MONEYSIREN_DB_PATH = Join-Path $root ".moneysiren\moneysiren.sqlite"

pnpm --filter moneysiren dev -- init
pnpm --filter moneysiren dev -- sync --provider mock

$env:MONEYSIREN_AWS_COST_EXPLORER_FIXTURE = Join-Path $root "tests\fixtures\providers\aws\cost-explorer-grouped-by-service.json"
$env:MONEYSIREN_OPENAI_USAGE_FIXTURE = Join-Path $root "tests\fixtures\providers\openai\usage-costs.json"
$env:MONEYSIREN_OPENAI_COSTS_FIXTURE = Join-Path $root "tests\fixtures\providers\openai\usage-costs.json"
$env:MONEYSIREN_SUPABASE_FIXTURE = Join-Path $root "tests\fixtures\providers\supabase\usage-health.json"
$env:MONEYSIREN_CLOUDFLARE_FIXTURE = Join-Path $root "tests\fixtures\providers\cloudflare\billing-usage.json"

pnpm --filter moneysiren dev -- sync --provider aws
pnpm --filter moneysiren dev -- sync --provider openai
pnpm --filter moneysiren dev -- sync --provider supabase
pnpm --filter moneysiren dev -- sync --provider cloudflare
```

Run the web dashboard with fake connection labels for demo display only:

```powershell
$env:AWS_PROFILE = "FAKE_MONEYSIREN_INSTALL_GUIDE_PROFILE"
$env:OPENAI_ADMIN_KEY = "FAKE_MONEYSIREN_INSTALL_GUIDE_OPENAI_ADMIN_KEY"
$env:SUPABASE_ACCESS_TOKEN = "FAKE_MONEYSIREN_INSTALL_GUIDE_SUPABASE_ACCESS_TOKEN"
$env:CLOUDFLARE_API_TOKEN = "FAKE_MONEYSIREN_INSTALL_GUIDE_CLOUDFLARE_API_TOKEN"
$env:CLOUDFLARE_ACCOUNT_IDS = "FAKE_MONEYSIREN_INSTALL_GUIDE_ACCOUNT_ID"

npm run dev:web
```

For live AWS SSO, `aws sso login --profile <profile>` refreshes the SSO cache but does not set `AWS_PROFILE` in the current shell. Use `pnpm --filter moneysiren dev -- sync --provider aws --profile <profile>` or set `$env:AWS_PROFILE` before syncing.

Open:

- `http://127.0.0.1:3000/en/dashboard/overview`
- `http://127.0.0.1:3000/hud?locale=en`

Run the native tray/HUD during development:

```powershell
npm run dev
```

Build an unsigned Windows desktop installer:

```powershell
npm run build:native
Get-ChildItem apps\tray\src-tauri\target\release\bundle\nsis\*.exe
```

The exact installer filename can change by version.

## Install From Source On macOS

Install prerequisites:

```bash
xcode-select --install
brew install node git sqlite
corepack enable
corepack prepare pnpm@11.5.0 --activate
```

Install Rust from `https://rustup.rs/`, then restart the terminal or source Cargo's env file.

Clone and install:

```bash
git clone https://github.com/ztwz11/moneysiren.git
cd moneysiren
pnpm install
```

Create a local SQLite database and seed safe demo data:

```bash
mkdir -p .moneysiren
export MONEYSIREN_ROOT="$PWD"
export MONEYSIREN_DB_PATH="$MONEYSIREN_ROOT/.moneysiren/moneysiren.sqlite"

pnpm --filter moneysiren dev -- init
pnpm --filter moneysiren dev -- sync --provider mock

export MONEYSIREN_AWS_COST_EXPLORER_FIXTURE="$MONEYSIREN_ROOT/tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json"
export MONEYSIREN_OPENAI_USAGE_FIXTURE="$MONEYSIREN_ROOT/tests/fixtures/providers/openai/usage-costs.json"
export MONEYSIREN_OPENAI_COSTS_FIXTURE="$MONEYSIREN_ROOT/tests/fixtures/providers/openai/usage-costs.json"
export MONEYSIREN_SUPABASE_FIXTURE="$MONEYSIREN_ROOT/tests/fixtures/providers/supabase/usage-health.json"
export MONEYSIREN_CLOUDFLARE_FIXTURE="$MONEYSIREN_ROOT/tests/fixtures/providers/cloudflare/billing-usage.json"

pnpm --filter moneysiren dev -- sync --provider aws
pnpm --filter moneysiren dev -- sync --provider openai
pnpm --filter moneysiren dev -- sync --provider supabase
pnpm --filter moneysiren dev -- sync --provider cloudflare
```

Run the web dashboard with fake connection labels for demo display only:

```bash
export AWS_PROFILE="FAKE_MONEYSIREN_INSTALL_GUIDE_PROFILE"
export OPENAI_ADMIN_KEY="FAKE_MONEYSIREN_INSTALL_GUIDE_OPENAI_ADMIN_KEY"
export SUPABASE_ACCESS_TOKEN="FAKE_MONEYSIREN_INSTALL_GUIDE_SUPABASE_ACCESS_TOKEN"
export CLOUDFLARE_API_TOKEN="FAKE_MONEYSIREN_INSTALL_GUIDE_CLOUDFLARE_API_TOKEN"
export CLOUDFLARE_ACCOUNT_IDS="FAKE_MONEYSIREN_INSTALL_GUIDE_ACCOUNT_ID"

npm run dev:web
```

For live AWS SSO, `aws sso login --profile <profile>` refreshes the SSO cache but does not set `AWS_PROFILE` in the current shell. Use `pnpm --filter moneysiren dev -- sync --provider aws --profile <profile>` or export `AWS_PROFILE` before syncing.

Open:

- `http://127.0.0.1:3000/en/dashboard/overview`
- `http://127.0.0.1:3000/hud?locale=en`

Run the native tray/HUD during development:

```bash
npm run dev
```

Build an unsigned macOS desktop app:

```bash
npm run build:native
open "apps/tray/src-tauri/target/release/bundle/macos/MoneySiren Tray.app"
```

If macOS blocks the unsigned alpha app, use Finder, right-click the app, and choose Open. Do not use this unsigned build as a distribution artifact.

## Maintainer Desktop Release

The `desktop-release` GitHub Actions workflow builds source-free alpha assets for GitHub Releases:

- Windows NSIS installer from the Windows runner.
- macOS `.app` archive from the macOS runner.
- Web runtime archive from the Linux runner.

Before creating a public desktop release, configure signing secrets outside the repository. Windows needs a trusted code-signing PFX/P12 certificate; self-signed certificates are useful only for local smoke tests and do not fix public Windows publisher trust warnings.

Prepare the Windows certificate payload without printing it to the terminal:

```bash
npm run release:signing:encode-windows -- "<path-to-windows-code-signing.pfx>"
```

Set GitHub repository secrets:

- `WINDOWS_CERTIFICATE`: contents of `.tmp/codesign/windows-certificate.base64.txt`.
- `WINDOWS_CERTIFICATE_PASSWORD`: the PFX/P12 password.

Then verify the local signing inputs:

PowerShell:

```powershell
$env:WINDOWS_CERTIFICATE_PASSWORD = "<pfx-or-p12-password>"
npm run release:signing:check -- windows
```

Bash/zsh:

```bash
WINDOWS_CERTIFICATE_PASSWORD="<pfx-or-p12-password>" npm run release:signing:check -- windows
```

Create or update a prerelease from a tag:

```bash
git tag v0.1.0-alpha.39
git push origin v0.1.0-alpha.39
```

Or run the workflow manually from GitHub Actions with a release tag. If only one signing identity is ready, set `desktop_targets` to `windows` or `macos`; skipped desktop assets are removed from the updated GitHub Release so stale unsigned desktop artifacts do not remain published. The workflow uploads SHA256 checksum files and Windows signature metadata next to the release artifacts when signing is configured.

Alpha releases can publish unsigned HUD artifacts when signing secrets are not ready. Keep unsigned validation explicit:

```bash
npm run release:check -- v0.1.0-alpha.39 --allow-unsigned-prerelease-windows
```

The CLI accepts unsigned HUD artifacts only for prerelease tags such as `alpha`; set `MONEYSIREN_ALLOW_UNSIGNED_HUD=false` to require signed HUD metadata even for alpha builds.

## English Mock Screenshots

The following screenshots were regenerated from a fresh fixture-backed SQLite database seeded by the commands above. The fake environment values only mark providers as connected for the local UI; no live provider credentials, provider account identifiers, webhook URLs, or local Codex/Claude session data are included.

Dashboard overview:

![MoneySiren English mock dashboard](assets/install/moneysiren-english-mock-dashboard.png)

CLI dashboard field settings:

![MoneySiren English CLI dashboard field settings](assets/install/moneysiren-english-mock-dashboard-settings.png)

Desktop HUD:

![MoneySiren English mock HUD](assets/install/moneysiren-english-mock-hud.png)

Notification and HUD settings:

![MoneySiren English notification and HUD settings](assets/install/moneysiren-english-mock-hud-settings.png)

## Korean Mock Screenshots

The following screenshots use the same fixture-backed SQLite database and Korean UI routes. The fake environment values only mark providers as connected for the local UI; no live provider credentials, provider account identifiers, webhook URLs, or local Codex/Claude session data are included.

Dashboard overview:

![MoneySiren Korean mock dashboard](assets/install/moneysiren-korean-mock-dashboard.png)

CLI dashboard field settings:

![MoneySiren Korean CLI dashboard field settings](assets/install/moneysiren-korean-mock-dashboard-settings.png)

Desktop HUD:

![MoneySiren Korean mock HUD](assets/install/moneysiren-korean-mock-hud.png)

Notification and HUD settings:

![MoneySiren Korean notification and HUD settings](assets/install/moneysiren-korean-mock-hud-settings.png)

## Validation

For a local source checkout, run:

```bash
pnpm test
pnpm typecheck
git diff --check
```

For a narrower documentation-only change, at minimum run:

```bash
git diff --check -- README.md docs/install.md
```

## Security Notes

- Fixture sync commands use committed fake payloads under `tests/fixtures/providers`.
- The `FAKE_MONEYSIREN_INSTALL_GUIDE_*` values are examples only.
- Do not commit `.env`, API keys, account IDs, project IDs, invoice IDs, card data, emails from provider payloads, raw billing profiles, or webhook URLs.
- Provider connectors must remain read-only.
- Telemetry is off by default.
