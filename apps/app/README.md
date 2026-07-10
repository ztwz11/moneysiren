# MoneySiren App

Deterministic command package for the MoneySiren public local release.

`@moneysiren/app` bundles the MoneySiren CLI entrypoint for users who want the
CLI, web dashboard, and HUD. npm postinstall creates command shims only; it does
not contact GitHub or claim that a remote runtime is ready.

## Install

```bash
npm install -g @moneysiren/app
msiren --version
msiren install --status
msiren install --web
msiren install --status
msiren start
```

The package creates both global command shims during postinstall:

- `moneysiren`
- `msiren`

The shim writer can replace an existing MoneySiren-owned shim and preserves an
unrelated command file. This avoids the historical npm `EEXIST` regression
without deleting another tool's command.

If an older prerelease package still owns conflicting npm-managed aliases,
remove the old packages and reinstall:

```powershell
npm uninstall -g @moneysiren/cli @moneysiren/app
npm install -g @moneysiren/app --force
```

## Command package versus runtime

Immediately after npm installation:

- Commands: installed.
- Remote runtime: not installed.

`msiren install --web` is the explicit network operation. v0.1.6-and-newer
assets require `moneysiren-release-manifest.json` with matching repository,
tag, version, source commit, platform, size, SHA256, archive type, and signing
state. Downloads are bounded and staged; archives are checked for traversal and
symlink escape; activation is atomic; a failed update leaves the prior runtime
in place.

The already-published v0.1.5 web runtime has a narrow compatibility path using
its public release size and SHA256 file. That exception is limited to the
official v0.1.5 web asset and reports source commit as unavailable. It does not
apply to HUD, custom repositories, or newer releases.

`msiren install --status` reports `ready`, `not-installed`, or `invalid`
for the remote runtime independently from the command state.

## HUD

Public Windows HUD artifacts require matching Authenticode signer metadata.
Unsigned HUD artifacts are rejected unless a tester explicitly opts in for one
local smoke command:

```powershell
msiren install --hud --allow-unsigned-hud
msiren hud
```

This does not make the artifact signed or remove publisher warnings.
`MONEYSIREN_ALLOW_UNSIGNED_HUD=true` remains available for explicit CI smoke
paths.

For CLI-only automation, install `@moneysiren/cli` instead.

## Skip command-shim setup

Advanced packagers can skip postinstall command setup:

```bash
MONEYSIREN_SKIP_APP_POSTINSTALL=1 npm install -g @moneysiren/app
```

This variable no longer controls a runtime download because postinstall never
performs one.

## Security details

See
[Release Supply-Chain Security](https://github.com/ztwz11/moneysiren/blob/main/docs/security/release-supply-chain.md)
for manifest, redirect, byte-limit, archive, signing, and rollback boundaries.
