import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, posix, resolve, win32 } from "node:path";
import type { InstallSurface } from "./install-profile.js";
import { CLI_VERSION } from "./version.js";

export const DEFAULT_RELEASE_REPOSITORY = "ztwz11/moneysiren";
export const DEFAULT_RELEASE_TAG = `v${CLI_VERSION}`;

export interface ReleaseInstallOptions {
  env?: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  installDir?: string;
  now?: () => Date;
  platform?: NodeJS.Platform;
  repository?: string;
  selectedSurfaces: readonly InstallSurface[];
  tag?: string;
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
    installedAssets.push({
      surface,
      name: asset.name,
      path: outputPath,
      size: downloaded.byteLength,
      sha256,
      checksumVerified: checksum !== null,
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
  const configured = trimToNull(input.installDir);

  if (configured !== null) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
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
    return candidates.find((asset) => /\.(exe|msi)$/i.test(asset.name)) ?? null;
  }

  if (platform === "darwin") {
    return candidates.find((asset) => /macos/i.test(asset.name) && /\.(tar\.gz|dmg)$/i.test(asset.name)) ?? null;
  }

  return null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
