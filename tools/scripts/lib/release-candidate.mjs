const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/;

export function validateReleaseCandidate(manifest, options) {
  const errors = [];
  const channel = options.channel ?? "preview";

  if (channel !== "preview" && channel !== "stable") {
    return { ok: false, errors: ["release channel must be preview or stable"] };
  }

  const tag = requireString(options.tag, "tag");
  const sourceCommit = requireString(options.sourceCommit, "sourceCommit").toLowerCase();

  if (!TAG_PATTERN.test(tag)) {
    errors.push("release tag must be a v-prefixed semantic version");
  }

  if (!COMMIT_PATTERN.test(sourceCommit)) {
    errors.push("source commit must be a full lowercase SHA");
  }

  if (!isRecord(manifest)) {
    return { ok: false, errors: ["release manifest must be an object"] };
  }

  if (manifest.schemaVersion !== 1) {
    errors.push("release manifest schemaVersion must be 1");
  }

  if (manifest.tag !== tag) {
    errors.push("release manifest tag does not match the candidate tag");
  }

  if (manifest.version !== tag.slice(1)) {
    errors.push("release manifest version does not match the candidate tag");
  }

  if (manifest.sourceCommit !== sourceCommit) {
    errors.push("release manifest sourceCommit does not match the candidate commit");
  }

  if (typeof manifest.repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(manifest.repository)) {
    errors.push("release manifest repository must use owner/name form");
  }

  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (assets.length === 0 || assets.length > 128) {
    errors.push("release manifest must contain between 1 and 128 assets");
  }

  const names = new Set();
  let webCount = 0;

  for (const value of assets) {
    if (!isRecord(value)) {
      errors.push("release manifest contains a non-object asset");
      continue;
    }

    const name = typeof value.name === "string" ? value.name : "";
    if (name.length === 0 || name !== basename(name) || names.has(name)) {
      errors.push("release asset names must be unique safe basenames");
    } else {
      names.add(name);
    }

    if (!Number.isSafeInteger(value.size) || value.size <= 0) {
      errors.push(\`release asset \${safeName(name)} has an invalid size\`);
    }

    if (typeof value.sha256 !== "string" || !SHA256_PATTERN.test(value.sha256)) {
      errors.push(\`release asset \${safeName(name)} has an invalid SHA256\`);
    }

    if (value.surface === "web") {
      webCount += 1;
      if (value.platform !== "any" || value.archive !== "tar.gz") {
        errors.push("web runtime must be an any-platform tar.gz asset");
      }
    } else if (value.surface === "hud") {
      if (value.platform !== "win32" && value.platform !== "darwin") {
        errors.push(\`HUD asset \${safeName(name)} has an unsupported platform\`);
      }
    } else {
      errors.push(\`release asset \${safeName(name)} has an unsupported surface\`);
    }

    if (!isRecord(value.signing) || !["signed", "unsigned", "not-required"].includes(value.signing.state)) {
      errors.push(\`release asset \${safeName(name)} has invalid signing metadata\`);
      continue;
    }

    if (channel === "stable" && value.surface === "hud" && value.signing.state !== "signed") {
      errors.push(\`stable HUD asset \${safeName(name)} is not signed\`);
    }

    if (
      channel === "stable" &&
      value.platform === "win32" &&
      (
        value.signing.method !== "authenticode" ||
        typeof value.signing.signerThumbprint !== "string" ||
        !/^[A-F0-9]{40,128}$/.test(value.signing.signerThumbprint)
      )
    ) {
      errors.push(\`stable Windows HUD asset \${safeName(name)} lacks expected Authenticode metadata\`);
    }

    if (
      channel === "stable" &&
      value.platform === "darwin" &&
      value.signing.method !== "apple-codesign-notarized"
    ) {
      errors.push(\`stable macOS HUD asset \${safeName(name)} lacks code-signing and notarization metadata\`);
    }
  }

  if (webCount !== 1) {
    errors.push("release candidate must contain exactly one web runtime");
  }

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
  };
}

export function validatePublishedReleaseIsImmutable(release, manifest, options = {}) {
  if (!isRecord(release)) {
    return { ok: false, errors: ["release state must be an object"] };
  }

  if (release.draft === true) {
    return { ok: true, errors: [] };
  }

  const publishedAssets = Array.isArray(release.assets) ? release.assets.filter(isRecord) : [];
  const payloadAssets = isRecord(manifest) && Array.isArray(manifest.assets)
    ? manifest.assets.filter(isRecord)
    : [];
  const supportAssets = Array.isArray(options.supportAssets)
    ? options.supportAssets.filter(isRecord)
    : [];
  const expectedAssets = [...payloadAssets, ...supportAssets];
  const expectedByName = new Map(expectedAssets.map((asset) => [asset.name, asset]));
  const actualByName = new Map(publishedAssets.map((asset) => [asset.name, asset]));
  const exactNames = expectedByName.size === actualByName.size &&
    [...expectedByName.keys()].every((name) => actualByName.has(name));

  if (!exactNames) {
    return { ok: false, errors: ["published release assets are immutable; create a new version instead"] };
  }

  const errors = [];
  for (const [name, expected] of expectedByName) {
    const actual = actualByName.get(name);

    if (!isRecord(actual)) {
      errors.push("published release asset set changed");
      continue;
    }

    if (Number.isSafeInteger(expected.size) && actual.size !== expected.size) {
      errors.push(\`published release asset \${safeName(String(name))} size changed\`);
    }

    if (
      typeof expected.sha256 === "string" &&
      typeof actual.digest === "string" &&
      actual.digest !== \`sha256:\${expected.sha256}\`
    ) {
      errors.push(\`published release asset \${safeName(String(name))} digest changed\`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(\`\${label} is required\`);
  }

  return value.trim();
}

function basename(value) {
  return value.replaceAll("\\\\", "/").split("/").at(-1) ?? "";
}

function safeName(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "(unnamed)";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
