# StackSpend CLI

Public alpha packaging metadata for `@stackspend/cli`.

StackSpend is local-first. The CLI reads configuration and secrets from the process environment only, writes normalized data to local SQLite, and does not enable telemetry by default.

## Requirements

- Node.js 20.11 or newer.
- `sqlite3` CLI available at `/usr/bin/sqlite3` for the current alpha runtime path.
- No live provider credentials are required for `stackspend --version`, `stackspend doctor`, or `stackspend sync --provider mock`.

## Published Alpha Usage

The package is prepared for a public npm alpha, but this repository task does not publish it.

After an alpha is published:

```bash
npm install -g @stackspend/cli@alpha
stackspend --version
stackspend doctor
```

One-off execution:

```bash
npx --package @stackspend/cli@alpha stackspend --version
npx --package @stackspend/cli@alpha stackspend doctor
```

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
npm exec stackspend -- --version
npm exec stackspend -- doctor
```

Do not create `.env`, paste real API keys, or write Slack webhook URLs into local project files. Fixture mode and `mock` sync are the intended no-credentials review paths.
