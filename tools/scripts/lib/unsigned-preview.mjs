export const UNSIGNED_PREVIEW_METADATA_ASSET = "moneysiren-tray-windows-UNSIGNED-PREVIEW.json";
export const WINDOWS_CHECKSUM_ASSET = "moneysiren-tray-windows-SHA256SUMS.txt";
export const WINDOWS_SIGNATURE_ASSET = "moneysiren-tray-windows-SIGNATURE.json";

export function validateUnsignedPreviewRelease(release, input) {
  if (release?.tag_name !== input.tag || release?.prerelease !== true || !Array.isArray(release?.assets)) {
    throw new Error("UNSIGNED_PREVIEW_RELEASE_IDENTITY_INVALID");
  }

  const assetNames = release.assets.map((asset) => asset?.name).filter((name) => typeof name === "string");
  if (!assetNames.includes(WINDOWS_CHECKSUM_ASSET) || assetNames.includes(WINDOWS_SIGNATURE_ASSET)) {
    throw new Error("UNSIGNED_PREVIEW_RELEASE_ASSETS_INVALID");
  }

  const metadataAsset = release.assets.find((asset) =>
    asset?.name === UNSIGNED_PREVIEW_METADATA_ASSET &&
    typeof asset?.browser_download_url === "string"
  );
  if (metadataAsset === undefined) {
    throw new Error("UNSIGNED_PREVIEW_METADATA_MISSING");
  }

  return metadataAsset.browser_download_url;
}

export function validateUnsignedPreviewMetadata(metadata, input) {
  if (metadata?.version !== 1 ||
      metadata?.tag !== input.tag ||
      metadata?.sourceCommit !== input.sourceCommit ||
      metadata?.signatureStatus !== "unsigned-preview" ||
      metadata?.verifiedPublisher !== false ||
      metadata?.explicitUserOptInRequired !== true ||
      metadata?.checksumManifest !== WINDOWS_CHECKSUM_ASSET) {
    throw new Error("UNSIGNED_PREVIEW_METADATA_INVALID");
  }
}
