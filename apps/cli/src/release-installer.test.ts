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
    const webAsset = "moneysiren-web-runtime-v0.1.0-alpha.0.tar.gz";
    const hudAsset = "MoneySiren_0.1.0-alpha.0_x64-setup.exe";
    const webBytes = Buffer.from("fake web runtime archive");
    const hudBytes = Buffer.from("fake hud installer");
    const checksum = [
      `${sha256Hex(webBytes)}  ${webAsset}`,
      `${sha256Hex(hudBytes)}  ${hudAsset}`,
      "",
    ].join("\n");
    const requests: string[] = [];

    const result = await installReleaseAssets({
      env: {},
      fetchImpl: async (input) => {
        const url = String(input);
        requests.push(url);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.0")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.0",
            assets: [
              releaseAsset(webAsset),
              releaseAsset(hudAsset),
              releaseAsset("moneysiren-web-runtime-SHA256SUMS.txt"),
              releaseAsset("moneysiren-tray-windows-SHA256SUMS.txt"),
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

        return new Response("missing", {
          status: 404,
          statusText: "Not Found",
        });
      },
      installDir,
      platform: "win32",
      selectedSurfaces: ["cli", "web", "hud"],
      tag: "v0.1.0-alpha.0",
    });

    expect(result.assets.map((asset) => asset.surface)).toEqual(["web", "hud"]);
    expect(result.assets.every((asset) => asset.checksumVerified)).toBe(true);
    expect(await readFile(join(installDir, webAsset), "utf8")).toBe(webBytes.toString("utf8"));
    expect(await readFile(join(installDir, hudAsset), "utf8")).toBe(hudBytes.toString("utf8"));
    expect(await readFile(join(installDir, "install-manifest.json"), "utf8")).not.toMatch(/sk-|hooks\.slack|FAKE_/i);
    expect(requests).toContain("https://api.github.com/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.0");
  });

  it("fails when checksum files exist but omit the selected asset", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-release-"));
    const installDir = join(cwd, "installed");
    const webAsset = "moneysiren-web-runtime-v0.1.0-alpha.0.tar.gz";

    await expect(installReleaseAssets({
      env: {},
      fetchImpl: async (input) => {
        const url = String(input);

        if (url.endsWith("/repos/ztwz11/moneysiren/releases/tags/v0.1.0-alpha.0")) {
          return Response.json({
            html_url: "https://github.com/ztwz11/moneysiren/releases/tag/v0.1.0-alpha.0",
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
      tag: "v0.1.0-alpha.0",
    })).rejects.toThrow(`SHA256 checksum entry missing for ${webAsset}.`);
  });

  it("resolves platform-specific default install directories", () => {
    expect(resolveReleaseInstallDir({
      env: {
        APPDATA: "C:\\Users\\tester\\AppData\\Roaming",
      },
      platform: "win32",
      tag: "v0.1.0-alpha.0",
    })).toBe("C:\\Users\\tester\\AppData\\Roaming\\MoneySiren\\releases\\v0.1.0-alpha.0");

    expect(resolveReleaseInstallDir({
      env: {
        HOME: "/Users/tester",
      },
      platform: "darwin",
      tag: "v0.1.0-alpha.0",
    })).toBe("/Users/tester/Library/Application Support/MoneySiren/releases/v0.1.0-alpha.0");
  });
});

function releaseAsset(name: string) {
  return {
    name,
    browser_download_url: `https://github.com/ztwz11/moneysiren/releases/download/v0.1.0-alpha.0/${name}`,
    size: 1,
  };
}

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
