import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installReleaseAssets, resolveReleaseInstallDir } from "./release-installer.js";

describe("MoneySiren release installer", () => {
  it("downloads selected web and HUD release assets with checksum verification", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(cwd, "installed");
    const webAsset = "moneysiren-web-runtime-v0.1.0-alpha.4.tar.gz";
    const hudAsset = "MoneySiren_0.1.0-alpha.4_x64-setup.exe";
    const webBytes = Buffer.from("fake web runtime archive");
    const hudBytes = Buffer.from("fake hud installer");
    const expectedSignerThumbprint = "AABBCCDDEEFF00112233445566778899AABBCCDD";
    const checksum = [
      `${sha256Hex(webBytes)}  ${webAsset}`,
      `${sha256Hex(hudBytes)}  ${hudAsset}`,
      "",
    ].join("\n");
    const requests: string[] = [];
    const signatureVerifierInputs: string[] = [];

    const result = await installReleaseAssets({
      env: {},
      fetchImpl: async (input) => {
        const url = String(input);
        requests.push(url);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.4")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.4",
            assets: [
              releaseAsset(webAsset),
              releaseAsset(hudAsset),
              releaseAsset("moneysiren-web-runtime-SHA256SUMS.txt"),
              releaseAsset("moneysiren-tray-windows-SHA256SUMS.txt"),
              releaseAsset("moneysiren-tray-windows-SIGNATURE.json"),
            ],
          });
        }

        if (url.endsWith(webAsset)) {
          return new Response(webBytes);
        }

        if (url.endsWith(hudAsset)) {
          return new Response(hudBytes);
        }

        if (url.endsWith("SHA256SUMS.txt")) {
          return new Response(checksum);
        }

        if (url.endsWith("SIGNATURE.json")) {
          return Response.json([{
            assetName: hudAsset,
            signerThumbprint: expectedSignerThumbprint,
            signerSubject: "CN=MoneySiren Test",
            signatureStatus: "Valid",
          }]);
        }

        return new Response("missing", {
          status: 404,
          statusText: "Not Found",
        });
      },
      installDir,
      platform: "win32",
      selectedSurfaces: ["cli", "web", "hud"],
      signatureVerifier: {
        async verify(input) {
          signatureVerifierInputs.push(`${input.assetName}:${input.expectedSignerThumbprints?.join(",") ?? "none"}`);
          return {
            verified: true,
            status: input.surface === "hud" ? "Valid" : "not-required",
            message: "test signature verifier",
          };
        },
      },
      tag: "v0.1.0-alpha.4",
    });

    expect(result.assets.map((asset) => asset.surface)).toEqual(["web", "hud"]);
    expect(result.assets.every((asset) => asset.checksumVerified)).toBe(true);
    expect(await readFile(join(installDir, webAsset), "utf8")).toBe(webBytes.toString("utf8"));
    expect(await readFile(join(installDir, hudAsset), "utf8")).toBe(hudBytes.toString("utf8"));
    const manifest = await readFile(join(installDir, "install-manifest.json"), "utf8");
    expect(manifest).not.toMatch(/sk-|hooks\.slack|FAKE_/i);
    expect(manifest).toContain("\"signatureVerified\": true");
    expect(signatureVerifierInputs).toContain(`${hudAsset}:${expectedSignerThumbprint}`);
    expect(requests).toContain("https://api.github.com/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.4");
  });

  it("prefers independently configured Windows signer thumbprints over release metadata", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(cwd, "installed");
    const hudAsset = "MoneySiren_0.1.0-alpha.4_x64-setup.exe";
    const hudBytes = Buffer.from("fake signed hud installer");
    const checksum = `${sha256Hex(hudBytes)}  ${hudAsset}\n`;
    const expectedSignerThumbprint = "AABBCCDDEEFF00112233445566778899AABBCCDD";
    const signatureVerifierInputs: string[] = [];

    await installReleaseAssets({
      env: {
        MONEYSIREN_WINDOWS_SIGNER_THUMBPRINTS: expectedSignerThumbprint,
      },
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.4")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.4",
            assets: [
              releaseAsset(hudAsset),
              releaseAsset("moneysiren-tray-windows-SHA256SUMS.txt"),
            ],
          });
        }

        if (url.endsWith(hudAsset)) {
          return new Response(hudBytes);
        }

        if (url.endsWith("SHA256SUMS.txt")) {
          return new Response(checksum);
        }

        return new Response("missing", {
          status: 404,
          statusText: "Not Found",
        });
      },
      installDir,
      platform: "win32",
      selectedSurfaces: ["hud"],
      signatureVerifier: {
        async verify(input) {
          signatureVerifierInputs.push(input.expectedSignerThumbprints?.join(",") ?? "none");
          return {
            verified: true,
            status: "Valid",
            message: "test signature verifier",
          };
        },
      },
      tag: "v0.1.0-alpha.4",
    });

    expect(signatureVerifierInputs).toEqual([expectedSignerThumbprint]);
  });

  it("fails when checksum files exist but omit the selected asset", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(cwd, "installed");
    const webAsset = "moneysiren-web-runtime-v0.1.0-alpha.4.tar.gz";

    await expect(installReleaseAssets({
      env: {},
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.4")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.4",
            assets: [
              releaseAsset(webAsset),
              releaseAsset("moneysiren-web-runtime-SHA256SUMS.txt"),
            ],
          });
        }

        if (url.endsWith(webAsset)) {
          return new Response("fake web runtime archive");
        }

        if (url.endsWith("SHA256SUMS.txt")) {
          return new Response(`${sha256Hex(Buffer.from("other asset"))}  other.tar.gz\n`);
        }

        return new Response("missing", {
          status: 404,
          statusText: "Not Found",
        });
      },
      installDir,
      platform: "win32",
      selectedSurfaces: ["web"],
      tag: "v0.1.0-alpha.4",
    })).rejects.toThrow(`SHA256 checksum entry missing for ${webAsset}.`);
  });

  it("fails Windows HUD installs when the release installer signature is invalid", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(cwd, "installed");
    const hudAsset = "MoneySiren_0.1.0-alpha.4_x64-setup.exe";
    const hudBytes = Buffer.from("fake unsigned hud installer");
    const checksum = `${sha256Hex(hudBytes)}  ${hudAsset}\n`;

    await expect(installReleaseAssets({
      env: {},
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.4")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.4",
            assets: [
              releaseAsset(hudAsset),
              releaseAsset("moneysiren-tray-windows-SHA256SUMS.txt"),
            ],
          });
        }

        if (url.endsWith(hudAsset)) {
          return new Response(hudBytes);
        }

        if (url.endsWith("SHA256SUMS.txt")) {
          return new Response(checksum);
        }

        return new Response("missing", {
          status: 404,
          statusText: "Not Found",
        });
      },
      installDir,
      platform: "win32",
      selectedSurfaces: ["hud"],
      signatureVerifier: {
        async verify() {
          return {
            verified: false,
            status: "NotSigned",
            message: "The file is not digitally signed.",
          };
        },
      },
      tag: "v0.1.0-alpha.4",
    })).rejects.toThrow(`Release asset signature verification failed for ${hudAsset}: NotSigned The file is not digitally signed.`);

    await expect(readFile(join(installDir, hudAsset), "utf8")).rejects.toThrow();
  });

  it("accepts unsigned Windows HUD installers for alpha prereleases when release signature metadata is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(cwd, "installed");
    const hudAsset = "MoneySiren_0.1.0-alpha.4_x64-setup.exe";
    const hudBytes = Buffer.from("fake unsigned hud installer");
    const checksum = `${sha256Hex(hudBytes)}  ${hudAsset}\n`;

    const result = await installReleaseAssets({
      env: {},
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.4")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.4",
            assets: [
              releaseAsset(hudAsset),
              releaseAsset("moneysiren-tray-windows-SHA256SUMS.txt"),
            ],
          });
        }

        if (url.endsWith(hudAsset)) {
          return new Response(hudBytes);
        }

        if (url.endsWith("SHA256SUMS.txt")) {
          return new Response(checksum);
        }

        return new Response("missing", {
          status: 404,
          statusText: "Not Found",
        });
      },
      installDir,
      platform: "win32",
      selectedSurfaces: ["hud"],
      tag: "v0.1.0-alpha.4",
    });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.signatureVerified).toBe(false);
    expect(result.assets[0]?.signatureStatus).toBe("unsigned-prerelease-accepted");
    await expect(readFile(join(installDir, hudAsset), "utf8")).resolves.toBe(hudBytes.toString("utf8"));
  });

  it("fails unsigned Windows HUD alpha installs when explicitly disabled", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(cwd, "installed");
    const hudAsset = "MoneySiren_0.1.0-alpha.4_x64-setup.exe";
    const hudBytes = Buffer.from("fake unsigned hud installer");
    const checksum = `${sha256Hex(hudBytes)}  ${hudAsset}\n`;

    await expect(installReleaseAssets({
      env: {
        MONEYSIREN_ALLOW_UNSIGNED_HUD: "false",
      },
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.4")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.4",
            assets: [
              releaseAsset(hudAsset),
              releaseAsset("moneysiren-tray-windows-SHA256SUMS.txt"),
            ],
          });
        }

        if (url.endsWith(hudAsset)) {
          return new Response(hudBytes);
        }

        if (url.endsWith("SHA256SUMS.txt")) {
          return new Response(checksum);
        }

        return new Response("missing", {
          status: 404,
          statusText: "Not Found",
        });
      },
      installDir,
      platform: "win32",
      selectedSurfaces: ["hud"],
      tag: "v0.1.0-alpha.4",
    })).rejects.toThrow(
      "Release asset signature verification failed for MoneySiren_0.1.0-alpha.4_x64-setup.exe: missing-signature-metadata",
    );

    await expect(readFile(join(installDir, hudAsset), "utf8")).rejects.toThrow();
  });

  it("removes Windows HUD installers when release signature metadata is invalid JSON", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(cwd, "installed");
    const hudAsset = "MoneySiren_0.1.0-alpha.4_x64-setup.exe";
    const hudBytes = Buffer.from("fake unsigned hud installer");
    const checksum = `${sha256Hex(hudBytes)}  ${hudAsset}\n`;

    await expect(installReleaseAssets({
      env: {},
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.4")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.4",
            assets: [
              releaseAsset(hudAsset),
              releaseAsset("moneysiren-tray-windows-SHA256SUMS.txt"),
              releaseAsset("moneysiren-tray-windows-SIGNATURE.json"),
            ],
          });
        }

        if (url.endsWith(hudAsset)) {
          return new Response(hudBytes);
        }

        if (url.endsWith("SHA256SUMS.txt")) {
          return new Response(checksum);
        }

        if (url.endsWith("SIGNATURE.json")) {
          return new Response("{not-json");
        }

        return new Response("missing", {
          status: 404,
          statusText: "Not Found",
        });
      },
      installDir,
      platform: "win32",
      selectedSurfaces: ["hud"],
      tag: "v0.1.0-alpha.4",
    })).rejects.toThrow();

    await expect(readFile(join(installDir, hudAsset), "utf8")).rejects.toThrow();
  });

  it("resolves platform-specific default install directories", () => {
    expect(resolveReleaseInstallDir({
      env: {
        APPDATA: "C:\\Users\\tester\\AppData\\Roaming",
      },
      platform: "win32",
      tag: "v0.1.0-alpha.4",
    })).toBe("C:\\Users\\tester\\AppData\\Roaming\\MoneySiren\\releases\\v0.1.0-alpha.4");

    expect(resolveReleaseInstallDir({
      env: {
        HOME: "/Users/tester",
      },
      platform: "darwin",
      tag: "v0.1.0-alpha.4",
    })).toBe("/Users/tester/Library/Application Support/MoneySiren/releases/v0.1.0-alpha.4");
  });
});

function releaseAsset(name: string) {
  return {
    name,
    browser_download_url: `https://github.com/ztwz11/moneysiren/releases/download/v0.1.0-alpha.4/${name}`,
    size: 1,
  };
}

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
