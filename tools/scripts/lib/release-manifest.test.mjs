import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import {
  createReleaseManifest,
  serializeReleaseManifest,
} from "./release-manifest.mjs";

const temporaryDirectories = [];
const TAG = "v0.1.6";
const SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, {
    recursive: true,
    force: true,
  })));
});

test("builds a deterministic manifest with exact hashes, sizes, platforms, and signing states", async () => {
  const assetsDir = await temporaryDirectory();
  const webName = `moneysiren-web-runtime-${TAG}.tar.gz`;
  const windowsName = "MoneySiren.Tray_0.1.6_x64-portable.exe";
  const macosName = "MoneySiren.Tray-macos-ARM64.tar.gz";
  const webBytes = Buffer.from("synthetic web archive");
  const windowsBytes = Buffer.from("synthetic Windows executable");
  const macosBytes = Buffer.from("synthetic macOS archive");

  await Promise.all([
    writeFile(join(assetsDir, webName), webBytes),
    writeFile(join(assetsDir, windowsName), windowsBytes),
    writeFile(join(assetsDir, macosName), macosBytes),
    writeFile(join(assetsDir, "moneysiren-web-runtime-SHA256SUMS.txt"), "ignored support file\n"),
    writeFile(join(assetsDir, "moneysiren-tray-windows-SIGNATURE.json"), JSON.stringify([{
      assetName: windowsName,
      signerThumbprint: "AABBCCDDEEFF00112233445566778899AABBCCDD",
      signerSubject: "CN=Synthetic Test Only",
      signatureStatus: "Valid",
    }])),
    writeFile(join(assetsDir, "moneysiren-tray-macos-SIGNATURE.json"), JSON.stringify({
      assetName: macosName,
      signatureStatus: "Valid",
      notarizationStatus: "Valid",
    })),
  ]);

  const first = await createReleaseManifest({
    assetsDir,
    repository: "ztwz11/moneysiren",
    tag: TAG,
    sourceCommit: SOURCE_COMMIT.toUpperCase(),
  });
  const second = await createReleaseManifest({
    assetsDir,
    repository: "ztwz11/moneysiren",
    tag: TAG,
    sourceCommit: SOURCE_COMMIT,
  });

  assert.equal(serializeReleaseManifest(first), serializeReleaseManifest(second));
  assert.deepEqual(first, {
    schemaVersion: 1,
    repository: "ztwz11/moneysiren",
    tag: TAG,
    version: "0.1.6",
    sourceCommit: SOURCE_COMMIT,
    assets: [
      {
        name: macosName,
        surface: "hud",
        platform: "darwin",
        archive: "tar.gz",
        size: macosBytes.byteLength,
        sha256: sha256(macosBytes),
        signing: {
          state: "signed",
          method: "apple-codesign-notarized",
        },
      },
      {
        name: windowsName,
        surface: "hud",
        platform: "win32",
        archive: "none",
        size: windowsBytes.byteLength,
        sha256: sha256(windowsBytes),
        signing: {
          state: "signed",
          method: "authenticode",
          signerThumbprint: "AABBCCDDEEFF00112233445566778899AABBCCDD",
        },
      },
      {
        name: webName,
        surface: "web",
        platform: "any",
        archive: "tar.gz",
        size: webBytes.byteLength,
        sha256: sha256(webBytes),
        signing: {
          state: "not-required",
          method: "none",
        },
      },
    ],
  });
});

test("marks desktop assets unsigned when verified signing metadata is absent", async () => {
  const assetsDir = await temporaryDirectory();

  await writeFile(join(assetsDir, `moneysiren-web-runtime-${TAG}.tar.gz`), "web");
  await writeFile(join(assetsDir, "MoneySiren.Tray_0.1.6_x64-portable.exe"), "hud");

  const manifest = await createReleaseManifest({
    assetsDir,
    repository: "ztwz11/moneysiren",
    tag: TAG,
    sourceCommit: SOURCE_COMMIT,
  });
  const hud = manifest.assets.find((asset) => asset.surface === "hud");

  assert.deepEqual(hud?.signing, {
    state: "unsigned",
    method: "authenticode",
  });
});

test("rejects asset/tag mismatches and incomplete source commits", async () => {
  const assetsDir = await temporaryDirectory();

  await writeFile(join(assetsDir, "moneysiren-web-runtime-v0.1.5.tar.gz"), "web");

  await assert.rejects(
    createReleaseManifest({
      assetsDir,
      repository: "ztwz11/moneysiren",
      tag: TAG,
      sourceCommit: SOURCE_COMMIT,
    }),
    /asset tag mismatch/,
  );

  await assert.rejects(
    createReleaseManifest({
      assetsDir,
      repository: "ztwz11/moneysiren",
      tag: "v0.1.5",
      sourceCommit: "abc123",
    }),
    /full 40-character SHA/,
  );
});

test("rejects malformed or duplicate signing metadata", async () => {
  const assetsDir = await temporaryDirectory();
  const windowsName = "MoneySiren.Tray_0.1.6_x64-portable.exe";

  await writeFile(join(assetsDir, `moneysiren-web-runtime-${TAG}.tar.gz`), "web");
  await writeFile(join(assetsDir, windowsName), "hud");
  await writeFile(join(assetsDir, "moneysiren-tray-windows-SIGNATURE.json"), JSON.stringify([
    {
      assetName: windowsName,
      signerThumbprint: "AABBCCDDEEFF00112233445566778899AABBCCDD",
      signatureStatus: "Valid",
    },
    {
      assetName: windowsName,
      signerThumbprint: "AABBCCDDEEFF00112233445566778899AABBCCDD",
      signatureStatus: "Valid",
    },
  ]));

  await assert.rejects(
    createReleaseManifest({
      assetsDir,
      repository: "ztwz11/moneysiren",
      tag: TAG,
      sourceCommit: SOURCE_COMMIT,
    }),
    /duplicate entries/,
  );
});

async function temporaryDirectory() {
  const path = await mkdtemp(join(tmpdir(), "moneysiren-release-manifest-"));
  temporaryDirectories.push(path);
  return path;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}
