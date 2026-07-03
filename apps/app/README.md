# MoneySiren App

One-command installer for the MoneySiren initial public local release.

This is the recommended npm package for users who want all three local MoneySiren surfaces: CLI, web dashboard, and HUD. It bundles the MoneySiren CLI entrypoints and, on global npm installs, downloads the local web dashboard runtime from the matching GitHub Release. HUD artifacts require signed release metadata by default; unsigned HUD smoke testing requires explicit local opt-in.

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

If release asset download fails during postinstall, fix network or release access and rerun:

```bash
msiren install --web
msiren install --status
```

## What It Installs

- CLI command surface.
- Local web dashboard runtime.
- HUD desktop artifact.

The Web/HUD artifacts are verified against published SHA256 checksums. Public release Windows HUD artifacts should include signature metadata; unsigned artifacts are for local smoke or prerelease review only.

Temporary Windows HUD smoke testing before release signing is ready requires an explicit command opt-in:

```powershell
msiren install --hud --allow-unsigned-hud
msiren hud
```

This does not remove Windows publisher warnings and does not change public release validation. `MONEYSIREN_ALLOW_UNSIGNED_HUD=true` remains available for advanced npm postinstall or CI smoke paths.

For CLI-only automation, install `@moneysiren/cli` instead.

## Opt Out

To install only the package command and skip release asset download:

```bash
MONEYSIREN_SKIP_APP_POSTINSTALL=1 npm install -g @moneysiren/app
msiren install --all
```

For local non-global package review, postinstall does not download release assets automatically. Run `msiren install --all` explicitly when needed.

## Public Local Release Channel

```bash
npm install -g @moneysiren/app
```
