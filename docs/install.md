# Windows and macOS Install Guide

StackSpend is a local-first cloud, SaaS, and AI usage dashboard. The alpha has three local surfaces:

- CLI automation through `stackspend`.
- Local web dashboard through Next.js.
- Desktop tray/notifier and HUD through the native Tauri shell.

The npm alpha installs the CLI surface. The web dashboard and native tray/HUD are run from source until signed desktop installers are published.

## Requirements

Use Node.js 20.11 or newer and pnpm 11.5.0.

Required for the CLI and web dashboard:

- Node.js 20.11 or newer.
- pnpm 11.5.0 through Corepack.
- Git.
- Node.js with the SQLite runtime, or `sqlite3` on `PATH`/`STACKSPEND_SQLITE_BIN` as a fallback.

Required for the native desktop tray/HUD:

- Rust and Cargo.
- Windows: WebView2 Runtime and Visual Studio Build Tools with the Desktop development with C++ workload.
- macOS: Xcode Command Line Tools, or Xcode.

Do not create `.env` files with live credentials. For v0.1, use process-local environment variables only.

## Install The CLI From npm

After `@stackspend/cli@alpha` is published, install the CLI with npm.

Windows PowerShell:

```powershell
npm install -g @stackspend/cli@alpha
stackspend --version
stackspend install --status
stackspend modes
stackspend doctor
stackspend sync --provider mock
```

macOS zsh:

```bash
npm install -g @stackspend/cli@alpha
stackspend --version
stackspend install --status
stackspend modes
stackspend doctor
stackspend sync --provider mock
```

During a PowerShell, cmd, or shell install with an interactive TTY, npm `postinstall` asks which local surfaces to enable:

- CLI
- Web dashboard
- HUD

Press Enter to accept the recommended default, which selects all three. In CI or non-interactive npm installs, StackSpend writes that same all-selected profile automatically. Re-run `stackspend install` to change the profile later.

`stackspend modes` should show the selected install profile plus the CLI, local web dashboard/runtime, and desktop tray/notifier surfaces. The same source tree supports Windows and macOS; npm installs the cross-platform CLI, while native tray/HUD artifacts are built per OS. The npm CLI does not install the native desktop app yet.

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
git clone https://github.com/ztwz11/stackspend.git
cd stackspend
corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm install
```

Create a local SQLite database and seed safe demo data:

```powershell
New-Item -ItemType Directory -Force .stackspend | Out-Null
$root = (Get-Location).Path
$env:STACKSPEND_DB_PATH = Join-Path $root ".stackspend\stackspend.sqlite"

pnpm --filter @stackspend/cli dev -- init
pnpm --filter @stackspend/cli dev -- sync --provider mock

$env:STACKSPEND_AWS_COST_EXPLORER_FIXTURE = Join-Path $root "tests\fixtures\providers\aws\cost-explorer-grouped-by-service.json"
$env:STACKSPEND_OPENAI_USAGE_FIXTURE = Join-Path $root "tests\fixtures\providers\openai\usage-costs.json"
$env:STACKSPEND_OPENAI_COSTS_FIXTURE = Join-Path $root "tests\fixtures\providers\openai\usage-costs.json"
$env:STACKSPEND_SUPABASE_FIXTURE = Join-Path $root "tests\fixtures\providers\supabase\usage-health.json"
$env:STACKSPEND_CLOUDFLARE_FIXTURE = Join-Path $root "tests\fixtures\providers\cloudflare\billing-usage.json"

pnpm --filter @stackspend/cli dev -- sync --provider aws
pnpm --filter @stackspend/cli dev -- sync --provider openai
pnpm --filter @stackspend/cli dev -- sync --provider supabase
pnpm --filter @stackspend/cli dev -- sync --provider cloudflare
```

Run the web dashboard with fake connection labels for demo display only:

```powershell
$env:AWS_PROFILE = "FAKE_STACKSPEND_INSTALL_GUIDE_PROFILE"
$env:OPENAI_ADMIN_KEY = "FAKE_STACKSPEND_INSTALL_GUIDE_OPENAI_ADMIN_KEY"
$env:SUPABASE_ACCESS_TOKEN = "FAKE_STACKSPEND_INSTALL_GUIDE_SUPABASE_ACCESS_TOKEN"
$env:CLOUDFLARE_API_TOKEN = "FAKE_STACKSPEND_INSTALL_GUIDE_CLOUDFLARE_API_TOKEN"
$env:CLOUDFLARE_ACCOUNT_IDS = "FAKE_STACKSPEND_INSTALL_GUIDE_ACCOUNT_ID"

npm run dev:web
```

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
git clone https://github.com/ztwz11/stackspend.git
cd stackspend
pnpm install
```

Create a local SQLite database and seed safe demo data:

```bash
mkdir -p .stackspend
export STACKSPEND_ROOT="$PWD"
export STACKSPEND_DB_PATH="$STACKSPEND_ROOT/.stackspend/stackspend.sqlite"

pnpm --filter @stackspend/cli dev -- init
pnpm --filter @stackspend/cli dev -- sync --provider mock

export STACKSPEND_AWS_COST_EXPLORER_FIXTURE="$STACKSPEND_ROOT/tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json"
export STACKSPEND_OPENAI_USAGE_FIXTURE="$STACKSPEND_ROOT/tests/fixtures/providers/openai/usage-costs.json"
export STACKSPEND_OPENAI_COSTS_FIXTURE="$STACKSPEND_ROOT/tests/fixtures/providers/openai/usage-costs.json"
export STACKSPEND_SUPABASE_FIXTURE="$STACKSPEND_ROOT/tests/fixtures/providers/supabase/usage-health.json"
export STACKSPEND_CLOUDFLARE_FIXTURE="$STACKSPEND_ROOT/tests/fixtures/providers/cloudflare/billing-usage.json"

pnpm --filter @stackspend/cli dev -- sync --provider aws
pnpm --filter @stackspend/cli dev -- sync --provider openai
pnpm --filter @stackspend/cli dev -- sync --provider supabase
pnpm --filter @stackspend/cli dev -- sync --provider cloudflare
```

Run the web dashboard with fake connection labels for demo display only:

```bash
export AWS_PROFILE="FAKE_STACKSPEND_INSTALL_GUIDE_PROFILE"
export OPENAI_ADMIN_KEY="FAKE_STACKSPEND_INSTALL_GUIDE_OPENAI_ADMIN_KEY"
export SUPABASE_ACCESS_TOKEN="FAKE_STACKSPEND_INSTALL_GUIDE_SUPABASE_ACCESS_TOKEN"
export CLOUDFLARE_API_TOKEN="FAKE_STACKSPEND_INSTALL_GUIDE_CLOUDFLARE_API_TOKEN"
export CLOUDFLARE_ACCOUNT_IDS="FAKE_STACKSPEND_INSTALL_GUIDE_ACCOUNT_ID"

npm run dev:web
```

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
open "apps/tray/src-tauri/target/release/bundle/macos/StackSpend Tray.app"
```

If macOS blocks the unsigned alpha app, use Finder, right-click the app, and choose Open. Do not use this unsigned build as a distribution artifact.

## English Mock Screenshots

The following screenshots were captured from the fixture database seeded by the commands above. The fake environment values only mark providers as connected for the local UI; no live provider credentials, provider account identifiers, webhook URLs, or local Codex/Claude session data are included.

Dashboard overview:

![StackSpend English mock dashboard](assets/install/stackspend-english-mock-dashboard.jpg)

Desktop HUD:

![StackSpend English mock HUD](assets/install/stackspend-english-mock-hud.png)

HUD notification settings:

![StackSpend English mock HUD settings](assets/install/stackspend-english-mock-hud-settings.png)

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
- The `FAKE_STACKSPEND_INSTALL_GUIDE_*` values are examples only.
- Do not commit `.env`, API keys, account IDs, project IDs, invoice IDs, card data, emails from provider payloads, raw billing profiles, or webhook URLs.
- Provider connectors must remain read-only.
- Telemetry is off by default.
