import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { RELEASE_MANIFEST_FILE_NAME } from "./release-manifest.mjs";

const SCRIPT = fileURLToPath(new URL("../check-published-release-assets.mjs", import.meta.url));
const TAG = "v0.1.6";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const REPOSITORY = "ztwz11/moneysiren";

test("published release checker accepts an exact immutable asset set", async () => {
  const fixture = await createFixture({ draft: false });

  const result = runChecker(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /exactly match/);
});

test("published release checker rejects changed published bytes", async () => {
  const fixture = await createFixture({ draft: false });
  fixture.release.assets[0].digest = `sha256:${"f".repeat(64)}`;
  await writeFile(fixture.releaseJson, JSON.stringify(fixture.release));

  const result = runChecker(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /differ from the validated candidate/);
});

test("published release checker permits a draft to be replaced after candidate validation", async () => {
  const fixture = await createFixture({ draft: true });
  fixture.release.assets = [];
  await writeFile(fixture.releaseJson, JSON.stringify(fixture.release));

  const result = runChecker(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Draft release may be replaced/);
});

function runChecker(fixture) {
  return spawnSync(process.execPath, [
    SCRIPT,
    "--assets-dir",
    fixture.assetsDir,
    "--release-json",
    fixture.releaseJson,
    "--tag",
    TAG,
    "--source-commit",
    COMMIT,
    "--repository",
    REPOSITORY,
    "--channel",
    "stable",
  ], {
    encoding: "utf8",
    env: {},
    windowsHide: true,
  });
}

async function createFixture(options) {
  const assetsDir = await mkdtemp(join(tmpdir(), "moneysiren-published-release-"));
  const payloadName = `moneysiren-web-runtime-${TAG}.tar.gz`;
  const checksumName = "moneysiren-web-runtime-SHA256SUMS.txt";
  const payload = Buffer.from("synthetic immutable payload");
  const payloadSha = sha256(payload);
  const checksum = Buffer.from(`${payloadSha}  ${payloadName}\n`);
  const manifest = {
    schemaVersion: 1,
    repository: REPOSITORY,
    tag: TAG,
    version: TAG.slice(1),
    sourceCommit: COMMIT,
    assets: [{
      name: payloadName,
      surface: "web",
      platform: "any",
      archive: "tar.gz",
      size: payload.length,
      sha256: payloadSha,
      signing: {
        state: "not-required",
        method: "none",
      },
    }],
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

  await writeFile(join(assetsDir, payloadName), payload);
  await writeFile(join(assetsDir, checksumName), checksum);
  await writeFile(join(assetsDir, RELEASE_MANIFEST_FILE_NAME), manifestBytes);

  const release = {
    draft: options.draft,
    assets: [
      asset(payloadName, payload),
      asset(checksumName, checksum),
      asset(RELEASE_MANIFEST_FILE_NAME, manifestBytes),
    ],
  };
  const releaseJson = join(assetsDir, "..", `release-${Date.now()}-${Math.random()}.json`);
  await writeFile(releaseJson, JSON.stringify(release));

  return { assetsDir, releaseJson, release };
}

function asset(name, bytes) {
  return {
    name,
    size: bytes.length,
    digest: `sha256:${sha256(bytes)}`,
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
