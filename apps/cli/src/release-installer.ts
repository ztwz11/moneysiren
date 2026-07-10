import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, parse, posix, resolve, win32 } from "node:path";
import { promisify } from "node:util";
import type { InstallSurface } from "./install-profile.js";
import { validateTarGzArchive } from "./release-archive.js";
import {
  buildReleaseAssetUrl,
  downloadBoundedReleaseBytes,
  downloadVerifiedReleaseFile,
} from "./release-download.js";
import {
  MAX_RELEASE_MANIFEST_BYTES,
  RELEASE_MANIFEST_FILE_NAME,
  parseReleaseManifest,
  releaseAssetMaximumBytes,
  selectReleaseAsset,
  type ReleaseManifestAsset,
} from "./release-manifest.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_RELEASE_REPOSITORY = "ztwz11/moneysiren";
// Keep this pinned until the matching immutable v0.1.6 assets are published.
export const DEFAULT_RELEASE_TAG = "v0.1.5";

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
  timeoutMs?: number;
  trustedWindowsSignerThumbprints?: readonly string[];
}

export interface ReleaseInstallResult {
  repository: string;
  tag: string;
  version: string;
  sourceCommit: string;
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
  checksumVerified: true;
  signatureVerified: boolean;
  signatureStatus: string;
  platform: "any" | "win32" | "darwin";
  signingState: "not-required" | "signed" | "unsigned";
}

export interface ReleaseRuntimeInstallStatus {
  status: "ready" | "not-installed" | "invalid";
  installDir: string;
  repository: string;
  tag: string;
  version: string | null;
  sourceCommit: string | null;
  assets: readonly InstalledReleaseAsset[];
  message: string;
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

interface LocalInstallManifest {
  schemaVersion: 2;
  status: "ready";
  repository: string;
  tag: string;
  version: string;
  sourceCommit: string;
  releaseUrl: string;
  installedAt: string;
  selectedSurfaces: readonly InstallSurface[];
  assets: readonly InstalledReleaseAsset[];
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
  const requestedSurfaces = Array.from(new Set(options.selectedSurfaces.filter(
    (surface): surface is Exclude<InstallSurface, "cli"> => surface === "web" || surface === "hud",
  )));

  if (requestedSurfaces.length === 0) {
    throw new Error("Release asset installation requires web or HUD selection.");
  }

  await assertSafeInstallDestination(installDir);

  const manifestUrl = buildReleaseAssetUrl(repository, tag, RELEASE_MANIFEST_FILE_NAME);
  const manifestBytes = await downloadBoundedReleaseBytes({
    fetchImpl: options.fetchImpl,
    maximumBytes: MAX_RELEASE_MANIFEST_BYTES,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    url: manifestUrl,
  });
  const manifest = parseReleaseManifest(parseJsonManifest(manifestBytes), {
    repository,
    tag,
  });
  const parentDir = dirname(installDir);
  const transactionId = randomUUID();
  const stagingDir = join(parentDir, `.${basename(installDir)}.staging-${transactionId}`);
  const backupDir = join(parentDir, `.${basename(installDir)}.backup-${transactionId}`);
  const stagedAssets: InstalledReleaseAsset[] = [];

  await mkdir(parentDir, { recursive: true });
  await mkdir(stagingDir);

  try {
    for (const surface of requestedSurfaces) {
      const asset = selectReleaseAsset(manifest, surface, platform);

      if (asset === null) {
        throw new Error(`Release manifest has no ${surface} asset for ${platform}.`);
      }

      const partialPath = join(stagingDir, `${asset.name}.partial`);
      const stagedPath = join(stagingDir, asset.name);
      const finalPath = join(installDir, asset.name);
      const downloaded = await downloadVerifiedReleaseFile({
        expectedSha256: asset.sha256,
        expectedSize: asset.size,
        fetchImpl: options.fetchImpl,
        maximumBytes: releaseAssetMaximumBytes(asset),
        temporaryPath: partialPath,
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
        url: buildReleaseAssetUrl(repository, tag, asset.name),
      });

      if (asset.archive === "tar.gz") {
        await validateTarGzArchive(partialPath);
      }

      const signature = await verifyReleaseAssetSignature({
        asset,
        env,
        path: partialPath,
        platform,
        tag,
        ...(options.signatureVerifier === undefined ? {} : { signatureVerifier: options.signatureVerifier }),
        ...(options.trustedWindowsSignerThumbprints === undefined
          ? {}
          : { trustedWindowsSignerThumbprints: options.trustedWindowsSignerThumbprints }),
      });

      if (!signature.verified) {
        throw new Error(
          `Release asset signature verification failed for ${asset.name}: ${signature.status} ${signature.message}`.trim(),
        );
      }

      await rename(partialPath, stagedPath);
      stagedAssets.push({
        surface,
        name: asset.name,
        path: finalPath,
        size: downloaded.size,
        sha256: downloaded.sha256,
        checksumVerified: true,
        signatureVerified: isLocallyVerifiedSignatureStatus(signature.status),
        signatureStatus: signature.status,
        platform: asset.platform,
        signingState: asset.signing.state,
      });
    }

    const releaseUrl = releasePageUrl(repository, tag);
    const localManifest: LocalInstallManifest = {
      schemaVersion: 2,
      status: "ready",
      repository,
      tag,
      version: manifest.version,
      sourceCommit: manifest.sourceCommit,
      releaseUrl,
      installedAt: (options.now ?? (() => new Date()))().toISOString(),
      selectedSurfaces: options.selectedSurfaces,
      assets: stagedAssets,
    };

    await writeDurableJson(join(stagingDir, "install-manifest.json"), localManifest);
    await activateStagedInstall({
      backupDir,
      installDir,
      stagingDir,
    });

    return {
      repository,
      tag,
      version: manifest.version,
      sourceCommit: manifest.sourceCommit,
      installDir,
      releaseUrl,
      assets: stagedAssets,
    };
  } catch (error) {
    await rm(stagingDir, {
      recursive: true,
      force: true,
    }).catch(() => undefined);
    throw error;
  }
}

export async function readReleaseRuntimeInstallStatus(input: {
  env?: Record<string, string | undefined>;
  installDir?: string;
  platform?: NodeJS.Platform;
  repository?: string;
  tag?: string;
} = {}): Promise<ReleaseRuntimeInstallStatus> {
  const env = input.env ?? process.env;
  const repository = normalizeRepository(
    input.repository ?? env[RELEASE_REPOSITORY_ENV_KEY] ?? DEFAULT_RELEASE_REPOSITORY,
  );
  const tag = normalizeTag(input.tag ?? env[RELEASE_TAG_ENV_KEY] ?? DEFAULT_RELEASE_TAG);
  const platform = normalizePlatform(input.platform ?? env[RELEASE_PLATFORM_ENV_KEY] ?? process.platform);
  const installDir = resolveReleaseInstallDir({
    env,
    ...(input.installDir === undefined ? {} : { installDir: input.installDir }),
    platform,
    tag,
  });
  let source: string;

  try {
    source = await readFile(join(installDir, "install-manifest.json"), "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        status: "not-installed",
        installDir,
        repository,
        tag,
        version: null,
        sourceCommit: null,
        assets: [],
        message: "No verified release runtime is installed.",
      };
    }

    return invalidRuntimeStatus(installDir, repository, tag);
  }

  try {
    const manifest = parseLocalInstallManifest(JSON.parse(source), {
      installDir,
      repository,
      tag,
    });

    for (const asset of manifest.assets) {
      const metadata = await stat(asset.path);

      if (!metadata.isFile() || metadata.size !== asset.size || await sha256File(asset.path) !== asset.sha256) {
        return invalidRuntimeStatus(installDir, repository, tag);
      }
    }

    return {
      status: "ready",
      installDir,
      repository,
      tag,
      version: manifest.version,
      sourceCommit: manifest.sourceCommit,
      assets: manifest.assets,
      message: "Verified release runtime is ready.",
    };
  } catch {
    return invalidRuntimeStatus(installDir, repository, tag);
  }
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

async function activateStagedInstall(input: {
  backupDir: string;
  installDir: string;
  stagingDir: string;
}): Promise<void> {
  const previousExists = await pathExists(input.installDir);

  if (previousExists) {
    await rename(input.installDir, input.backupDir);
  }

  try {
    await rename(input.stagingDir, input.installDir);
  } catch {
    if (previousExists) {
      try {
        await rename(input.backupDir, input.installDir);
      } catch {
        throw new Error(
          `Release activation failed and the previous runtime remains at the rollback path: ${input.backupDir}`,
        );
      }
    }

    throw new Error("Release activation failed; the previous runtime was preserved.");
  }

  if (previousExists) {
    await rm(input.backupDir, {
      recursive: true,
      force: true,
    }).catch(() => undefined);
  }
}

async function assertSafeInstallDestination(installDir: string): Promise<void> {
  const root = parse(installDir).root;

  if (installDir === root || dirname(installDir) === installDir) {
    throw new Error("Release install directory cannot be a filesystem root.");
  }

  try {
    const metadata = await lstat(installDir);

    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error("Release install directory must be a real directory.");
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function verifyReleaseAssetSignature(input: {
  asset: ReleaseManifestAsset;
  env: Record<string, string | undefined>;
  path: string;
  platform: NodeJS.Platform;
  signatureVerifier?: ReleaseAssetSignatureVerifier;
  tag: string;
  trustedWindowsSignerThumbprints?: readonly string[];
}): Promise<ReleaseAssetSignatureVerificationResult> {
  const configuredThumbprints = normalizeThumbprintList([
    ...(input.trustedWindowsSignerThumbprints ?? []),
    ...parseThumbprintEnv(input.env[WINDOWS_SIGNER_THUMBPRINTS_ENV_KEY]),
  ]);

  if (
    input.asset.platform === "win32" &&
    input.asset.signing.state === "signed" &&
    configuredThumbprints.length > 0 &&
    !configuredThumbprints.includes(input.asset.signing.signerThumbprint ?? "")
  ) {
    return {
      verified: false,
      status: "signer-not-trusted",
      message: "The manifest signer is not in the configured allowlist.",
    };
  }

  const expectedSignerThumbprints = input.asset.signing.state === "signed" &&
    input.asset.signing.signerThumbprint !== undefined
    ? [input.asset.signing.signerThumbprint]
    : undefined;
  const verificationInput: ReleaseAssetSignatureVerificationInput = {
    assetName: input.asset.name,
    env: input.env,
    ...(expectedSignerThumbprints === undefined ? {} : { expectedSignerThumbprints }),
    path: input.path,
    platform: input.platform,
    surface: input.asset.surface,
    tag: input.tag,
  };

  if (input.signatureVerifier !== undefined) {
    return input.signatureVerifier.verify(verificationInput);
  }

  if (input.asset.surface !== "hud") {
    return {
      verified: true,
      status: "not-required",
      message: "The web runtime is integrity-verified by the release manifest.",
    };
  }

  if (input.asset.signing.state === "unsigned") {
    const allowance = unsignedHudAllowanceStatus(input.env, input.tag);

    return allowance === null
      ? {
          verified: false,
          status: "unsigned-not-allowed",
          message: "Unsigned HUD assets require an explicit local smoke opt-in.",
        }
      : {
          verified: true,
          status: allowance,
          message: "Unsigned HUD artifact accepted only for explicit local review.",
        };
  }

  if (input.asset.platform === "darwin") {
    return {
      verified: true,
      status: "signed-notarized-manifest",
      message: "The release manifest records successful Apple signing and notarization.",
    };
  }

  if (input.asset.platform !== "win32" || expectedSignerThumbprints === undefined) {
    return {
      verified: false,
      status: "unsupported-signing-state",
      message: "The HUD signing state cannot be verified on this platform.",
    };
  }

  return verifyWindowsAuthenticodeSignature(input.path, expectedSignerThumbprints);
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
        message: "The Authenticode signer does not match the release manifest.",
      };
    }

    return {
      verified: true,
      status: status ?? "Valid",
      message: messageParts.join("|"),
    };
  } catch (error) {
    const output = isRecord(error) && typeof error.stdout === "string" ? error.stdout.trim() : "";
    const [status] = output.split("|");

    return {
      verified: false,
      status: status && status.length > 0 ? status : "Unknown",
      message: "Windows Authenticode verification did not succeed.",
    };
  }
}

function parseJsonManifest(content: Buffer): unknown {
  try {
    return JSON.parse(content.toString("utf8"));
  } catch {
    throw new Error("Release manifest is not valid JSON.");
  }
}

function parseLocalInstallManifest(
  value: unknown,
  expected: {
    installDir: string;
    repository: string;
    tag: string;
  },
): LocalInstallManifest {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.status !== "ready" ||
    value.repository !== expected.repository ||
    value.tag !== expected.tag ||
    typeof value.version !== "string" ||
    value.version !== expected.tag.slice(1) ||
    typeof value.sourceCommit !== "string" ||
    !/^[a-f0-9]{40}$/.test(value.sourceCommit) ||
    typeof value.releaseUrl !== "string" ||
    typeof value.installedAt !== "string" ||
    !Array.isArray(value.selectedSurfaces) ||
    !Array.isArray(value.assets) ||
    value.assets.length === 0
  ) {
    throw new Error("Local install manifest is invalid.");
  }

  const assets = value.assets.map((asset) => parseLocalInstalledAsset(asset, expected.installDir));

  return {
    schemaVersion: 2,
    status: "ready",
    repository: value.repository,
    tag: value.tag,
    version: value.version,
    sourceCommit: value.sourceCommit,
    releaseUrl: value.releaseUrl,
    installedAt: value.installedAt,
    selectedSurfaces: value.selectedSurfaces.filter(isInstallSurface),
    assets,
  };
}

function parseLocalInstalledAsset(value: unknown, installDir: string): InstalledReleaseAsset {
  if (
    !isRecord(value) ||
    (value.surface !== "web" && value.surface !== "hud") ||
    typeof value.name !== "string" ||
    basename(value.name) !== value.name ||
    typeof value.path !== "string" ||
    value.path !== join(installDir, value.name) ||
    typeof value.size !== "number" ||
    !Number.isSafeInteger(value.size) ||
    value.size <= 0 ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    value.checksumVerified !== true ||
    typeof value.signatureVerified !== "boolean" ||
    typeof value.signatureStatus !== "string" ||
    !["any", "win32", "darwin"].includes(String(value.platform)) ||
    !["not-required", "signed", "unsigned"].includes(String(value.signingState))
  ) {
    throw new Error("Local install manifest asset is invalid.");
  }

  return {
    surface: value.surface,
    name: value.name,
    path: value.path,
    size: value.size,
    sha256: value.sha256,
    checksumVerified: true,
    signatureVerified: value.signatureVerified,
    signatureStatus: value.signatureStatus,
    platform: value.platform as InstalledReleaseAsset["platform"],
    signingState: value.signingState as InstalledReleaseAsset["signingState"],
  };
}

async function writeDurableJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.partial`;
  const file = await open(temporaryPath, "wx", 0o600);

  try {
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }

  await rename(temporaryPath, path);
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

function invalidRuntimeStatus(
  installDir: string,
  repository: string,
  tag: string,
): ReleaseRuntimeInstallStatus {
  return {
    status: "invalid",
    installDir,
    repository,
    tag,
    version: null,
    sourceCommit: null,
    assets: [],
    message: "Installed release runtime failed manifest or integrity validation.",
  };
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

  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(normalized)) {
    throw new Error("Release tag must be a v-prefixed semantic version.");
  }

  return normalized;
}

function normalizePlatform(platform: string): NodeJS.Platform {
  if (platform === "win32" || platform === "darwin" || platform === "linux") {
    return platform;
  }

  return process.platform;
}

function isLocallyVerifiedSignatureStatus(status: string): boolean {
  return status.toLowerCase() === "valid";
}

function unsignedHudAllowanceStatus(env: Record<string, string | undefined>, tag: string): string | null {
  const configured = env[ALLOW_UNSIGNED_HUD_ENV_KEY]?.trim().toLowerCase();

  if (configured !== undefined && configured.length > 0) {
    return ["1", "true", "yes", "on"].includes(configured) ? "unsigned-opt-in-accepted" : null;
  }

  return /-(?:alpha|beta|rc)(?:[.\d-]*)?$/i.test(tag) ? "unsigned-prerelease-accepted" : null;
}

function normalizeThumbprint(value: string): string {
  return value.replaceAll(/\s/g, "").toUpperCase();
}

function normalizeThumbprintList(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.map(normalizeThumbprint).filter((value) => value.length > 0)));
}

function parseThumbprintEnv(value: string | undefined): readonly string[] {
  return value === undefined
    ? []
    : value.split(/[,\s;]+/).map((part) => part.trim()).filter((part) => part.length > 0);
}

function powerShellSingleQuotedString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function releasePageUrl(repository: string, tag: string): string {
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

function isInstallSurface(value: unknown): value is InstallSurface {
  return value === "cli" || value === "web" || value === "hud";
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
