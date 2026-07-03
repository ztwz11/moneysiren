import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, posix, resolve, win32 } from "node:path";
import { promisify } from "node:util";
import type { InstallSurface } from "./install-profile.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_RELEASE_REPOSITORY = "ztwz11/moneysiren";
// Keep the source-free installer pinned to the latest published desktop/web release tag.
export const DEFAULT_RELEASE_TAG = "v0.1.1";

export interface ReleaseInstallOptions {
  env?: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  installDir?: string;
  now?: () => Date;
  platform?: NodeJS.Platform;
  repository?: string;
  selectedSurfaces: readonly InstallSurface[];
  signatureVerifier?: ReleaseAssetSignatureVerifier;
  tag?: string;
  trustedWindowsSignerThumbprints?: readonly string[];
}

export interface ReleaseInstallResult {
  repository: string;
  tag: string;
  installDir: string;
  releaseUrl: string;
  assets: readonly InstalledReleaseAsset[];
}

export interface InstalledReleaseAsset {
  surface: Exclude<InstallSurface, "cli">;
  name: string;
  path: string;
  size: number;
  sha256: string;
  checksumVerified: boolean;
  signatureVerified: boolean;
  signatureStatus: string;
}

export interface ReleaseAssetSignatureVerifier {
  verify(input: ReleaseAssetSignatureVerificationInput): Promise<ReleaseAssetSignatureVerificationResult>;
}

export interface ReleaseAssetSignatureVerificationInput {
  assetName: string;
  env: Record<string, string | undefined>;
  expectedSignerThumbprints?: readonly string[];
  path: string;
  platform: NodeJS.Platform;
  surface: Exclude<InstallSurface, "cli">;
  tag: string;
}

export interface ReleaseAssetSignatureVerificationResult {
  verified: boolean;
  status: string;
  message: string;
}

interface GitHubRelease {
  html_url?: unknown;
  tag_name?: unknown;
  assets?: unknown;
}

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

const RELEASE_REPOSITORY_ENV_KEY = "MONEYSIREN_RELEASE_REPOSITORY";
const RELEASE_TAG_ENV_KEY = "MONEYSIREN_RELEASE_TAG";
const RELEASE_INSTALL_DIR_ENV_KEY = "MONEYSIREN_RELEASE_INSTALL_DIR";
const RELEASE_PLATFORM_ENV_KEY = "MONEYSIREN_RELEASE_PLATFORM";
const WINDOWS_SIGNER_THUMBPRINTS_ENV_KEY = "MONEYSIREN_WINDOWS_SIGNER_THUMBPRINTS";
const ALLOW_UNSIGNED_HUD_ENV_KEY = "MONEYSIREN_ALLOW_UNSIGNED_HUD";

export async function installReleaseAssets(options: ReleaseInstallOptions): Promise<ReleaseInstallResult> {
  const env = options.env ?? process.env;
  const repository = normalizeRepository(
    options.repository ?? env[RELEASE_REPOSITORY_ENV_KEY] ?? DEFAULT_RELEASE_REPOSITORY,
  );
  const tag = normalizeTag(options.tag ?? env[RELEASE_TAG_ENV_KEY] ?? DEFAULT_RELEASE_TAG);
  const platform = normalizePlatform(options.platform ?? env[RELEASE_PLATFORM_ENV_KEY] ?? process.platform);
  const configuredInstallDir = options.installDir ?? env[RELEASE_INSTALL_DIR_ENV_KEY];
  const installDir = resolveReleaseInstallDir({
    env,
    ...(configuredInstallDir === undefined ? {} : { installDir: configuredInstallDir }),
    platform,
    tag,
  });
  const release = await fetchRelease({
    fetchImpl: options.fetchImpl,
    repository,
    tag,
  });
  const releaseAssets = parseReleaseAssets(release.assets);
  const checksumAssets = releaseAssets.filter((asset) => asset.name.toLowerCase().includes("sha256sums"));
  const requestedSurfaces = options.selectedSurfaces.filter((surface): surface is Exclude<InstallSurface, "cli"> =>
    surface === "web" || surface === "hud"
  );
  const installedAssets: InstalledReleaseAsset[] = [];

  await mkdir(installDir, { recursive: true });

  for (const surface of requestedSurfaces) {
    const asset = selectSurfaceAsset(surface, platform, releaseAssets);

    if (asset === null) {
      throw new Error(`No ${surface} release asset found for ${platform} in ${repository}@${tag}.`);
    }

    const downloaded = await downloadAsset(options.fetchImpl, asset.browser_download_url);
    const sha256 = sha256Hex(downloaded);
    const checksum = await findChecksum({
      assetName: asset.name,
      checksumAssets,
      fetchImpl: options.fetchImpl,
    });

    if (checksumAssets.length > 0 && checksum === null) {
      throw new Error(`SHA256 checksum entry missing for ${asset.name}.`);
    }

    if (checksum !== null && checksum.toLowerCase() !== sha256) {
      throw new Error(`SHA256 mismatch for ${asset.name}.`);
    }

    const outputPath = join(installDir, sanitizeAssetFileName(asset.name));

    await writeFile(outputPath, downloaded);
    let signature: ReleaseAssetSignatureVerificationResult;
    try {
      signature = await verifyReleaseAssetSignature({
        assetName: asset.name,
        env,
        fetchImpl: options.fetchImpl,
        path: outputPath,
        platform,
        releaseAssets,
        surface,
        tag,
        ...(options.signatureVerifier === undefined ? {} : { signatureVerifier: options.signatureVerifier }),
        ...(options.trustedWindowsSignerThumbprints === undefined
          ? {}
          : { trustedWindowsSignerThumbprints: options.trustedWindowsSignerThumbprints }),
      });
    } catch (error) {
      await unlink(outputPath).catch(() => undefined);
      throw error;
    }

    if (!signature.verified) {
      await unlink(outputPath).catch(() => undefined);
      throw new Error(`Release asset signature verification failed for ${asset.name}: ${signature.status} ${signature.message}`.trim());
    }

    installedAssets.push({
      surface,
      name: asset.name,
      path: outputPath,
      size: downloaded.byteLength,
      sha256,
      checksumVerified: checksum !== null,
      signatureVerified: isVerifiedSignatureStatus(signature.status),
      signatureStatus: signature.status,
    });
  }

  await writeFile(join(installDir, "install-manifest.json"), `${JSON.stringify({
    version: 1,
    repository,
    tag,
    releaseUrl: typeof release.html_url === "string" ? release.html_url : releaseUrl(repository, tag),
    installedAt: (options.now ?? (() => new Date()))().toISOString(),
    selectedSurfaces: options.selectedSurfaces,
    assets: installedAssets.map((asset) => ({
      surface: asset.surface,
      name: asset.name,
      path: asset.path,
      size: asset.size,
      sha256: asset.sha256,
      checksumVerified: asset.checksumVerified,
      signatureVerified: asset.signatureVerified,
      signatureStatus: asset.signatureStatus,
    })),
  }, null, 2)}\n`, "utf8");

  return {
    repository,
    tag,
    installDir,
    releaseUrl: typeof release.html_url === "string" ? release.html_url : releaseUrl(repository, tag),
    assets: installedAssets,
  };
}

export function resolveReleaseInstallDir(input: {
  env?: Record<string, string | undefined>;
  installDir?: string;
  platform?: NodeJS.Platform;
  tag?: string;
} = {}): string {
  const env = input.env ?? process.env;
  const platform = input.platform ?? process.platform;
  const tag = input.tag ?? DEFAULT_RELEASE_TAG;
  const configured = trimToNull(input.installDir ?? env[RELEASE_INSTALL_DIR_ENV_KEY]);

  if (configured !== null) {
    return isAbsoluteForPlatform(platform, configured) ? configured : resolve(process.cwd(), configured);
  }

  const root = platform === "win32"
    ? joinForPlatform(platform, trimToNull(env.APPDATA) ?? win32.join(resolveHomeDirectory(env), "AppData", "Roaming"), "MoneySiren")
    : platform === "darwin"
      ? joinForPlatform(platform, resolveHomeDirectory(env), "Library", "Application Support", "MoneySiren")
      : joinForPlatform(
          platform,
          trimToNull(env.XDG_DATA_HOME) ?? joinForPlatform(platform, resolveHomeDirectory(env), ".local", "share"),
          "moneysiren",
        );

  return joinForPlatform(platform, root, "releases", sanitizePathSegment(tag));
}

function normalizeRepository(repository: string): string {
  const normalized = repository.trim();

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) {
    throw new Error("Release repository must be in owner/name form.");
  }

  return normalized;
}

function normalizeTag(tag: string): string {
  const normalized = tag.trim();

  if (normalized.length === 0 || normalized.length > 128) {
    throw new Error("Release tag is empty or too long.");
  }

  return normalized;
}

function normalizePlatform(platform: string): NodeJS.Platform {
  if (platform === "win32" || platform === "darwin" || platform === "linux") {
    return platform;
  }

  return process.platform;
}

async function fetchRelease(input: {
  fetchImpl: typeof fetch;
  repository: string;
  tag: string;
}): Promise<GitHubRelease> {
  const response = await input.fetchImpl(
    `https://api.github.com/repos/${input.repository}/releases/tags/${encodeURIComponent(input.tag)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "moneysiren-cli-release-installer",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Could not read GitHub Release ${input.repository}@${input.tag}: ${response.status} ${response.statusText}`);
  }

  const body = await response.json() as unknown;

  if (!isRecord(body)) {
    throw new Error("GitHub Release response was not an object.");
  }

  return body;
}

function parseReleaseAssets(value: unknown): GitHubReleaseAsset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .flatMap((asset) => {
      const name = asset.name;
      const browserDownloadUrl = asset.browser_download_url;

      if (typeof name !== "string" || typeof browserDownloadUrl !== "string") {
        return [];
      }

      return [{
        name,
        browser_download_url: browserDownloadUrl,
        ...(typeof asset.size === "number" ? { size: asset.size } : {}),
      }];
    });
}

function selectSurfaceAsset(
  surface: Exclude<InstallSurface, "cli">,
  platform: NodeJS.Platform,
  assets: readonly GitHubReleaseAsset[],
): GitHubReleaseAsset | null {
  const candidates = assets.filter((asset) => !asset.name.toLowerCase().includes("sha256sums"));

  if (surface === "web") {
    return candidates.find((asset) => /^moneysiren-web-runtime-.+\.tar\.gz$/i.test(asset.name)) ?? null;
  }

  if (platform === "win32") {
    return candidates.find(isDirectWindowsHudAsset) ??
      candidates.find((asset) => isWindowsHudAsset(asset.name)) ??
      null;
  }

  if (platform === "darwin") {
    return candidates.find((asset) => /macos/i.test(asset.name) && /\.(tar\.gz|dmg)$/i.test(asset.name)) ?? null;
  }

  return null;
}

function isDirectWindowsHudAsset(asset: GitHubReleaseAsset): boolean {
  return isWindowsHudAsset(asset.name) &&
    /\.exe$/i.test(asset.name) &&
    !isInstallerLikeWindowsAsset(asset.name);
}

function isWindowsHudAsset(name: string): boolean {
  return /\.(exe|msi)$/i.test(name);
}

function isInstallerLikeWindowsAsset(name: string): boolean {
  return /\.msi$/i.test(name) || /(?:^|[._ -])(?:setup|install|installer)(?:[._ -]|$)/i.test(name);
}

async function findChecksum(input: {
  assetName: string;
  checksumAssets: readonly GitHubReleaseAsset[];
  fetchImpl: typeof fetch;
}): Promise<string | null> {
  for (const checksumAsset of input.checksumAssets) {
    const content = await downloadAsset(input.fetchImpl, checksumAsset.browser_download_url);
    const checksum = parseChecksumFile(content.toString("utf8"), input.assetName);

    if (checksum !== null) {
      return checksum;
    }
  }

  return null;
}

async function downloadAsset(fetchImpl: typeof fetch, url: string): Promise<Buffer> {
  const parsed = new URL(url);

  if (parsed.protocol !== "https:") {
    throw new Error("Refusing to download a non-HTTPS release asset.");
  }

  const response = await fetchImpl(url, {
    headers: {
      "User-Agent": "moneysiren-cli-release-installer",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not download release asset: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function parseChecksumFile(content: string, assetName: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line.trim());

    if (match !== null && basename(match[2] ?? "") === assetName) {
      return match[1] ?? null;
    }
  }

  return null;
}

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function verifyReleaseAssetSignature(input: {
  assetName: string;
  env: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  path: string;
  platform: NodeJS.Platform;
  releaseAssets: readonly GitHubReleaseAsset[];
  signatureVerifier?: ReleaseAssetSignatureVerifier;
  surface: Exclude<InstallSurface, "cli">;
  tag: string;
  trustedWindowsSignerThumbprints?: readonly string[];
}): Promise<ReleaseAssetSignatureVerificationResult> {
  const verifier = input.signatureVerifier ?? defaultReleaseAssetSignatureVerifier;
  const expectedSignerThumbprints = await findExpectedSignerThumbprints({
    assetName: input.assetName,
    env: input.env,
    fetchImpl: input.fetchImpl,
    platform: input.platform,
    releaseAssets: input.releaseAssets,
    surface: input.surface,
    ...(input.trustedWindowsSignerThumbprints === undefined
      ? {}
      : { trustedWindowsSignerThumbprints: input.trustedWindowsSignerThumbprints }),
  });

  return verifier.verify({
    assetName: input.assetName,
    env: input.env,
    ...(expectedSignerThumbprints === null ? {} : { expectedSignerThumbprints }),
    path: input.path,
    platform: input.platform,
    surface: input.surface,
    tag: input.tag,
  });
}

const defaultReleaseAssetSignatureVerifier: ReleaseAssetSignatureVerifier = {
  async verify(input) {
    if (input.surface !== "hud" || input.platform !== "win32") {
      return {
        verified: true,
        status: "not-required",
        message: "No platform signature check is required for this release asset.",
      };
    }

    if (!/\.(exe|msi)$/i.test(input.assetName)) {
      return {
        verified: false,
        status: "unsupported",
        message: "Windows HUD release assets must be .exe or .msi artifacts.",
      };
    }

    if (input.expectedSignerThumbprints === undefined || input.expectedSignerThumbprints.length === 0) {
      const unsignedHudAllowance = unsignedHudAllowanceStatus(input.env, input.tag);

      if (unsignedHudAllowance !== null) {
        return {
          verified: true,
          status: unsignedHudAllowance,
          message: unsignedHudAllowance === "unsigned-opt-in-accepted"
            ? "Unsigned Windows HUD artifact accepted by explicit local smoke opt-in."
            : "Unsigned Windows HUD artifact accepted for prerelease review.",
        };
      }

      return {
        verified: false,
        status: "missing-signature-metadata",
        message: `Windows HUD release assets require ${WINDOWS_SIGNER_THUMBPRINTS_ENV_KEY} or moneysiren-tray-windows-SIGNATURE.json metadata.`,
      };
    }

    return verifyWindowsAuthenticodeSignature(input.path, input.expectedSignerThumbprints);
  },
};

async function findExpectedSignerThumbprints(input: {
  assetName: string;
  env: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  platform: NodeJS.Platform;
  releaseAssets: readonly GitHubReleaseAsset[];
  surface: Exclude<InstallSurface, "cli">;
  trustedWindowsSignerThumbprints?: readonly string[];
}): Promise<readonly string[] | null> {
  if (input.surface !== "hud" || input.platform !== "win32") {
    return null;
  }

  const trustedThumbprints = normalizeThumbprintList([
    ...(input.trustedWindowsSignerThumbprints ?? []),
    ...parseThumbprintEnv(input.env[WINDOWS_SIGNER_THUMBPRINTS_ENV_KEY]),
  ]);

  if (trustedThumbprints.length > 0) {
    return trustedThumbprints;
  }

  const metadataAsset = input.releaseAssets.find((asset) =>
    /^moneysiren-tray-windows-SIGNATURE\.json$/i.test(asset.name)
  );

  if (metadataAsset === undefined) {
    return null;
  }

  const metadata = JSON.parse((await downloadAsset(input.fetchImpl, metadataAsset.browser_download_url)).toString("utf8")) as unknown;
  const entries = Array.isArray(metadata) ? metadata : [metadata];

  for (const entry of entries) {
    if (!isRecord(entry) || entry.assetName !== input.assetName || typeof entry.signerThumbprint !== "string") {
      continue;
    }

    return [normalizeThumbprint(entry.signerThumbprint)];
  }

  return null;
}

function isVerifiedSignatureStatus(status: string): boolean {
  return status !== "not-required" &&
    status !== "unsigned-prerelease-accepted" &&
    status !== "unsigned-opt-in-accepted";
}

function unsignedHudAllowanceStatus(env: Record<string, string | undefined>, tag: string): string | null {
  const configured = env[ALLOW_UNSIGNED_HUD_ENV_KEY]?.trim().toLowerCase();

  if (configured !== undefined && configured.length > 0) {
    return ["1", "true", "yes", "on"].includes(configured) ? "unsigned-opt-in-accepted" : null;
  }

  return /-(?:alpha|beta|rc)(?:[.\d-]*)?$/i.test(tag) ? "unsigned-prerelease-accepted" : null;
}

async function verifyWindowsAuthenticodeSignature(
  path: string,
  expectedSignerThumbprints: readonly string[],
): Promise<ReleaseAssetSignatureVerificationResult> {
  const literalPath = powerShellSingleQuotedString(path);

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      [
        `$signature = Get-AuthenticodeSignature -LiteralPath ${literalPath}`,
        "$status = [string]$signature.Status",
        "$message = [string]$signature.StatusMessage",
        "if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate) {",
        "  Write-Output ($status + \"|\" + $message)",
        "  exit 1",
        "}",
        "Write-Output ($status + \"|\" + $signature.SignerCertificate.Thumbprint + \"|\" + $signature.SignerCertificate.Subject)",
      ].join("; "),
    ], {
      windowsHide: true,
      timeout: 30_000,
    });

    const [status, signerThumbprint, ...messageParts] = stdout.trim().split("|");
    const normalizedSignerThumbprint = normalizeThumbprint(signerThumbprint ?? "");
    const normalizedExpectedSignerThumbprints = expectedSignerThumbprints.map(normalizeThumbprint);

    if (!normalizedExpectedSignerThumbprints.includes(normalizedSignerThumbprint)) {
      return {
        verified: false,
        status: "signer-mismatch",
        message: `Expected signer ${normalizedExpectedSignerThumbprints.join(", ")}, got ${normalizedSignerThumbprint || "unknown"}.`,
      };
    }

    return {
      verified: true,
      status: status ?? "Valid",
      message: messageParts.join("|"),
    };
  } catch (error) {
    const output = isRecord(error) && typeof error.stdout === "string" ? error.stdout.trim() : "";
    const [status, ...messageParts] = output.split("|");

    return {
      verified: false,
      status: status && status.length > 0 ? status : "Unknown",
      message: messageParts.join("|") || (error instanceof Error ? error.message : String(error)),
    };
  }
}

function normalizeThumbprint(value: string): string {
  return value.replaceAll(/\s/g, "").toUpperCase();
}

function normalizeThumbprintList(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.map(normalizeThumbprint).filter((value) => value.length > 0)));
}

function parseThumbprintEnv(value: string | undefined): readonly string[] {
  if (value === undefined) {
    return [];
  }

  return value.split(/[,\s;]+/).map((part) => part.trim()).filter((part) => part.length > 0);
}

function powerShellSingleQuotedString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sanitizeAssetFileName(name: string): string {
  return basename(name).replace(/[^A-Za-z0-9._ -]/g, "_");
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function releaseUrl(repository: string, tag: string): string {
  return `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`;
}

function resolveHomeDirectory(env: Record<string, string | undefined>): string {
  return trimToNull(env.HOME) ?? trimToNull(env.USERPROFILE) ?? homedir();
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function joinForPlatform(platform: NodeJS.Platform, ...segments: string[]): string {
  return platform === "win32" ? win32.join(...segments) : posix.join(...segments);
}

function isAbsoluteForPlatform(platform: NodeJS.Platform, value: string): boolean {
  return platform === "win32" ? win32.isAbsolute(value) : posix.isAbsolute(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
