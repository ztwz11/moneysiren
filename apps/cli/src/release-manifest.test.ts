import { describe, expect, it } from "vitest";
import {
  parseReleaseManifest,
  selectReleaseAsset,
  type ReleaseManifest,
} from "./release-manifest.js";

const repository = "ztwz11/moneysiren";
const tag = "v0.1.6";
const sourceCommit = "0123456789abcdef0123456789abcdef01234567";

describe("release manifest", () => {
  it("accepts a strict matching manifest and deterministically selects platform assets", () => {
    const parsed = parseReleaseManifest(validManifest(), {
      repository,
      tag,
    });

    expect(parsed.version).toBe("0.1.6");
    expect(selectReleaseAsset(parsed, "web", "linux")?.name).toBe(
      "moneysiren-web-runtime-v0.1.6.tar.gz",
    );
    expect(selectReleaseAsset(parsed, "hud", "win32")?.name).toBe(
      "MoneySiren.Tray_0.1.6_x64-portable.exe",
    );
    expect(selectReleaseAsset(parsed, "hud", "linux")).toBeNull();
  });

  it.each([
    ["repository", { repository: "example/other" }, /repository mismatch/],
    ["tag", { tag: "v0.1.5" }, /tag mismatch/],
    ["version", { version: "0.1.5" }, /version mismatch/],
    ["source commit", { sourceCommit: "abc123" }, /source commit/],
    ["unknown root field", { unexpected: true }, /root is invalid/],
  ])("rejects %s mismatches", (_label, patch, expected) => {
    expect(() => parseReleaseManifest({
      ...validManifest(),
      ...patch,
    }, {
      repository,
      tag,
    })).toThrow(expected);
  });

  it("rejects duplicate, unsafe, oversized, and inconsistent assets", () => {
    const manifest = validManifest();

    expect(() => parseReleaseManifest({
      ...manifest,
      assets: [...manifest.assets, manifest.assets[0]],
    }, {
      repository,
      tag,
    })).toThrow(/duplicate asset/);

    expect(() => parseReleaseManifest(withWebAsset({
      name: "../runtime.tar.gz",
    }), {
      repository,
      tag,
    })).toThrow(/unsafe name/);

    expect(() => parseReleaseManifest(withWebAsset({
      size: 512 * 1024 * 1024 + 1,
    }), {
      repository,
      tag,
    })).toThrow(/invalid size/);

    expect(() => parseReleaseManifest(withWebAsset({
      signing: {
        state: "signed",
        method: "none",
      },
    }), {
      repository,
      tag,
    })).toThrow(/inconsistent metadata/);
  });

  it("requires the signed Windows state to carry a trusted signer thumbprint", () => {
    const manifest = validManifest();
    const windows = manifest.assets.find((asset) => asset.platform === "win32");

    expect(() => parseReleaseManifest({
      ...manifest,
      assets: manifest.assets.map((asset) => asset === windows
        ? {
            ...asset,
            signing: {
              state: "signed",
              method: "authenticode",
            },
          }
        : asset),
    }, {
      repository,
      tag,
    })).toThrow(/inconsistent metadata/);
  });
});

function validManifest(): ReleaseManifest {
  return {
    schemaVersion: 1,
    repository,
    tag,
    version: "0.1.6",
    sourceCommit,
    assets: [
      {
        name: "moneysiren-web-runtime-v0.1.6.tar.gz",
        surface: "web",
        platform: "any",
        archive: "tar.gz",
        size: 1024,
        sha256: "a".repeat(64),
        signing: {
          state: "not-required",
          method: "none",
        },
      },
      {
        name: "MoneySiren.Tray_0.1.6_x64-setup.exe",
        surface: "hud",
        platform: "win32",
        archive: "none",
        size: 2048,
        sha256: "b".repeat(64),
        signing: {
          state: "signed",
          method: "authenticode",
          signerThumbprint: "A".repeat(40),
        },
      },
      {
        name: "MoneySiren.Tray_0.1.6_x64-portable.exe",
        surface: "hud",
        platform: "win32",
        archive: "none",
        size: 1536,
        sha256: "c".repeat(64),
        signing: {
          state: "signed",
          method: "authenticode",
          signerThumbprint: "A".repeat(40),
        },
      },
    ],
  };
}

function withWebAsset(patch: Record<string, unknown>): unknown {
  const manifest = validManifest();

  return {
    ...manifest,
    assets: manifest.assets.map((asset) => asset.surface === "web"
      ? {
          ...asset,
          ...patch,
        }
      : asset),
  };
}
