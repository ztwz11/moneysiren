# MoneySiren App

One-command installer for the MoneySiren initial public local release.

This is the recommended npm package for users who want all three local MoneySiren surfaces: CLI, web dashboard, and HUD. It bundles the MoneySiren CLI entrypoints and, on global npm installs, runs `msiren install --all` to download the local web dashboard runtime and HUD desktop artifacts from the matching GitHub Release.

## Install

```bash
npm install -g @moneysiren/app
msiren --version
msiren start
msiren hud
```

Use the unqualified package name for the public local release.

The package creates both global command shims during postinstall:

- `moneysiren`
- `msiren`

If npm reports `EEXIST` for `moneysiren` or `msiren`, an older prerelease app package may still be installed. Remove the old global packages and reinstall:

```powershell
npm uninstall -g @moneysiren/cli @moneysiren/app
npm install -g @moneysiren/app --force
```

Current app packages do not use npm's `bin` field for these aliases, so stale MoneySiren-owned command shims can be replaced during postinstall without tripping npm's bin conflict check.

If Web/HUD asset download fails during postinstall, fix network or release access and rerun:

```bash
msiren install --all
msiren install --status
```

## What It Installs

- CLI command surface.
- Local web dashboard runtime.
- HUD desktop artifact.

The Web/HUD artifacts are verified against published SHA256 checksums. Public release Windows HUD artifacts should include signature metadata; unsigned artifacts are for local smoke or prerelease review only.

For CLI-only automation, install `@moneysiren/cli` instead.

## Opt Out

To install only the package command and skip Web/HUD asset download:

```bash
MONEYSIREN_SKIP_APP_POSTINSTALL=1 npm install -g @moneysiren/app
msiren install --all
```

For local non-global package review, postinstall does not download release assets automatically. Run `msiren install --all` explicitly when needed.

## Public Local Release Channel

```bash
npm install -g @moneysiren/app
```
