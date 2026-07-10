import { createHash } from "node:crypto";
import { open, unlink } from "node:fs/promises";

export const DEFAULT_RELEASE_DOWNLOAD_TIMEOUT_MS = 30_000;
export const MAX_RELEASE_REDIRECTS = 5;

const TRUSTED_RELEASE_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

export interface ReleaseDownloadOptions {
  fetchImpl: typeof fetch;
  url: string;
  timeoutMs?: number;
}

export interface VerifiedReleaseDownloadOptions extends ReleaseDownloadOptions {
  expectedSha256: string;
  expectedSize: number;
  maximumBytes: number;
  temporaryPath: string;
}

export interface VerifiedReleaseDownload {
  size: number;
  sha256: string;
}

export function buildReleaseAssetUrl(repository: string, tag: string, assetName: string): string {
  const [owner, name] = repository.split("/");

  if (!owner || !name || repository.split("/").length !== 2) {
    throw new Error("Release repository must be in owner/name form.");
  }

  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`;
}

export async function downloadBoundedReleaseBytes(
  options: ReleaseDownloadOptions & {
    maximumBytes: number;
  },
): Promise<Buffer> {
  assertMaximumBytes(options.maximumBytes);
  const controller = new AbortController();
  const timeout = createTimeout(controller, options.timeoutMs);

  try {
    const response = await fetchWithTrustedRedirects({
      fetchImpl: options.fetchImpl,
      signal: controller.signal,
      url: options.url,
    });
    const contentLength = parseContentLength(response);

    if (contentLength !== null && contentLength > options.maximumBytes) {
      throw new Error("Release download exceeds the configured byte limit.");
    }

    const reader = response.body?.getReader();

    if (reader === undefined) {
      throw new Error("Release download returned no response body.");
    }

    const chunks: Buffer[] = [];
    let total = 0;

    try {
      while (true) {
        const next = await reader.read();

        if (next.done) {
          break;
        }

        const chunk = Buffer.from(next.value);
        total += chunk.byteLength;

        if (total > options.maximumBytes) {
          throw new Error("Release download exceeds the configured byte limit.");
        }

        chunks.push(chunk);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }

    if (total === 0) {
      throw new Error("Release download was empty.");
    }

    return Buffer.concat(chunks, total);
  } catch (error) {
    throw normalizeDownloadError(error, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadVerifiedReleaseFile(
  options: VerifiedReleaseDownloadOptions,
): Promise<VerifiedReleaseDownload> {
  assertMaximumBytes(options.maximumBytes);

  if (
    !Number.isSafeInteger(options.expectedSize) ||
    options.expectedSize <= 0 ||
    options.expectedSize > options.maximumBytes
  ) {
    throw new Error("Release manifest asset size is outside the configured byte limit.");
  }

  if (!/^[a-f0-9]{64}$/.test(options.expectedSha256)) {
    throw new Error("Release manifest asset SHA256 is invalid.");
  }

  const controller = new AbortController();
  const timeout = createTimeout(controller, options.timeoutMs);
  let file: Awaited<ReturnType<typeof open>> | null = null;

  try {
    const response = await fetchWithTrustedRedirects({
      fetchImpl: options.fetchImpl,
      signal: controller.signal,
      url: options.url,
    });
    const contentLength = parseContentLength(response);

    if (contentLength !== null && contentLength !== options.expectedSize) {
      throw new Error("Release asset Content-Length does not match the manifest.");
    }

    const reader = response.body?.getReader();

    if (reader === undefined) {
      throw new Error("Release download returned no response body.");
    }

    file = await open(options.temporaryPath, "wx", 0o600);
    const hash = createHash("sha256");
    let total = 0;

    try {
      while (true) {
        const next = await reader.read();

        if (next.done) {
          break;
        }

        const chunk = Buffer.from(next.value);
        total += chunk.byteLength;

        if (total > options.expectedSize || total > options.maximumBytes) {
          throw new Error("Release asset download exceeded the manifest size.");
        }

        hash.update(chunk);
        await file.write(chunk);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }

    if (total !== options.expectedSize) {
      throw new Error("Release asset download was partial.");
    }

    const sha256 = hash.digest("hex");

    if (sha256 !== options.expectedSha256) {
      throw new Error("Release asset SHA256 does not match the manifest.");
    }

    await file.sync();
    await file.close();
    file = null;

    return {
      size: total,
      sha256,
    };
  } catch (error) {
    if (file !== null) {
      await file.close().catch(() => undefined);
    }

    await unlink(options.temporaryPath).catch(() => undefined);
    throw normalizeDownloadError(error, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithTrustedRedirects(input: {
  fetchImpl: typeof fetch;
  signal: AbortSignal;
  url: string;
}): Promise<Response> {
  let current = validateTrustedReleaseUrl(input.url);

  for (let redirects = 0; redirects <= MAX_RELEASE_REDIRECTS; redirects += 1) {
    const response = await input.fetchImpl(current.toString(), {
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": "moneysiren-cli-release-installer",
      },
      redirect: "manual",
      signal: input.signal,
    });

    if (!isRedirectStatus(response.status)) {
      if (!response.ok) {
        throw new Error(`Release download failed with HTTP ${response.status}.`);
      }

      return response;
    }

    if (redirects === MAX_RELEASE_REDIRECTS) {
      throw new Error("Release download exceeded the redirect limit.");
    }

    const location = response.headers.get("location");

    if (location === null) {
      throw new Error("Release download redirect did not include a location.");
    }

    current = validateTrustedReleaseUrl(new URL(location, current).toString());
  }

  throw new Error("Release download exceeded the redirect limit.");
}

function validateTrustedReleaseUrl(value: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Release download URL is invalid.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.port.length > 0 ||
    !TRUSTED_RELEASE_HOSTS.has(parsed.hostname.toLowerCase())
  ) {
    throw new Error("Release download redirect was not trusted.");
  }

  return parsed;
}

function parseContentLength(response: Response): number | null {
  const value = response.headers.get("content-length");

  if (value === null) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("Release download Content-Length was invalid.");
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Release download Content-Length was invalid.");
  }

  return parsed;
}

function createTimeout(controller: AbortController, timeoutMs = DEFAULT_RELEASE_DOWNLOAD_TIMEOUT_MS): ReturnType<typeof setTimeout> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 5 * 60_000) {
    throw new Error("Release download timeout is invalid.");
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  return timeout;
}

function normalizeDownloadError(error: unknown, signal: AbortSignal): Error {
  if (signal.aborted) {
    return new Error("Release download timed out.");
  }

  return error instanceof Error ? error : new Error("Release download failed.");
}

function assertMaximumBytes(maximumBytes: number): void {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error("Release download byte limit is invalid.");
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308;
}
