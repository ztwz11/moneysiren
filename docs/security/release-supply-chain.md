# Release Supply-Chain Security

MoneySiren treats npm command installation and GitHub Release runtime installation
as separate states.

- `npm install -g @moneysiren/app` installs the bundled CLI and the
  `moneysiren` / `msiren` command shims. Postinstall does not contact GitHub
  or install a web/HUD runtime.
- `msiren install --web` and `msiren install --hud` are explicit network
  operations. They succeed only after the selected immutable release asset
  passes the manifest, download, archive, and signing policy below.
- `msiren install --status` reports the command state and remote-runtime state
  independently. A command can be installed while the runtime is
  `not-installed` or `invalid`.

## Versioned release manifest

Every v0.1.6-and-newer source-free release must include
`moneysiren-release-manifest.json`. The release workflow creates it from the
downloadable artifacts with
`tools/scripts/create-release-manifest.mjs`. The JSON is deterministic: it has
no timestamp, assets are sorted, and hashes are calculated from the final bytes.

Schema version 1 records:

- repository;
- release tag and matching semantic version;
- full 40-character source commit;
- exact asset name, byte size, and SHA256;
- surface (`web` or `hud`);
- platform (`any`, `win32`, or `darwin`);
- archive type;
- signing state and mechanism.

Windows artifact filenames also carry a semantic version, and both the builder and installer require it to equal the release tag. Current macOS archive filenames do not carry a version; their identity is therefore bound by the manifest tag, full source commit, exact size, and SHA256.

The installer rejects unknown schemas, unexpected fields, duplicate or unsafe
asset names, missing web runtime metadata, version/tag/repository mismatch,
incomplete commit IDs, impossible sizes, malformed hashes, and inconsistent
platform/signing combinations. It never guesses an asset from a filename when
the manifest does not authorize it.

The manifest is release metadata delivered by GitHub. It is not a replacement
for protected tags, restricted release permissions, provenance, or code
signing. Those controls remain release gates.

## Historical v0.1.5 compatibility

The already-published v0.1.5 release predates the versioned manifest. While
v0.1.5 remains the stable default, the installer has one narrow compatibility
path for the official `ztwz11/moneysiren@v0.1.5` web runtime only. It reads the
bounded public GitHub release metadata and legacy SHA256 file, then applies the
same timeout, host allowlist, exact-size, hash, archive-validation, staging, and
rollback controls.

This exception does not permit a legacy HUD install, a custom repository, or
any other tag. Its local provenance is `legacy-v0.1.5`, and source commit is
reported as unavailable rather than invented. A missing manifest for v0.1.6 or
newer always fails closed. The default tag should move to v0.1.6 only after
those immutable assets are actually published.

## Download boundary

The installer constructs asset URLs from the configured `owner/name`, exact
tag, and manifest asset name. It does not execute a URL supplied by provider
content.

Downloads enforce:

- HTTPS only;
- no URL credentials or non-default ports;
- GitHub and GitHub release-object hosts only;
- manual redirect handling with a maximum of five redirects;
- a 30-second default timeout;
- a 512 KiB manifest limit;
- per-surface hard limits plus the exact manifest byte size;
- streaming to a sibling staging directory;
- exact byte-count and SHA256 verification;
- deletion of partial files on error.

A missing manifest/asset, untrusted redirect, timeout, short response, oversized
response, or hash mismatch returns a non-zero install result.

## Archive boundary

Before activation, every `.tar.gz` runtime is parsed and validated without
extracting it. The validator has expanded-byte, metadata-size, and entry-count
limits. It verifies tar header checksums and accepts only regular files,
directories, links, and bounded standard path metadata.

The validator rejects:

- absolute and drive-qualified paths;
- `..`, ambiguous, empty, or backslash traversal segments;
- symlink or hard-link targets that resolve outside the archive root;
- device, FIFO, sparse, and other unsupported special entries;
- malformed PAX/GNU path metadata;
- invalid padding, headers, gzip framing, or end markers;
- decompression bombs that exceed the configured expanded-byte limit.

The runtime launcher may extract only an archive that passed these checks and
whose installed bytes still match the local manifest.

## Signing state

Web runtime archives use manifest SHA256 integrity and have signing state
`not-required`.

Stable Windows HUD assets must be declared signed and carry an Authenticode
signer thumbprint in the release manifest. The installer verifies the local
file with PowerShell and requires the signer to match. A configured local
thumbprint allowlist can narrow, but cannot replace, the manifest identity.

macOS HUD archives are included as signed only after the release workflow has
verified code signing, stapled notarization, and Gatekeeper assessment. The
manifest records that workflow result. Gatekeeper still evaluates the extracted
application when it is opened.

Unsigned HUD assets are rejected by default. They can be accepted only for a
prerelease or an explicit one-command local smoke opt-in. This does not make the
asset signed and is recorded truthfully in the local install manifest.

## Atomic activation and rollback

Verified files and a schema-versioned local `install-manifest.json` are written
to a sibling staging directory. The local manifest records the source commit,
release version, exact final paths, sizes, hashes, and signing result.

Activation uses same-parent renames:

1. move the current runtime to a unique rollback directory;
2. rename the complete staging directory into place;
3. restore the prior directory if activation fails;
4. remove the rollback directory only after activation succeeds.

Failures before activation never modify the current runtime. A failed update
therefore leaves the previous verified runtime available. If even the restore
rename fails, MoneySiren leaves the rollback directory intact and reports its
path instead of deleting evidence or claiming readiness.

`msiren install --status` rechecks each installed file's path, type, size, and
SHA256. Tampering changes the state to `invalid` and returns a non-zero status.

## Secret and privacy boundary

The release installer sends no provider credentials, local AI auth data,
prompts, commands, account identifiers, or telemetry. Release requests contain
only public repository, tag, and asset information. Local manifests contain
only public release metadata and local install paths. Signing secrets remain in
GitHub Secrets and are never written to release metadata or logs.
