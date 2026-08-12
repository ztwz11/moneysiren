# MoneySiren App

One-command installer for the MoneySiren initial public local release.

This is the recommended npm package for users who want all three local MoneySiren surfaces: CLI, web dashboard, and HUD. It bundles the MoneySiren CLI entrypoints and, on global npm installs, downloads the local web dashboard runtime from the matching GitHub Release. HUD artifacts require signed release metadata by default; unsigned HUD smoke testing requires explicit local opt-in.

## Install

```bash
node --version
npm install -g @moneysiren/app
msiren --version
msiren install --status
msiren start
```

Node.js 22.13 or newer is required. If npm prints `EBADENGINE`, upgrade the active Node.js version before treating the installation as supported.

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

- CLI command surface and the `moneysiren` / `msiren` aliases.
- Local web dashboard runtime during a normal global install.
- HUD desktop artifact only when a signed artifact is available or the user explicitly accepts an unsigned preview.

The Web/HUD artifacts are verified against published SHA256 checksums. Public release Windows HUD artifacts should include signature metadata; unsigned artifacts are for local smoke or prerelease review only.

## Install And Open The HUD

The native HUD executable is separate from the web dashboard. `msiren start` can work while `msiren hud` still reports:

```text
MoneySiren HUD: unavailable
No installed HUD desktop artifact was found.
```

For a release with signed Windows HUD metadata:

```powershell
msiren install --hud
msiren hud
```

Temporary Windows HUD smoke testing before release signing is ready requires an explicit command opt-in:

```powershell
msiren install --hud --allow-unsigned-hud
msiren hud
```

This downloads and runs an executable without trusted publisher signing. It may trigger a Windows warning. The opt-in applies only to that installation command; it does not remove publisher warnings or change public release validation. `MONEYSIREN_ALLOW_UNSIGNED_HUD=true` remains available for advanced npm postinstall or CI smoke paths.

Important status details:

- `msiren install --status` reports the selected component profile; it does not guarantee that a HUD executable exists.
- `msiren status` reports whether the web and HUD processes are actually running.
- `msiren install --web` selects and installs Web-only. It does not add HUD and changes the saved profile to Web-only.
- Use `msiren install --all` for all signed release assets, or `msiren install --all --allow-unsigned-hud` only when intentionally accepting an unsigned HUD preview.
- If the desktop app is already installed elsewhere, set `MONEYSIREN_DESKTOP_APP` to its executable path before running `msiren hud`.

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
