import { basename } from "node:path";
import type { InstallSurface } from "./install-profile.js";

export const RELEASE_MANIFEST_FILE_NAME = "moneysiren-release-manifest.json";
export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;
export const MAX_RELEASE_MANIFEST_BYTES = 512 * 1024;
export const MAX_WEB_RUNTIME_BYTES = 512 * 1024 * 1024;
export const MAX_HUD_ASSET_BYTES = 1024 * 1024 * 1024;

export type ReleaseAssetPlatform = "any" | "win32" | "darwin";
export type ReleaseAssetArchive = "none" | "tar.gz";
export type ReleaseAssetSigningState = "not-required" | "signed" | "unsigned";

export interface ReleaseAssetSigning {
  state: ReleaseAssetSigningState;
  method: "none" | "authenticode" | "apple-codesign-notarized";
  signerThumbprint?: string;
}

export interface ReleaseManifestAsset {
  name: string;
  surface: Exclude<InstallSurface, "cli">;
  platform: ReleaseAssetPlatform;
  archive: ReleaseAssetArchive;
  size: number;
  sha256: string;
  signing: ReleaseAssetSigning;
}

export interface ReleaseManifest {
  schemaVersion: 1;
  repository: string;
  tag: string;
  version: string;
  sourceCommit: string;
  assets: readonly ReleaseManifestAsset[];
}

export function parseReleaseManifest(
  value: unknown,
  expected: {
    repository: string;
    tag: string;
  },
): ReleaseManifest {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "schemaVersion",
    "repository",
    "tag",
    "version",
    "sourceCommit",
    "assets",
  ])) {
    throw new Error("Release manifest root is invalid.");
  }

  if (value.schemaVersion !== RELEASE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported release manifest schema: ${String(value.schemaVersion)}.`);
  }

  if (value.repository !== expected.repository) {
    throw new Error("Release manifest repository mismatch.");
  }

  if (value.tag !== expected.tag || !isReleaseTag(value.tag)) {
    throw new Error("Release manifest tag mismatch.");
  }

  if (value.version !== value.tag.slice(1)) {
    throw new Error("Release manifest version mismatch.");
  }

  if (typeof value.sourceCommit !== "string" || !/^[a-f0-9]{40}$/.test(value.sourceCommit)) {
    throw new Error("Release manifest source commit is invalid.");
  }

  if (!Array.isArray(value.assets) || value.assets.length === 0 || value.assets.length > 64) {
    throw new Error("Release manifest assets must contain between 1 and 64 entries.");
  }

  const manifestTag = value.tag;
  const names = new Set<string>();
  const assets = value.assets.map((asset, index) => parseAsset(asset, manifestTag, index));

  for (const asset of assets) {
    if (names.has(asset.name)) {
      throw new Error(`Release manifest contains duplicate asset ${asset.name}.`);
    }

    names.add(asset.name);
  }

  const webAssets = assets.filter((asset) => asset.surface === "web");

  if (webAssets.length !== 1) {
    throw new Error(`Release manifest requires exactly one web runtime asset; found ${webAssets.length}.`);
  }

  return {
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    repository: value.repository,
    tag: value.tag,
    version: value.version,
    sourceCommit: value.sourceCommit,
    assets,
  };
}

export function selectReleaseAsset(
  manifest: Pick<ReleaseManifest, "assets">,
  surface: Exclude<InstallSurface, "cli">,
  platform: NodeJS.Platform,
): ReleaseManifestAsset | null {
  const compatible = manifest.assets.filter((asset) =>
    asset.surface === surface &&
    (asset.platform === "any" || asset.platform === platform)
  );

  if (surface === "web") {
    return compatible[0] ?? null;
  }

  if (platform === "win32") {
    return [...compatible].sort((left, right) =>
      windowsAssetPriority(left.name) - windowsAssetPriority(right.name) ||
      left.name.localeCompare(right.name, "en")
    )[0] ?? null;
  }

  return [...compatible].sort((left, right) => left.name.localeCompare(right.name, "en"))[0] ?? null;
}

export function releaseAssetMaximumBytes(asset: ReleaseManifestAsset): number {
  return asset.surface === "web" ? MAX_WEB_RUNTIME_BYTES : MAX_HUD_ASSET_BYTES;
}

function parseAsset(value: unknown, tag: string, index: number): ReleaseManifestAsset {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "name",
    "surface",
    "platform",
    "archive",
    "size",
    "sha256",
    "signing",
  ])) {
    throw new Error(`Release manifest asset ${index} is invalid.`);
  }

  const name = value.name;

  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > 255 ||
    basename(name) !== name ||
    name.includes("/") ||
    name.includes("\\") ||
    !/^[A-Za-z0-9._ -]+$/.test(name)
  ) {
    throw new Error(`Release manifest asset ${index} has an unsafe name.`);
  }

  if (value.surface !== "web" && value.surface !== "hud") {
    throw new Error(`Release manifest asset ${name} has an invalid surface.`);
  }

  if (value.platform !== "any" && value.platform !== "win32" && value.platform !== "darwin") {
    throw new Error(`Release manifest asset ${name} has an invalid platform.`);
  }

  if (value.archive !== "none" && value.archive !== "tar.gz") {
    throw new Error(`Release manifest asset ${name} has an invalid archive type.`);
  }

  const maximumBytes = value.surface === "web" ? MAX_WEB_RUNTIME_BYTES : MAX_HUD_ASSET_BYTES;

  if (
    typeof value.size !== "number" ||
    !Number.isSafeInteger(value.size) ||
    value.size <= 0 ||
    value.size > maximumBytes
  ) {
    throw new Error(`Release manifest asset ${name} has an invalid size.`);
  }

  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    throw new Error(`Release manifest asset ${name} has an invalid SHA256.`);
  }

  const signing = parseSigning(value.signing, name);

  assertAssetShape({
    archive: value.archive,
    name,
    platform: value.platform,
    signing,
    surface: value.surface,
    tag,
  });

  return {
    name,
    surface: value.surface,
    platform: value.platform,
    archive: value.archive,
    size: value.size,
    sha256: value.sha256,
    signing,
  };
}

function parseSigning(value: unknown, assetName: string): ReleaseAssetSigning {
  if (!isRecord(value) || !hasOnlyKeys(value, ["state", "method", "signerThumbprint"])) {
    throw new Error(`Release manifest asset ${assetName} has invalid signing metadata.`);
  }

  if (value.state !== "not-required" && value.state !== "signed" && value.state !== "unsigned") {
    throw new Error(`Release manifest asset ${assetName} has an invalid signing state.`);
  }

  if (
    value.method !== "none" &&
    value.method !== "authenticode" &&
    value.method !== "apple-codesign-notarized"
  ) {
    throw new Error(`Release manifest asset ${assetName} has an invalid signing method.`);
  }

  if (
    value.signerThumbprint !== undefined &&
    (typeof value.signerThumbprint !== "string" || !/^[A-F0-9]{40,128}$/.test(value.signerThumbprint))
  ) {
    throw new Error(`Release manifest asset ${assetName} has an invalid signer thumbprint.`);
  }

  return {
    state: value.state,
    method: value.method,
    ...(value.signerThumbprint === undefined ? {} : { signerThumbprint: value.signerThumbprint }),
  };
}

function assertAssetShape(input: {
  archive: ReleaseAssetArchive;
  name: string;
  platform: ReleaseAssetPlatform;
  signing: ReleaseAssetSigning;
  surface: Exclude<InstallSurface, "cli">;
  tag: string;
}): void {
  if (input.surface === "web") {
    if (
      input.platform !== "any" ||
      input.archive !== "tar.gz" ||
      input.signing.state !== "not-required" ||
      input.signing.method !== "none" ||
      input.signing.signerThumbprint !== undefined ||
      input.name !== `moneysiren-web-runtime-${input.tag}.tar.gz`
    ) {
      throw new Error(`Release manifest web asset ${input.name} has inconsistent metadata.`);
    }

    return;
  }

  if (input.platform === "win32") {
    const versionMatch = /^MoneySiren\.Tray_([^_]+)_.+\.(?:exe|msi)$/i.exec(input.name);

    if (
      input.archive !== "none" ||
      input.signing.method !== "authenticode" ||
      input.signing.state === "not-required" ||
      versionMatch === null ||
      versionMatch[1] !== input.tag.slice(1) ||
      (input.signing.state === "signed") !== (input.signing.signerThumbprint !== undefined)
    ) {
      throw new Error(`Release manifest Windows asset ${input.name} has inconsistent metadata or version.`);
    }

    return;
  }

  if (input.platform === "darwin") {
    if (
      input.archive !== "tar.gz" ||
      input.signing.method !== "apple-codesign-notarized" ||
      input.signing.state === "not-required" ||
      input.signing.signerThumbprint !== undefined ||
      !/macos/i.test(input.name) ||
      !/\.tar\.gz$/i.test(input.name)
    ) {
      throw new Error(`Release manifest macOS asset ${input.name} has inconsistent metadata.`);
    }

    return;
  }

  throw new Error(`Release manifest HUD asset ${input.name} targets an unsupported platform.`);
}

function windowsAssetPriority(name: string): number {
  if (/portable\.exe$/i.test(name)) {
    return 0;
  }

  if (/\.exe$/i.test(name) && !/(?:^|[._ -])(?:setup|install|installer)(?:[._ -]|$)/i.test(name)) {
    return 1;
  }

  if (/\.exe$/i.test(name)) {
    return 2;
  }

  return 3;
}

function isReleaseTag(value: unknown): value is string {
  return typeof value === "string" &&
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);

  return Object.keys(value).every((key) => allowed.has(key)) &&
    keys.filter((key) => key !== "signerThumbprint").every((key) => key in value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
