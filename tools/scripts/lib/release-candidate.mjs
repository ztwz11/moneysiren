const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/;
const THUMBPRINT_PATTERN = /^[A-F0-9]{40,128}$/;
const ASSET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._ +()-]{0,254}$/;
const MAX_WEB_RUNTIME_BYTES = 512 * 1024 * 1024;
const MAX_HUD_ASSET_BYTES = 1024 * 1024 * 1024;
const MAX_HUD_ASSETS = 16;
const ROOT_KEYS = [
  "schemaVersion",
  "repository",
  "tag",
  "version",
  "sourceCommit",
  "assets",
];
const ASSET_KEYS = [
  "name",
  "surface",
  "platform",
  "archive",
  "size",
  "sha256",
  "signing",
];
const SIGNING_REQUIRED_KEYS = ["state", "method"];
const SIGNING_OPTIONAL_KEYS = ["signerThumbprint"];

export function validateReleaseCandidate(manifest, options = {}) {
  const errors = [];
  const channel = options.channel;

  if (channel !== "preview" && channel !== "stable") {
    return { ok: false, errors: ["release channel must be preview or stable"] };
  }

  const tag = stringValue(options.tag);
  const sourceCommit = stringValue(options.sourceCommit);
  const repository = stringValue(options.repository);

  if (!TAG_PATTERN.test(tag)) {
    errors.push("release tag must be a v-prefixed semantic version");
  }

  if (!COMMIT_PATTERN.test(sourceCommit)) {
    errors.push("source commit must be a full lowercase SHA");
  }

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    errors.push("expected release repository must use owner/name form");
  }

  if (!isRecord(manifest)) {
    return { ok: false, errors: ["release manifest must be an object"] };
  }
  if (!hasExactKeys(manifest, ROOT_KEYS)) {
    errors.push("release manifest root must contain only the documented keys");
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
  } else if (manifest.repository !== repository) {
    errors.push("release manifest repository does not match the candidate repository");
  }

  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (assets.length === 0 || assets.length > 64) {
    errors.push("release manifest must contain between 1 and 64 assets");
  }

  const names = new Set();
  let webCount = 0;
  let hudCount = 0;

  for (const [index, value] of assets.entries()) {
    if (!isRecord(value)) {
      errors.push(`release manifest asset ${index} must be an object`);
      continue;
    }

    if (!hasExactKeys(value, ASSET_KEYS)) {
      errors.push(`release manifest asset ${index} must contain only the documented keys`);
    }

    const name = typeof value.name === "string" ? value.name : "";
    const assetLabel = safeName(name);

    if (!isSafeAssetName(name) || names.has(name)) {
      errors.push("release asset names must be unique safe basenames");
    } else {
      names.add(name);
    }

    if (value.surface === "web") {
      webCount += 1;
    } else if (value.surface === "hud") {
      hudCount += 1;
    }

    const maximumBytes = value.surface === "web"
      ? MAX_WEB_RUNTIME_BYTES
      : value.surface === "hud"
        ? MAX_HUD_ASSET_BYTES
        : null;

    if (
      maximumBytes === null ||
      !Number.isSafeInteger(value.size) ||
      value.size <= 0 ||
      value.size > maximumBytes
    ) {
      errors.push(`release asset ${assetLabel} has an invalid size`);
    }

    if (typeof value.sha256 !== "string" || !SHA256_PATTERN.test(value.sha256)) {
      errors.push(`release asset ${assetLabel} has an invalid SHA256`);
    }

    if (!isRecord(value.signing)) {
      errors.push(`release asset ${assetLabel} has invalid signing metadata`);
      continue;
    }

    if (!hasExactKeys(value.signing, SIGNING_REQUIRED_KEYS, SIGNING_OPTIONAL_KEYS)) {
      errors.push(`release asset ${assetLabel} has invalid signing metadata`);
    }

    const signing = value.signing;

    if (!["signed", "unsigned", "not-required"].includes(signing.state)) {
      errors.push(`release asset ${assetLabel} has an invalid signing state`);
    }

    if (!["none", "authenticode", "apple-codesign-notarized"].includes(signing.method)) {
      errors.push(`release asset ${assetLabel} has an invalid signing method`);
    }

    if (
      signing.signerThumbprint !== undefined &&
      (
        typeof signing.signerThumbprint !== "string" ||
        !THUMBPRINT_PATTERN.test(signing.signerThumbprint)
      )
    ) {
      errors.push(`release asset ${assetLabel} has an invalid signer thumbprint`);
    }

    if (value.surface === "web") {
      if (
        name !== `moneysiren-web-runtime-${tag}.tar.gz` ||
        value.platform !== "any" ||
        value.archive !== "tar.gz" ||
        signing.state !== "not-required" ||
        signing.method !== "none" ||
        signing.signerThumbprint !== undefined
      ) {
        errors.push(`release manifest web asset ${assetLabel} has inconsistent metadata`);
      }
    } else if (value.surface === "hud" && value.platform === "win32") {
      const versionMatch = /^MoneySiren\.Tray_([^_]+)_.+\.(?:exe|msi)$/i.exec(name);

      if (
        value.archive !== "none" ||
        signing.method !== "authenticode" ||
        signing.state === "not-required" ||
        versionMatch === null ||
        versionMatch[1] !== tag.slice(1) ||
        (signing.state === "signed") !== (signing.signerThumbprint !== undefined)
      ) {
        errors.push(`release manifest Windows asset ${assetLabel} has inconsistent metadata or version`);
      }
    } else if (value.surface === "hud" && value.platform === "darwin") {
      if (
        value.archive !== "tar.gz" ||
        signing.method !== "apple-codesign-notarized" ||
        signing.state === "not-required" ||
        signing.signerThumbprint !== undefined ||
        !/macos/i.test(name) ||
        !/\.tar\.gz$/i.test(name)
      ) {
        errors.push(`release manifest macOS asset ${assetLabel} has inconsistent metadata`);
      }
    } else if (value.surface === "hud") {
      errors.push(`HUD asset ${assetLabel} has an unsupported platform`);
    } else {
      errors.push(`release asset ${assetLabel} has an unsupported surface`);
    }

    if (channel === "stable" && value.surface === "hud" && signing.state !== "signed") {
      errors.push(`stable HUD asset ${assetLabel} is not signed`);
    }
  }

  if (webCount !== 1) {
    errors.push("release candidate must contain exactly one web runtime");
  }

  if (hudCount > MAX_HUD_ASSETS) {
    errors.push(`release candidate must contain no more than ${MAX_HUD_ASSETS} HUD assets`);
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

  const errors = [];
  const publishedAssets = Array.isArray(release.assets) ? release.assets : [];

  if (!Array.isArray(release.assets)) {
    errors.push("published release assets must be an array");
  }

  const payloadAssets = isRecord(manifest) && Array.isArray(manifest.assets)
    ? manifest.assets
    : [];

  if (payloadAssets.length === 0) {
    errors.push("release manifest must contain payload assets");
  }

  let supportAssets = [];

  if (options.supportAssets !== undefined) {
    if (!Array.isArray(options.supportAssets)) {
      errors.push("release support assets must be an array");
    } else {
      supportAssets = options.supportAssets;
    }
  }

  const expectedByName = collectExpectedAssets(
    [...payloadAssets, ...supportAssets],
    errors,
  );
  const actualByName = collectPublishedAssets(publishedAssets, errors);
  const exactNames = expectedByName.size === actualByName.size &&
    [...expectedByName.keys()].every((name) => actualByName.has(name));

  if (!exactNames) {
    errors.push("published release assets are immutable; create a new version instead");
  }

  for (const [name, expected] of expectedByName) {
    const actual = actualByName.get(name);

    if (actual === undefined) {
      continue;
    }

    if (actual.size !== expected.size) {
      errors.push(`published release asset ${safeName(name)} size changed`);
    }

    if (actual.digest !== `sha256:${expected.sha256}`) {
      errors.push(`published release asset ${safeName(name)} digest changed`);
    }
  }

  const uniqueErrors = [...new Set(errors)];
  return { ok: uniqueErrors.length === 0, errors: uniqueErrors };
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasExactKeys(value, requiredKeys, optionalKeys = []) {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);

  return requiredKeys.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key));
}

function collectExpectedAssets(values, errors) {
  const assets = new Map();

  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      errors.push(`expected release asset ${index} must be an object`);
      continue;
    }

    const name = typeof value.name === "string" ? value.name : "";

    if (!isSafeAssetName(name)) {
      errors.push(`expected release asset ${index} has an unsafe name`);
      continue;
    }

    if (assets.has(name)) {
      errors.push(`expected release assets contain duplicate name ${safeName(name)}`);
      continue;
    }

    if (!Number.isSafeInteger(value.size) || value.size <= 0) {
      errors.push(`expected release asset ${safeName(name)} has an invalid size`);
    }

    if (typeof value.sha256 !== "string" || !SHA256_PATTERN.test(value.sha256)) {
      errors.push(`expected release asset ${safeName(name)} has an invalid SHA256`);
    }

    assets.set(name, value);
  }

  return assets;
}

function collectPublishedAssets(values, errors) {
  const assets = new Map();

  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      errors.push(`published release asset ${index} must be an object`);
      continue;
    }

    const name = typeof value.name === "string" ? value.name : "";

    if (!isSafeAssetName(name)) {
      errors.push(`published release asset ${index} has an unsafe name`);
      continue;
    }

    if (assets.has(name)) {
      errors.push(`published release assets contain duplicate name ${safeName(name)}`);
      continue;
    }

    if (!Number.isSafeInteger(value.size) || value.size <= 0) {
      errors.push(`published release asset ${safeName(name)} has an invalid size`);
    }

    if (typeof value.digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.digest)) {
      errors.push(`published release asset ${safeName(name)} has no valid SHA256 digest`);
    }

    assets.set(name, value);
  }

  return assets;
}

function isSafeAssetName(name) {
  return typeof name === "string" &&
    name.length > 0 &&
    name.length <= 255 &&
    !name.includes("/") &&
    !name.includes("\\") &&
    ASSET_NAME_PATTERN.test(name);
}

function safeName(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "(unnamed)";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
