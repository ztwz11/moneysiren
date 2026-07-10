import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { RELEASE_MANIFEST_FILE_NAME } from "./release-manifest.mjs";

const MAX_SUPPORT_FILE_BYTES = 16 * 1024 * 1024;
const CHECKSUM_FILE_TARGETS = new Map([
  ["moneysiren-web-runtime-SHA256SUMS.txt", { surface: "web", platform: "any" }],
  ["moneysiren-tray-windows-SHA256SUMS.txt", { surface: "hud", platform: "win32" }],
  ["moneysiren-tray-macos-SHA256SUMS.txt", { surface: "hud", platform: "darwin" }],
]);
const SUPPORT_FILE_NAMES = new Set([
  ...CHECKSUM_FILE_TARGETS.keys(),
  "moneysiren-tray-windows-SIGNATURE.json",
  "moneysiren-tray-macos-SIGNATURE.json",
  "moneysiren-release-sbom.spdx.json",
  "moneysiren-release-provenance.json",
]);

export async function validateReleaseCandidateDirectory(manifest, assetsDir) {
  const errors = [];
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const payloadNames = new Set(assets.map((asset) => asset.name));
  const allowedNames = new Set([
    RELEASE_MANIFEST_FILE_NAME,
    ...payloadNames,
    ...SUPPORT_FILE_NAMES,
  ]);

  let directoryMetadata;
  let entries;

  try {
    directoryMetadata = await lstat(assetsDir);
    entries = await readdir(assetsDir, { withFileTypes: true });
  } catch {
    return ["release candidate asset directory is missing or unreadable"];
  }

  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    return ["release candidate asset directory must be a real directory"];
  }

  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));

  for (const entry of entries) {
    if (!allowedNames.has(entry.name)) {
      errors.push(`release candidate contains an unexpected entry: ${safeName(entry.name)}`);
      continue;
    }

    if (!entry.isFile() || entry.isSymbolicLink()) {
      errors.push(`release candidate entry must be a regular file: ${safeName(entry.name)}`);
    }
  }

  for (const asset of assets) {
    const name = asset.name;
    const entry = entriesByName.get(name);

    if (entry === undefined) {
      errors.push(`release candidate payload is missing: ${safeName(name)}`);
      continue;
    }

    if (!entry.isFile() || entry.isSymbolicLink()) {
      continue;
    }

    const path = join(assetsDir, name);
    let before;

    try {
      before = await lstat(path);
    } catch {
      errors.push(`release candidate payload is unreadable: ${safeName(name)}`);
      continue;
    }

    if (!before.isFile() || before.isSymbolicLink()) {
      errors.push(`release candidate payload must be a regular file: ${safeName(name)}`);
      continue;
    }

    if (before.size !== asset.size) {
      errors.push(`release candidate payload size does not match manifest: ${safeName(name)}`);
      continue;
    }

    let digest;

    try {
      digest = await sha256File(path);
    } catch {
      errors.push(`release candidate payload could not be hashed: ${safeName(name)}`);
      continue;
    }

    let after;

    try {
      after = await lstat(path);
    } catch {
      errors.push(`release candidate payload changed while hashing: ${safeName(name)}`);
      continue;
    }

    if (!sameFileSnapshot(before, after)) {
      errors.push(`release candidate payload changed while hashing: ${safeName(name)}`);
      continue;
    }

    if (digest !== asset.sha256) {
      errors.push(`release candidate payload SHA256 does not match manifest: ${safeName(name)}`);
    }
  }

  for (const name of SUPPORT_FILE_NAMES) {
    const entry = entriesByName.get(name);

    if (entry === undefined || !entry.isFile() || entry.isSymbolicLink()) {
      continue;
    }

    try {
      const metadata = await lstat(join(assetsDir, name));

      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.size <= 0 ||
        metadata.size > MAX_SUPPORT_FILE_BYTES
      ) {
        errors.push(`release support file must be a bounded regular file: ${safeName(name)}`);
      }
    } catch {
      errors.push(`release support file is unreadable: ${safeName(name)}`);
    }
  }

  for (const [name, target] of CHECKSUM_FILE_TARGETS) {
    const expectedAssets = assets.filter(
      (asset) => asset.surface === target.surface && asset.platform === target.platform,
    );
    const entry = entriesByName.get(name);

    if (entry === undefined) {
      if (expectedAssets.length > 0) {
        errors.push(`release checksum file is missing: ${safeName(name)}`);
      }
      continue;
    }

    if (!entry.isFile() || entry.isSymbolicLink()) {
      continue;
    }

    errors.push(...await validateChecksumFile(join(assetsDir, name), name, expectedAssets));
  }

  return [...new Set(errors)];
}

export async function collectReleaseCandidateAssets(assetsDir) {
  const directoryMetadata = await lstat(assetsDir);

  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    throw new Error("Release candidate asset directory must be a real directory.");
  }

  const entries = await readdir(assetsDir, { withFileTypes: true });

  if (entries.length === 0 || entries.length > 128) {
    throw new Error("Release candidate asset directory has an invalid entry count.");
  }

  const assets = [];

  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !isSafeName(entry.name)) {
      throw new Error(`Release candidate entry must be a safe regular file: ${safeName(entry.name)}`);
    }

    const path = join(assetsDir, entry.name);
    const before = await lstat(path);

    if (!before.isFile() || before.isSymbolicLink() || before.size <= 0) {
      throw new Error(`Release candidate entry must be a non-empty regular file: ${safeName(entry.name)}`);
    }

    const sha256 = await sha256File(path);
    const after = await lstat(path);

    if (!sameFileSnapshot(before, after)) {
      throw new Error(`Release candidate entry changed while hashing: ${safeName(entry.name)}`);
    }

    assets.push({
      name: entry.name,
      size: before.size,
      sha256,
    });
  }

  return assets.sort((left, right) => left.name.localeCompare(right.name, "en"));
}

async function validateChecksumFile(path, name, expectedAssets) {
  let content;

  try {
    content = await readFile(path, "utf8");
  } catch {
    return [`release checksum file is unreadable: ${safeName(name)}`];
  }

  const actual = new Map();
  const errors = [];

  for (const line of content.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const match = /^([a-f0-9]{64})[ \t]+\*?(.+)$/.exec(line);

    if (match === null || !isSafeName(match[2])) {
      errors.push(`release checksum file has an invalid line: ${safeName(name)}`);
      continue;
    }

    if (actual.has(match[2])) {
      errors.push(`release checksum file has a duplicate payload: ${safeName(name)}`);
      continue;
    }

    actual.set(match[2], match[1]);
  }

  const expected = new Map(expectedAssets.map((asset) => [asset.name, asset.sha256]));
  const exactNames = actual.size === expected.size &&
    [...expected.keys()].every((assetName) => actual.has(assetName));

  if (!exactNames) {
    errors.push(`release checksum file payload set does not match manifest: ${safeName(name)}`);
  }

  for (const [assetName, digest] of expected) {
    if (actual.has(assetName) && actual.get(assetName) !== digest) {
      errors.push(`release checksum does not match manifest: ${safeName(assetName)}`);
    }
  }

  return errors;
}

async function sha256File(path) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

function sameFileSnapshot(before, after) {
  return before.isFile() &&
    after.isFile() &&
    !before.isSymbolicLink() &&
    !after.isSymbolicLink() &&
    before.dev === after.dev &&
    before.ino === after.ino &&
    before.size === after.size &&
    before.mtimeMs === after.mtimeMs;
}

function isSafeName(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    !value.includes("/") &&
    !value.includes("\\");
}

function safeName(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "(unnamed)";
}
