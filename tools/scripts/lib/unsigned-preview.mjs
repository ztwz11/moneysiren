export const UNSIGNED_PREVIEW_METADATA_ASSET = "moneysiren-tray-windows-UNSIGNED-PREVIEW.json";
export const WINDOWS_CHECKSUM_ASSET = "moneysiren-tray-windows-SHA256SUMS.txt";
export const WINDOWS_SIGNATURE_ASSET = "moneysiren-tray-windows-SIGNATURE.json";
export const WINDOWS_UNSIGNED_STABLE_METADATA_ASSET = "moneysiren-tray-windows-UNSIGNED-RELEASE.json";
export const MACOS_UNSIGNED_PREVIEW_METADATA_ASSET = "moneysiren-tray-macos-UNSIGNED-PREVIEW.json";
export const MACOS_CHECKSUM_ASSET = "moneysiren-tray-macos-SHA256SUMS.txt";
export const MACOS_SIGNATURE_ASSET = "moneysiren-tray-macos-SIGNATURE.json";

export function validateUnsignedPreviewRelease(release, input) {
  if (release?.tag_name !== input.tag || release?.prerelease !== true || !Array.isArray(release?.assets)) {
    throw new Error("UNSIGNED_PREVIEW_RELEASE_IDENTITY_INVALID");
  }

  const assetConfig = previewAssetConfig(input.platform);
  const assetNames = release.assets.map((asset) => asset?.name).filter((name) => typeof name === "string");
  if (!assetNames.includes(assetConfig.checksum) || assetNames.includes(assetConfig.signature)) {
    throw new Error("UNSIGNED_PREVIEW_RELEASE_ASSETS_INVALID");
  }

  const metadataAsset = release.assets.find((asset) =>
    asset?.name === assetConfig.metadata &&
    typeof asset?.browser_download_url === "string"
  );
  if (metadataAsset === undefined) {
    throw new Error("UNSIGNED_PREVIEW_METADATA_MISSING");
  }

  return metadataAsset.browser_download_url;
}

export function validateUnsignedPreviewMetadata(metadata, input) {
  const assetConfig = previewAssetConfig(input.platform);
  if (metadata?.version !== 1 ||
      metadata?.tag !== input.tag ||
      metadata?.sourceCommit !== input.sourceCommit ||
      metadata?.signatureStatus !== "unsigned-preview" ||
      metadata?.verifiedPublisher !== false ||
      metadata?.explicitUserOptInRequired !== true ||
      metadata?.checksumManifest !== assetConfig.checksum) {
    throw new Error("UNSIGNED_PREVIEW_METADATA_INVALID");
  }
}

export function validateUnsignedStableRelease(release, input) {
  if (
    release?.tag_name !== input.tag ||
    release?.prerelease !== false ||
    !/^v\d+\.\d+\.\d+$/.test(input.tag) ||
    !Array.isArray(release?.assets)
  ) {
    throw new Error("UNSIGNED_STABLE_RELEASE_IDENTITY_INVALID");
  }

  const assetNames = release.assets.map((asset) => asset?.name).filter((name) => typeof name === "string");
  if (
    !assetNames.includes(WINDOWS_CHECKSUM_ASSET) ||
    assetNames.includes(WINDOWS_SIGNATURE_ASSET) ||
    assetNames.includes(UNSIGNED_PREVIEW_METADATA_ASSET)
  ) {
    throw new Error("UNSIGNED_STABLE_RELEASE_ASSETS_INVALID");
  }

  const metadataAsset = release.assets.find((asset) =>
    asset?.name === WINDOWS_UNSIGNED_STABLE_METADATA_ASSET &&
    typeof asset?.browser_download_url === "string"
  );
  if (metadataAsset === undefined) {
    throw new Error("UNSIGNED_STABLE_METADATA_MISSING");
  }

  return metadataAsset.browser_download_url;
}

export function validateUnsignedStableMetadata(metadata, input) {
  if (
    metadata?.version !== 1 ||
    metadata?.tag !== input.tag ||
    metadata?.sourceCommit !== input.sourceCommit ||
    metadata?.signatureStatus !== "unsigned-stable-opt-in" ||
    metadata?.distributionChannel !== "stable" ||
    metadata?.verifiedPublisher !== false ||
    metadata?.explicitUserOptInRequired !== true ||
    metadata?.checksumManifest !== WINDOWS_CHECKSUM_ASSET ||
    typeof metadata?.warning !== "string" ||
    !/unknown publisher/i.test(metadata.warning)
  ) {
    throw new Error("UNSIGNED_STABLE_METADATA_INVALID");
  }
}

function previewAssetConfig(platform) {
  if (platform === "darwin" || platform === "macos") {
    return {
      checksum: MACOS_CHECKSUM_ASSET,
      metadata: MACOS_UNSIGNED_PREVIEW_METADATA_ASSET,
      signature: MACOS_SIGNATURE_ASSET,
    };
  }

  return {
    checksum: WINDOWS_CHECKSUM_ASSET,
    metadata: UNSIGNED_PREVIEW_METADATA_ASSET,
    signature: WINDOWS_SIGNATURE_ASSET,
  };
}
