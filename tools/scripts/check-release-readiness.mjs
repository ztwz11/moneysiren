import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = parseArgs(process.argv.slice(2));
const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const repository = args.repo ?? "ztwz11/moneysiren";
const tag = args.tag ?? `v${packageJson.version}`;
const installDir = resolve(args.dir ?? ".tmp/release-readiness");
const downloadLimit = Number.parseInt(args.maxBytes ?? `${256 * 1024 * 1024}`, 10);
const metadataDownloadLimit = 1024 * 1024;
const failures = [];

await rm(installDir, { recursive: true, force: true });
await mkdir(installDir, { recursive: true });

const release = await fetchJson(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`);
const assets = Array.isArray(release.assets) ? release.assets.filter(isAsset) : [];
const checksumAssets = assets.filter((asset) => /sha256sums/i.test(asset.name));
const payloadAssets = assets.filter((asset) => !/sha256sums|signature\.json/i.test(asset.name));
const windowsSignatureAsset = assets.find((asset) => /^moneysiren-tray-windows-SIGNATURE\.json$/i.test(asset.name));
const windowsPayloadAssets = payloadAssets.filter((asset) => /\.(exe|msi)$/i.test(asset.name));
const windowsSignatureMetadata = await readWindowsSignatureMetadata();

if (payloadAssets.length === 0) {
  failures.push("No downloadable release payload assets were found.");
}

for (const asset of payloadAssets) {
  await verifyPayloadAsset(asset);
}

await verifyWindowsSignatureMetadata();

if (failures.length > 0) {
  console.error(`Release readiness failed for ${repository}@${tag}`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release readiness passed for ${repository}@${tag}`);
for (const asset of payloadAssets) {
  console.log(`- ${asset.name}`);
}

async function verifyPayloadAsset(asset) {
  const outputPath = join(installDir, sanitizeAssetFileName(asset.name));
  const content = await downloadAsset(asset.browser_download_url, outputPath, asset.size);
  const actualSha256 = sha256Hex(content);
  const expectedSha256 = await findChecksum(asset.name);

  if (expectedSha256 === null) {
    failures.push(`Missing SHA256 checksum entry for ${asset.name}.`);
  } else if (expectedSha256.toLowerCase() !== actualSha256) {
    failures.push(`SHA256 mismatch for ${asset.name}.`);
  }

  if (/\.(exe|msi)$/i.test(asset.name)) {
    await verifyWindowsAuthenticode(asset.name, outputPath, windowsSignatureMetadata.get(asset.name));
  }
}

async function readWindowsSignatureMetadata() {
  const metadataByAsset = new Map();

  if (windowsPayloadAssets.length === 0) {
    return metadataByAsset;
  }

  if (windowsSignatureAsset === undefined) {
    failures.push("Missing moneysiren-tray-windows-SIGNATURE.json for Windows installer asset(s).");
    return metadataByAsset;
  }

  const metadata = await fetchJson(windowsSignatureAsset.browser_download_url);
  const entries = Array.isArray(metadata) ? metadata : [metadata];

  for (const value of entries) {
    if (!isRecord(value) || typeof value.assetName !== "string") {
      continue;
    }

    metadataByAsset.set(value.assetName, value);
  }

  return metadataByAsset;
}

async function verifyWindowsSignatureMetadata() {
  if (windowsPayloadAssets.length === 0 || windowsSignatureAsset === undefined) {
    return;
  }

  for (const asset of windowsPayloadAssets) {
    const entry = windowsSignatureMetadata.get(asset.name);

    if (
      entry === undefined ||
      typeof entry.signerThumbprint !== "string" ||
      entry.signerThumbprint.trim().length === 0 ||
      entry.signatureStatus !== "Valid"
    ) {
      failures.push(`Missing valid signature metadata entry for ${asset.name}.`);
    }
  }
}

async function verifyWindowsAuthenticode(assetName, path, metadataEntry) {
  if (process.platform !== "win32") {
    console.log(`Skipping local Authenticode verification for ${assetName} on ${process.platform}.`);
    return;
  }

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

    const [status, thumbprint] = stdout.trim().split("|");
    if (status !== "Valid" || thumbprint === undefined || thumbprint.trim().length === 0) {
      failures.push(`Windows Authenticode verification did not return a valid signer for ${assetName}.`);
      return;
    }

    if (
      isRecord(metadataEntry) &&
      typeof metadataEntry.signerThumbprint === "string" &&
      normalizeThumbprint(thumbprint) !== normalizeThumbprint(metadataEntry.signerThumbprint)
    ) {
      failures.push(`Windows signer thumbprint mismatch for ${assetName}.`);
    }
  } catch (error) {
    const output = isRecord(error) && typeof error.stdout === "string" ? error.stdout.trim() : "";
    failures.push(`Windows Authenticode verification failed for ${assetName}: ${output || error.message}`);
  }
}

async function findChecksum(assetName) {
  for (const checksumAsset of checksumAssets) {
    const content = await downloadText(checksumAsset.browser_download_url);
    const checksum = parseChecksumFile(content, assetName);
    if (checksum !== null) {
      return checksum;
    }
  }

  return null;
}

async function downloadAsset(url, outputPath, expectedSize) {
  const response = await fetchWithUserAgent(url);
  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await readResponseBodyWithLimit(response, basename(outputPath));
  if (typeof expectedSize === "number" && expectedSize > 0 && content.byteLength !== expectedSize) {
    failures.push(`Downloaded size mismatch for ${basename(outputPath)}.`);
  }

  await writeFile(outputPath, content);
  return content;
}

async function readResponseBodyWithLimit(response, label, limit = downloadLimit) {
  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  if (contentLength > limit) {
    throw new Error(`Remote asset exceeds max byte limit before download: ${label}`);
  }

  if (response.body === null) {
    return Buffer.from(await response.arrayBuffer());
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > limit) {
      throw new Error(`Downloaded asset exceeds max byte limit: ${label}`);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function downloadText(url) {
  const response = await fetchWithUserAgent(url);
  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
  }

  return (await readResponseBodyWithLimit(response, basename(new URL(url).pathname), metadataDownloadLimit)).toString("utf8");
}

async function fetchJson(url) {
  const response = await fetchWithUserAgent(url, {
    Accept: url.includes("api.github.com") ? "application/vnd.github+json" : "application/json",
  });
  if (!response.ok) {
    throw new Error(`Could not read ${url}: ${response.status} ${response.statusText}`);
  }

  return JSON.parse((await readResponseBodyWithLimit(response, basename(new URL(url).pathname), metadataDownloadLimit)).toString("utf8"));
}

function fetchWithUserAgent(url, headers = {}) {
  return fetch(url, {
    headers: {
      ...headers,
      "User-Agent": "moneysiren-release-readiness",
    },
  });
}

function parseChecksumFile(content, assetName) {
  for (const line of content.split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (match !== null && basename(match[2] ?? "") === assetName) {
      return match[1] ?? null;
    }
  }

  return null;
}

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeThumbprint(value) {
  return value.replaceAll(/\s/g, "").toUpperCase();
}

function sanitizeAssetFileName(name) {
  return basename(name).replace(/[^A-Za-z0-9._ -]/g, "_");
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--repo") {
      parsed.repo = values[++index];
    } else if (value === "--tag") {
      parsed.tag = values[++index];
    } else if (value === "--dir") {
      parsed.dir = values[++index];
    } else if (value === "--max-bytes") {
      parsed.maxBytes = values[++index];
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return parsed;
}

function powerShellSingleQuotedString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function isAsset(value) {
  return isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.browser_download_url === "string";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
