import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export const RELEASE_MANIFEST_FILE_NAME = "moneysiren-release-manifest.json";
export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;

const MAX_SIGNATURE_METADATA_BYTES = 256 * 1024;
const SUPPORT_FILE_NAMES = new Set([
  "moneysiren-web-runtime-SHA256SUMS.txt",
  "moneysiren-tray-windows-SHA256SUMS.txt",
  "moneysiren-tray-windows-SIGNATURE.json",
  "moneysiren-tray-macos-SHA256SUMS.txt",
  "moneysiren-tray-macos-SIGNATURE.json",
]);

export async function createReleaseManifest(input) {
  const repository = normalizeRepository(input.repository);
  const { tag, version } = normalizeReleaseTag(input.tag);
  const sourceCommit = normalizeSourceCommit(input.sourceCommit);
  const entries = await readdir(input.assetsDir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));

  const windowsSignatures = await readWindowsSignatureMetadata(input.assetsDir, fileNames);
  const macosSignatures = await readMacosSignatureMetadata(input.assetsDir, fileNames);
  const assets = [];

  for (const name of fileNames) {
    if (name === RELEASE_MANIFEST_FILE_NAME || SUPPORT_FILE_NAMES.has(name)) {
      continue;
    }

    const classification = classifyReleaseAsset(name, tag);

    if (classification === null) {
      continue;
    }

    const path = join(input.assetsDir, name);
    const metadata = await lstat(path);

    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Release asset must be a regular file: ${name}`);
    }

    if (!Number.isSafeInteger(metadata.size) || metadata.size <= 0) {
      throw new Error(`Release asset has an invalid size: ${name}`);
    }

    const signing = resolveSigningState({
      name,
      platform: classification.platform,
      windowsSignatures,
      macosSignatures,
    });

    assets.push({
      name,
      surface: classification.surface,
      platform: classification.platform,
      archive: classification.archive,
      size: metadata.size,
      sha256: await sha256File(path),
      signing,
    });
  }

  const webAssets = assets.filter((asset) => asset.surface === "web");

  if (webAssets.length !== 1) {
    throw new Error(`Release manifest requires exactly one web runtime asset; found ${webAssets.length}.`);
  }

  assets.sort(compareAssets);

  return {
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    repository,
    tag,
    version,
    sourceCommit,
    assets,
  };
}

export function serializeReleaseManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function writeReleaseManifest(input) {
  const manifest = await createReleaseManifest(input);
  const outputPath = input.outputPath ?? join(input.assetsDir, RELEASE_MANIFEST_FILE_NAME);
  const temporaryPath = `${outputPath}.tmp`;

  await writeFile(temporaryPath, serializeReleaseManifest(manifest), {
    encoding: "utf8",
    flag: "w",
  });
  await rename(temporaryPath, outputPath);

  return {
    manifest,
    outputPath,
  };
}

export function normalizeReleaseTag(value) {
  const tag = typeof value === "string" ? value.trim() : "";
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/.exec(tag);

  if (match === null) {
    throw new Error("Release tag must be a v-prefixed semantic version.");
  }

  return {
    tag,
    version: tag.slice(1),
  };
}

function normalizeRepository(value) {
  const repository = typeof value === "string" ? value.trim() : "";

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("Release repository must be in owner/name form.");
  }

  return repository;
}

function normalizeSourceCommit(value) {
  const sourceCommit = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new Error("Release source commit must be a full 40-character SHA.");
  }

  return sourceCommit;
}

function classifyReleaseAsset(name, tag) {
  const webMatch = /^moneysiren-web-runtime-(v[^/]+)\.tar\.gz$/i.exec(name);

  if (webMatch !== null) {
    if (webMatch[1] !== tag) {
      throw new Error(`Web runtime asset tag mismatch: expected ${tag}, got ${webMatch[1]}.`);
    }

    return {
      surface: "web",
      platform: "any",
      archive: "tar.gz",
    };
  }

  const windowsMatch = /^MoneySiren\.Tray_([^_]+)_.+\.(?:exe|msi)$/i.exec(name);

  if (windowsMatch !== null) {
    if (windowsMatch[1] !== tag.slice(1)) {
      throw new Error(`Windows desktop asset version mismatch: expected ${tag.slice(1)}, got ${windowsMatch[1]}.`);
    }

    return {
      surface: "hud",
      platform: "win32",
      archive: "none",
    };
  }

  if (/macos/i.test(name) && /\.tar\.gz$/i.test(name)) {
    return {
      surface: "hud",
      platform: "darwin",
      archive: "tar.gz",
    };
  }

  return null;
}

function resolveSigningState(input) {
  if (input.platform === "any") {
    return {
      state: "not-required",
      method: "none",
    };
  }

  if (input.platform === "win32") {
    const signature = input.windowsSignatures.get(input.name);

    if (signature !== undefined && signature.signatureStatus.toLowerCase() === "valid") {
      return {
        state: "signed",
        method: "authenticode",
        signerThumbprint: signature.signerThumbprint,
      };
    }

    return {
      state: "unsigned",
      method: "authenticode",
    };
  }

  const signature = input.macosSignatures.get(input.name);

  if (
    signature !== undefined &&
    signature.signatureStatus.toLowerCase() === "valid" &&
    signature.notarizationStatus.toLowerCase() === "valid"
  ) {
    return {
      state: "signed",
      method: "apple-codesign-notarized",
    };
  }

  return {
    state: "unsigned",
    method: "apple-codesign-notarized",
  };
}

async function readWindowsSignatureMetadata(assetsDir, fileNames) {
  const name = "moneysiren-tray-windows-SIGNATURE.json";

  if (!fileNames.includes(name)) {
    return new Map();
  }

  const parsed = await readJsonMetadata(join(assetsDir, name));
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  const signatures = new Map();

  for (const entry of entries) {
    if (
      !isRecord(entry) ||
      typeof entry.assetName !== "string" ||
      typeof entry.signerThumbprint !== "string" ||
      typeof entry.signatureStatus !== "string"
    ) {
      throw new Error("Windows signature metadata has an invalid entry.");
    }

    const assetName = basename(entry.assetName);
    const signerThumbprint = entry.signerThumbprint.replaceAll(/\s/g, "").toUpperCase();

    if (assetName !== entry.assetName || !/^[A-F0-9]{40,128}$/.test(signerThumbprint)) {
      throw new Error("Windows signature metadata has an invalid asset name or signer thumbprint.");
    }

    if (signatures.has(assetName)) {
      throw new Error(`Windows signature metadata has duplicate entries for ${assetName}.`);
    }

    signatures.set(assetName, {
      signerThumbprint,
      signatureStatus: entry.signatureStatus,
    });
  }

  return signatures;
}

async function readMacosSignatureMetadata(assetsDir, fileNames) {
  const name = "moneysiren-tray-macos-SIGNATURE.json";

  if (!fileNames.includes(name)) {
    return new Map();
  }

  const parsed = await readJsonMetadata(join(assetsDir, name));
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  const signatures = new Map();

  for (const entry of entries) {
    if (
      !isRecord(entry) ||
      typeof entry.assetName !== "string" ||
      typeof entry.signatureStatus !== "string" ||
      typeof entry.notarizationStatus !== "string"
    ) {
      throw new Error("macOS signature metadata has an invalid entry.");
    }

    const assetName = basename(entry.assetName);

    if (assetName !== entry.assetName) {
      throw new Error("macOS signature metadata has an invalid asset name.");
    }

    if (signatures.has(assetName)) {
      throw new Error(`macOS signature metadata has duplicate entries for ${assetName}.`);
    }

    signatures.set(assetName, {
      signatureStatus: entry.signatureStatus,
      notarizationStatus: entry.notarizationStatus,
    });
  }

  return signatures;
}

async function readJsonMetadata(path) {
  const metadata = await lstat(path);

  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_SIGNATURE_METADATA_BYTES) {
    throw new Error(`Release signature metadata is not a bounded regular file: ${basename(path)}`);
  }

  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(`Release signature metadata is not valid JSON: ${basename(path)}`);
  }
}

async function sha256File(path) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

function compareAssets(left, right) {
  return [left.surface, left.platform, left.name]
    .join("\u0000")
    .localeCompare([right.surface, right.platform, right.name].join("\u0000"), "en");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
