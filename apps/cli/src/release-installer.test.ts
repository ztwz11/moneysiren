import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  installReleaseAssets,
  readReleaseRuntimeInstallStatus,
  resolveReleaseInstallDir,
} from "./release-installer.js";
import type { ReleaseManifest } from "./release-manifest.js";

const repository = "ztwz11/moneysiren";
const tag = "v0.1.6";
const sourceCommit = "0123456789abcdef0123456789abcdef01234567";

describe("MoneySiren release installer", () => {
  it("installs a strict manifested web runtime and reports verified readiness", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(root, "installed");
    const archive = webArchive("first");
    const manifest = manifestWithAssets([
      webAsset(archive),
    ]);

    const result = await installReleaseAssets({
      fetchImpl: releaseFetch(manifest, {
        [manifest.assets[0]!.name]: archive,
      }),
      installDir,
      now: () => new Date("2026-07-10T00:00:00.000Z"),
      platform: "linux",
      repository,
      selectedSurfaces: ["cli", "web"],
      tag,
    });

    expect(result).toMatchObject({
      repository,
      tag,
      version: "0.1.6",
      sourceCommit,
      installDir,
    });
    expect(await readFile(result.assets[0]!.path)).toEqual(archive);

    const localManifest = JSON.parse(
      await readFile(join(installDir, "install-manifest.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(localManifest).toMatchObject({
      schemaVersion: 2,
      status: "ready",
      repository,
      tag,
      version: "0.1.6",
      sourceCommit,
      installedAt: "2026-07-10T00:00:00.000Z",
    });
    expect(JSON.stringify(localManifest)).not.toMatch(/sk-|hooks\.slack|FAKE_/i);

    await expect(readReleaseRuntimeInstallStatus({
      installDir,
      platform: "linux",
      repository,
      tag,
    })).resolves.toMatchObject({
      status: "ready",
      version: "0.1.6",
      sourceCommit,
    });
  });

  it("keeps the published v0.1.5 web runtime on a bounded legacy compatibility path", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(root, "legacy");
    const legacyTag = "v0.1.5";
    const archive = webArchive("legacy");
    const name = `moneysiren-web-runtime-${legacyTag}.tar.gz`;

    const result = await installReleaseAssets({
      fetchImpl: legacyV015Fetch(name, archive),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag: legacyTag,
    });

    expect(result).toMatchObject({
      tag: legacyTag,
      version: "0.1.5",
      sourceCommit: null,
      provenance: "legacy-v0.1.5",
    });
    expect(await readFile(result.assets[0]!.path)).toEqual(archive);
    await expect(readReleaseRuntimeInstallStatus({
      installDir,
      platform: "linux",
      repository,
      tag: legacyTag,
    })).resolves.toMatchObject({
      status: "ready",
      version: "0.1.5",
      sourceCommit: null,
    });
  });

  it("rejects missing manifests and missing assets", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(root, "installed");
    const archive = webArchive("missing");
    const manifest = manifestWithAssets([
      webAsset(archive),
    ]);

    await expect(installReleaseAssets({
      fetchImpl: vi.fn(async () => new Response("missing", {
        status: 404,
      })) as unknown as typeof fetch,
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    })).rejects.toThrow(/HTTP 404/);

    await expect(installReleaseAssets({
      fetchImpl: releaseFetch(manifest, {}),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    })).rejects.toThrow(/HTTP 404/);
  });

  it("rejects manifest version and checksum mismatches", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(root, "installed");
    const archive = webArchive("expected");
    const asset = webAsset(archive);

    await expect(installReleaseAssets({
      fetchImpl: releaseFetch({
        ...manifestWithAssets([asset]),
        version: "0.1.5",
      }, {
        [asset.name]: archive,
      }),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    })).rejects.toThrow(/version mismatch/);

    await expect(installReleaseAssets({
      fetchImpl: releaseFetch(manifestWithAssets([asset]), {
        [asset.name]: webArchive("corrupt!"),
      }),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    })).rejects.toThrow(/Content-Length|manifest size|SHA256/);
  });

  it("atomically upgrades a healthy runtime without leaving transaction directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(root, "installed");
    const firstArchive = webArchive("first");
    const secondArchive = webArchive("second");

    await installReleaseAssets({
      fetchImpl: releaseFetch(manifestWithAssets([webAsset(firstArchive)]), {
        [`moneysiren-web-runtime-${tag}.tar.gz`]: firstArchive,
      }),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    });

    const upgraded = await installReleaseAssets({
      fetchImpl: releaseFetch(manifestWithAssets([webAsset(secondArchive)]), {
        [`moneysiren-web-runtime-${tag}.tar.gz`]: secondArchive,
      }),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    });

    expect(await readFile(upgraded.assets[0]!.path)).toEqual(secondArchive);
    expect(await readdir(root)).toEqual(["installed"]);
  });

  it("preserves the previous runtime when an update fails integrity verification", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(root, "installed");
    const firstArchive = webArchive("first");
    const secondArchive = webArchive("second");
    const name = `moneysiren-web-runtime-${tag}.tar.gz`;

    const installed = await installReleaseAssets({
      fetchImpl: releaseFetch(manifestWithAssets([webAsset(firstArchive)]), {
        [name]: firstArchive,
      }),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    });

    await expect(installReleaseAssets({
      fetchImpl: releaseFetch(manifestWithAssets([webAsset(secondArchive)]), {
        [name]: Buffer.from(secondArchive).fill(0, 0, 1),
      }),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    })).rejects.toThrow(/SHA256/);

    expect(await readFile(installed.assets[0]!.path)).toEqual(firstArchive);
    await expect(readReleaseRuntimeInstallStatus({
      installDir,
      platform: "linux",
      repository,
      tag,
    })).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("requires stable Windows HUD signing and verifies the manifest signer", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(root, "installed");
    const hudBytes = Buffer.from("synthetic signed executable");
    const name = "MoneySiren.Tray_0.1.6_x64-portable.exe";
    const signerThumbprint = "A".repeat(40);
    const asset = {
      name,
      surface: "hud",
      platform: "win32",
      archive: "none",
      size: hudBytes.byteLength,
      sha256: sha256(hudBytes),
      signing: {
        state: "signed",
        method: "authenticode",
        signerThumbprint,
      },
    } as const;
    const signatureVerifier = {
      verify: vi.fn(async (input) => ({
        verified: input.expectedSignerThumbprints?.[0] === signerThumbprint,
        status: "Valid",
        message: "synthetic verifier",
      })),
    };

    const result = await installReleaseAssets({
      fetchImpl: releaseFetch(manifestWithAssets([
        webAsset(webArchive("web")),
        asset,
      ]), {
        [name]: hudBytes,
      }),
      installDir,
      platform: "win32",
      repository,
      selectedSurfaces: ["hud"],
      signatureVerifier,
      tag,
    });

    expect(result.assets[0]).toMatchObject({
      name,
      signatureVerified: true,
      signatureStatus: "Valid",
      signingState: "signed",
    });
    expect(signatureVerifier.verify).toHaveBeenCalledWith(expect.objectContaining({
      expectedSignerThumbprints: [signerThumbprint],
    }));
  });

  it("allows unsigned stable HUD assets only with explicit local smoke opt-in", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const hudBytes = Buffer.from("synthetic unsigned executable");
    const name = "MoneySiren.Tray_0.1.6_x64-portable.exe";
    const asset = {
      name,
      surface: "hud",
      platform: "win32",
      archive: "none",
      size: hudBytes.byteLength,
      sha256: sha256(hudBytes),
      signing: {
        state: "unsigned",
        method: "authenticode",
      },
    } as const;
    const manifest = manifestWithAssets([
      webAsset(webArchive("web")),
      asset,
    ]);

    await expect(installReleaseAssets({
      fetchImpl: releaseFetch(manifest, {
        [name]: hudBytes,
      }),
      installDir: join(root, "denied"),
      platform: "win32",
      repository,
      selectedSurfaces: ["hud"],
      tag,
    })).rejects.toThrow(/unsigned-not-allowed/);

    const accepted = await installReleaseAssets({
      env: {
        MONEYSIREN_ALLOW_UNSIGNED_HUD: "true",
      },
      fetchImpl: releaseFetch(manifest, {
        [name]: hudBytes,
      }),
      installDir: join(root, "accepted"),
      platform: "win32",
      repository,
      selectedSurfaces: ["hud"],
      tag,
    });

    expect(accepted.assets[0]).toMatchObject({
      signatureVerified: false,
      signatureStatus: "unsigned-opt-in-accepted",
    });
  });

  it("reports tampered local assets as invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(root, "installed");
    const archive = webArchive("first");
    const installed = await installReleaseAssets({
      fetchImpl: releaseFetch(manifestWithAssets([webAsset(archive)]), {
        [`moneysiren-web-runtime-${tag}.tar.gz`]: archive,
      }),
      installDir,
      platform: "linux",
      repository,
      selectedSurfaces: ["web"],
      tag,
    });

    await writeFile(installed.assets[0]!.path, "tampered");

    await expect(readReleaseRuntimeInstallStatus({
      installDir,
      platform: "linux",
      repository,
      tag,
    })).resolves.toMatchObject({
      status: "invalid",
    });
  });

  it("resolves platform-specific default install directories", () => {
    expect(resolveReleaseInstallDir({
      env: {
        APPDATA: "C:\\Users\\Test\\AppData\\Roaming",
      },
      platform: "win32",
      tag,
    })).toBe(`C:\\Users\\Test\\AppData\\Roaming\\MoneySiren\\releases\\${tag}`);

    expect(resolveReleaseInstallDir({
      env: {
        HOME: "/Users/test",
      },
      platform: "darwin",
      tag,
    })).toBe(`/Users/test/Library/Application Support/MoneySiren/releases/${tag}`);

    expect(resolveReleaseInstallDir({
      env: {
        HOME: "/home/test",
        XDG_DATA_HOME: "/home/test/.data",
      },
      platform: "linux",
      tag,
    })).toBe(`/home/test/.data/moneysiren/releases/${tag}`);
  });
});

function releaseFetch(
  manifest: ReleaseManifest,
  assets: Readonly<Record<string, Buffer>>,
): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const name = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");

    if (name === "moneysiren-release-manifest.json") {
      return new Response(JSON.stringify(manifest), {
        status: 200,
      });
    }

    const asset = assets[name];

    return asset === undefined
      ? new Response("missing", {
          status: 404,
        })
      : new Response(new Uint8Array(asset), {
          status: 200,
        });
  }) as unknown as typeof fetch;
}

function legacyV015Fetch(assetName: string, asset: Buffer): typeof fetch {
  const checksumName = "moneysiren-web-runtime-SHA256SUMS.txt";

  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const name = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");

    if (url.hostname === "api.github.com") {
      return new Response(JSON.stringify({
        tag_name: "v0.1.5",
        assets: [
          {
            name: assetName,
            size: asset.byteLength,
          },
          {
            name: checksumName,
            size: 100,
          },
        ],
      }), {
        status: 200,
      });
    }

    if (name === "moneysiren-release-manifest.json") {
      return new Response("missing", {
        status: 404,
      });
    }

    if (name === checksumName) {
      return new Response(`${sha256(asset)}  ${assetName}\n`, {
        status: 200,
      });
    }

    return name === assetName
      ? new Response(new Uint8Array(asset), {
          status: 200,
        })
      : new Response("missing", {
          status: 404,
        });
  }) as unknown as typeof fetch;
}

function manifestWithAssets(assets: ReleaseManifest["assets"]): ReleaseManifest {
  return {
    schemaVersion: 1,
    repository,
    tag,
    version: "0.1.6",
    sourceCommit,
    assets,
  };
}

function webAsset(content: Buffer): ReleaseManifest["assets"][number] {
  return {
    name: `moneysiren-web-runtime-${tag}.tar.gz`,
    surface: "web",
    platform: "any",
    archive: "tar.gz",
    size: content.byteLength,
    sha256: sha256(content),
    signing: {
      state: "not-required",
      method: "none",
    },
  };
}

function webArchive(label: string): Buffer {
  return gzipSync(Buffer.concat([
    tarEntry("moneysiren-web-runtime/", {
      type: "5",
    }),
    tarEntry("moneysiren-web-runtime/start.mjs", {
      content: Buffer.from(`console.log(${JSON.stringify(label)})\n`),
    }),
    Buffer.alloc(1024),
  ]));
}

function tarEntry(
  name: string,
  options: {
    content?: Buffer;
    type?: string;
  } = {},
): Buffer {
  const content = options.content ?? Buffer.alloc(0);
  const header = Buffer.alloc(512);

  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, content.byteLength);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  writeString(header, 156, 1, options.type ?? "0");
  writeString(header, 257, 6, "ustar");
  writeString(header, 263, 2, "00");

  let checksum = 0;

  for (const byte of header) {
    checksum += byte;
  }

  header.write(checksum.toString(8).padStart(6, "0"), 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;

  return Buffer.concat([
    header,
    content,
    Buffer.alloc((512 - (content.byteLength % 512)) % 512),
  ]);
}

function writeString(buffer: Buffer, offset: number, length: number, value: string): void {
  Buffer.from(value, "utf8").copy(buffer, offset, 0, length);
}

function writeOctal(buffer: Buffer, offset: number, length: number, value: number): void {
  buffer.write(`${value.toString(8).padStart(length - 1, "0")}\0`, offset, length, "ascii");
}

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
