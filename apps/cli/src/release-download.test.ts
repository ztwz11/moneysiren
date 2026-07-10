import { createHash } from "node:crypto";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildReleaseAssetUrl,
  downloadBoundedReleaseBytes,
  downloadVerifiedReleaseFile,
} from "./release-download.js";

describe("release downloads", () => {
  it("streams a trusted asset to a temporary file and verifies size and SHA256", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-download-"));
    const temporaryPath = join(root, "asset.partial");
    const content = Buffer.from("synthetic verified asset");
    const fetchImpl = vi.fn(async () => new Response(content, {
      status: 200,
    })) as unknown as typeof fetch;

    const result = await downloadVerifiedReleaseFile({
      expectedSha256: sha256(content),
      expectedSize: content.byteLength,
      fetchImpl,
      maximumBytes: 1024,
      temporaryPath,
      url: buildReleaseAssetUrl(
        "ztwz11/moneysiren",
        "v0.1.6",
        "moneysiren-web-runtime-v0.1.6.tar.gz",
      ),
    });

    expect(result).toEqual({
      size: content.byteLength,
      sha256: sha256(content),
    });
    expect(await readFile(temporaryPath)).toEqual(content);
  });

  it("rejects partial, oversized, and checksum-mismatched downloads and removes temporary files", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-download-"));
    const url = buildReleaseAssetUrl("ztwz11/moneysiren", "v0.1.6", "asset.bin");

    for (const scenario of [
      {
        label: "partial",
        content: Buffer.from("short"),
        expectedSize: 10,
        expectedSha256: sha256(Buffer.alloc(10)),
        error: /partial/,
      },
      {
        label: "oversized",
        content: Buffer.from("too large"),
        expectedSize: 3,
        expectedSha256: sha256(Buffer.from("too")),
        error: /exceeded the manifest size/,
      },
      {
        label: "checksum",
        content: Buffer.from("same size"),
        expectedSize: Buffer.byteLength("same size"),
        expectedSha256: "0".repeat(64),
        error: /SHA256 does not match/,
      },
    ]) {
      const temporaryPath = join(root, `${scenario.label}.partial`);
      const fetchImpl = vi.fn(async () => new Response(scenario.content, {
        status: 200,
      })) as unknown as typeof fetch;

      await expect(downloadVerifiedReleaseFile({
        expectedSha256: scenario.expectedSha256,
        expectedSize: scenario.expectedSize,
        fetchImpl,
        maximumBytes: 1024,
        temporaryPath,
        url,
      })).rejects.toThrow(scenario.error);
      await expect(access(temporaryPath)).rejects.toThrow();
    }
  });

  it("follows only bounded redirects to trusted GitHub release hosts", async () => {
    const content = Buffer.from("{}");
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.startsWith("https://github.com/")) {
        return new Response(null, {
          status: 302,
          headers: {
            location: "https://release-assets.githubusercontent.com/synthetic/object",
          },
        });
      }

      return new Response(content, {
        status: 200,
      });
    }) as unknown as typeof fetch;

    await expect(downloadBoundedReleaseBytes({
      fetchImpl,
      maximumBytes: 1024,
      url: buildReleaseAssetUrl("ztwz11/moneysiren", "v0.1.6", "manifest.json"),
    })).resolves.toEqual(content);

    const untrustedFetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: {
        location: "https://downloads.example.invalid/asset",
      },
    })) as unknown as typeof fetch;

    await expect(downloadBoundedReleaseBytes({
      fetchImpl: untrustedFetch,
      maximumBytes: 1024,
      url: buildReleaseAssetUrl("ztwz11/moneysiren", "v0.1.6", "manifest.json"),
    })).rejects.toThrow(/not trusted/);
  });

  it("enforces the manifest byte limit and timeout", async () => {
    const oversizedFetch = vi.fn(async () => new Response(Buffer.alloc(33), {
      status: 200,
    })) as unknown as typeof fetch;

    await expect(downloadBoundedReleaseBytes({
      fetchImpl: oversizedFetch,
      maximumBytes: 32,
      url: buildReleaseAssetUrl("ztwz11/moneysiren", "v0.1.6", "manifest.json"),
    })).rejects.toThrow(/byte limit/);

    const hangingFetch = vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      })
    ) as unknown as typeof fetch;

    await expect(downloadBoundedReleaseBytes({
      fetchImpl: hangingFetch,
      maximumBytes: 32,
      timeoutMs: 5,
      url: buildReleaseAssetUrl("ztwz11/moneysiren", "v0.1.6", "manifest.json"),
    })).rejects.toThrow(/timed out/);
  });
});

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
