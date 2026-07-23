import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  validateUnsignedPreviewMetadata,
  validateUnsignedPreviewRelease,
} from "./unsigned-preview.mjs";

const root = resolve(import.meta.dirname, "../../..");
const workflows = resolve(root, ".github", "workflows");

test("npm publication is reusable-only", async () => {
  const source = await readFile(resolve(workflows, "npm-publish-cli.yml"), "utf8");

  assert.match(source, /^  workflow_call:/m);
  assert.doesNotMatch(source, /^  push:/m);
  assert.doesNotMatch(source, /^  workflow_dispatch:/m);
  assert.match(source, /release_tag:/);
  assert.match(source, /source_commit:/);
  assert.match(source, /NPM_TOKEN:\s*\r?\n\s+required: true/);
  assert.match(source, /MONEYSIREN_NPM_DIST_TAG="\$\{NPM_DIST_TAG\}" npm run publish:cli:dry-run/);
  assert.match(source, /MONEYSIREN_NPM_DIST_TAG="\$\{NPM_DIST_TAG\}" npm run publish:app:dry-run/);
});

test("Windows and macOS candidate and public HUD smokes gate npm publication", async () => {
  const source = await readFile(resolve(workflows, "desktop-release.yml"), "utf8");
  const candidate = source.indexOf("candidate-smoke:");
  const publish = source.indexOf("publish:\n");
  const publicSmoke = source.indexOf("public-smoke:");
  const npm = source.indexOf("publish-npm:");

  assert.ok(candidate >= 0);
  assert.ok(publish >= 0);
  assert.ok(publicSmoke > publish);
  assert.ok(npm > publicSmoke);
  assert.match(source, /candidate-smoke[\s\S]*smoke-installed-package\.mjs[\s\S]*--candidate-dir/);
  assert.match(source, /public-smoke[\s\S]*smoke-installed-package\.mjs[\s\S]*--package/);
  assert.match(source, /Require Windows signing for public release/);
  assert.match(source, /unsigned_windows_preview:/);
  assert.match(source, /GITHUB_EVENT_NAME -eq 'workflow_dispatch'/);
  assert.match(source, /DISPATCH_PRERELEASE -eq 'true'/);
  assert.match(source, /MONEYSIREN_UNSIGNED_WINDOWS_PREVIEW=true/);
  assert.match(source, /moneysiren-tray-windows-UNSIGNED-PREVIEW\.json/);
  assert.match(source, /public-smoke:[\s\S]*--allow-unsigned-preview/);
  assert.match(source, /Require macOS signing for public release/);
  assert.match(source, /unsigned_macos_preview:/);
  assert.match(source, /MONEYSIREN_UNSIGNED_MACOS_PREVIEW=true/);
  assert.match(source, /moneysiren-tray-macos-UNSIGNED-PREVIEW\.json/);
  assert.match(source, /candidate-smoke-macos:[\s\S]*smoke-installed-package\.mjs[\s\S]*--candidate-dir/);
  assert.match(source, /public-smoke-macos:[\s\S]*smoke-installed-package\.mjs[\s\S]*--package/);
  assert.match(source, /public-smoke:[\s\S]*always\(\)[\s\S]*needs\.publish\.result == 'success'/);
  assert.match(source, /public-smoke-macos:[\s\S]*always\(\)[\s\S]*needs\.publish\.result == 'success'/);
  assert.match(source, /publish-npm:[\s\S]*dist_tag:[\s\S]*'next'/);
  assert.match(source, /publish-npm:[\s\S]*needs:[\s\S]*public-smoke[\s\S]*public-smoke-macos/);
  assert.match(source, /uses: \.\/\.github\/workflows\/npm-publish-cli\.yml/);
  assert.match(source, /secrets: inherit/);
});

test("candidate layout includes app, web, and portable HUD artifacts", async () => {
  const smoke = await readFile(resolve(root, "tools", "scripts", "smoke-installed-package.mjs"), "utf8");

  assert.match(smoke, /moneysiren-app-/);
  assert.match(smoke, /moneysiren-web-runtime-/);
  assert.match(smoke, /x64-portable\\\.exe/);
  assert.match(smoke, /MoneySiren\\\.Tray-macos-/);
  assert.match(smoke, /Web runtime: running/);
  assert.match(smoke, /HUD: running/);
  assert.match(smoke, /PUBLIC_HUD_SIGNATURE_NOT_VERIFIED/);
  assert.match(smoke, /UNSIGNED_PREVIEW_REQUIRES_PUBLIC_PACKAGE/);
  assert.match(smoke, /MONEYSIREN_ALLOW_UNSIGNED_HUD: input\.allowUnsignedPreview \? "true" : "false"/);
  assert.match(smoke, /signatureStatus === "unsigned-opt-in-accepted"/);
  assert.match(smoke, /validateUnsignedPreviewRelease/);
  assert.match(smoke, /validateUnsignedPreviewMetadata/);
});

test("public release polling follows the caller workflow after npm became reusable", async () => {
  const source = await readFile(resolve(root, "tools", "scripts", "release-public.mjs"), "utf8");

  assert.match(source, /expectedWorkflows = \["ci", "secret-scan", "desktop-release"\]/);
  assert.doesNotMatch(source, /expectedWorkflows = \[[^\]]*"npm-publish-cli"/);
});

test("unsigned preview metadata is bound to the prerelease tag and source commit", () => {
  const identity = {
    sourceCommit: "a".repeat(40),
    tag: "v0.1.7-beta.1",
  };
  const metadataUrl = validateUnsignedPreviewRelease({
    assets: [
      { name: "moneysiren-tray-windows-SHA256SUMS.txt" },
      {
        browser_download_url: "https://example.invalid/unsigned-preview.json",
        name: "moneysiren-tray-windows-UNSIGNED-PREVIEW.json",
      },
    ],
    prerelease: true,
    tag_name: identity.tag,
  }, identity);

  assert.equal(metadataUrl, "https://example.invalid/unsigned-preview.json");
  assert.doesNotThrow(() => validateUnsignedPreviewMetadata({
    checksumManifest: "moneysiren-tray-windows-SHA256SUMS.txt",
    explicitUserOptInRequired: true,
    signatureStatus: "unsigned-preview",
    sourceCommit: identity.sourceCommit,
    tag: identity.tag,
    verifiedPublisher: false,
    version: 1,
  }, identity));
});

test("unsigned macOS preview metadata uses the macOS checksum boundary", () => {
  const identity = {
    platform: "darwin",
    sourceCommit: "d".repeat(40),
    tag: "v0.1.7-beta.4",
  };
  const metadataUrl = validateUnsignedPreviewRelease({
    assets: [
      { name: "moneysiren-tray-macos-SHA256SUMS.txt" },
      {
        browser_download_url: "https://example.invalid/macos-unsigned-preview.json",
        name: "moneysiren-tray-macos-UNSIGNED-PREVIEW.json",
      },
    ],
    prerelease: true,
    tag_name: identity.tag,
  }, identity);

  assert.equal(metadataUrl, "https://example.invalid/macos-unsigned-preview.json");
  assert.doesNotThrow(() => validateUnsignedPreviewMetadata({
    checksumManifest: "moneysiren-tray-macos-SHA256SUMS.txt",
    explicitUserOptInRequired: true,
    signatureStatus: "unsigned-preview",
    sourceCommit: identity.sourceCommit,
    tag: identity.tag,
    verifiedPublisher: false,
    version: 1,
  }, identity));
});

test("release readiness does not treat unsigned preview metadata as a checksummed payload", async () => {
  const source = await readFile(resolve(root, "tools", "scripts", "check-release-readiness.mjs"), "utf8");

  assert.match(source, /sha256sums\|signature\\\.json\|unsigned-preview\\\.json/i);
});

test("unsigned preview validation rejects stable, signed, or mismatched releases", () => {
  const identity = {
    sourceCommit: "b".repeat(40),
    tag: "v0.1.7-beta.1",
  };
  const validAssets = [
    { name: "moneysiren-tray-windows-SHA256SUMS.txt" },
    {
      browser_download_url: "https://example.invalid/unsigned-preview.json",
      name: "moneysiren-tray-windows-UNSIGNED-PREVIEW.json",
    },
  ];

  assert.throws(() => validateUnsignedPreviewRelease({
    assets: validAssets,
    prerelease: false,
    tag_name: identity.tag,
  }, identity), /UNSIGNED_PREVIEW_RELEASE_IDENTITY_INVALID/);
  assert.throws(() => validateUnsignedPreviewRelease({
    assets: [...validAssets, { name: "moneysiren-tray-windows-SIGNATURE.json" }],
    prerelease: true,
    tag_name: identity.tag,
  }, identity), /UNSIGNED_PREVIEW_RELEASE_ASSETS_INVALID/);
  assert.throws(() => validateUnsignedPreviewMetadata({
    checksumManifest: "moneysiren-tray-windows-SHA256SUMS.txt",
    explicitUserOptInRequired: true,
    signatureStatus: "unsigned-preview",
    sourceCommit: "c".repeat(40),
    tag: identity.tag,
    verifiedPublisher: false,
    version: 1,
  }, identity), /UNSIGNED_PREVIEW_METADATA_INVALID/);
});
