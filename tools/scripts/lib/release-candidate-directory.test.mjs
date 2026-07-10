import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateReleaseCandidateDirectory } from "./release-candidate-directory.mjs";
import { RELEASE_MANIFEST_FILE_NAME } from "./release-manifest.mjs";

const TAG = "v0.1.6";
const COMMIT = "1".repeat(40);
const PAYLOAD_NAME = `moneysiren-web-runtime-${TAG}.tar.gz`;
const CHECKSUM_NAME = "moneysiren-web-runtime-SHA256SUMS.txt";
const PAYLOAD = Buffer.from("synthetic release payload");
const PAYLOAD_SHA = createHash("sha256").update(PAYLOAD).digest("hex");

test("accepts an exact candidate directory whose payload and checksum match", async () => {
  const { assetsDir, manifest } = await createCandidate();

  assert.deepEqual(await validateReleaseCandidateDirectory(manifest, assetsDir), []);
});

test("rejects unexpected files and directories", async () => {
  const { assetsDir, manifest } = await createCandidate();
  await writeFile(join(assetsDir, "unexpected.txt"), "unexpected");
  await mkdir(join(assetsDir, "nested"));

  const errors = await validateReleaseCandidateDirectory(manifest, assetsDir);

  assert.ok(errors.some((error) => error.includes("unexpected entry: unexpected.txt")));
  assert.ok(errors.some((error) => error.includes("unexpected entry: nested")));
});

test("rejects a missing payload", async () => {
  const { assetsDir, manifest } = await createCandidate({ writePayload: false });

  assert.ok(
    (await validateReleaseCandidateDirectory(manifest, assetsDir))
      .some((error) => error.includes("payload is missing")),
  );
});

test("rejects payload size and digest mismatches", async () => {
  const sizeCandidate = await createCandidate({
    asset: { size: PAYLOAD.length + 1 },
  });
  const digestCandidate = await createCandidate({
    asset: { sha256: "f".repeat(64) },
  });

  assert.ok(
    (await validateReleaseCandidateDirectory(sizeCandidate.manifest, sizeCandidate.assetsDir))
      .some((error) => error.includes("size does not match")),
  );
  assert.ok(
    (await validateReleaseCandidateDirectory(digestCandidate.manifest, digestCandidate.assetsDir))
      .some((error) => error.includes("SHA256 does not match")),
  );
});

test("rejects a payload path that is not a regular file", async () => {
  const { assetsDir, manifest } = await createCandidate({ writePayload: false });
  await mkdir(join(assetsDir, PAYLOAD_NAME));

  assert.ok(
    (await validateReleaseCandidateDirectory(manifest, assetsDir))
      .some((error) => error.includes("entry must be a regular file")),
  );
});

test("requires the checksum file for each included platform", async () => {
  const { assetsDir, manifest } = await createCandidate({ writeChecksum: false });

  assert.ok(
    (await validateReleaseCandidateDirectory(manifest, assetsDir))
      .some((error) => error.includes("checksum file is missing")),
  );
});

test("rejects checksum payload-set and digest mismatches", async () => {
  const missingCandidate = await createCandidate({
    checksum: `${PAYLOAD_SHA}  other.tar.gz\n`,
  });
  const digestCandidate = await createCandidate({
    checksum: `${"f".repeat(64)}  ${PAYLOAD_NAME}\n`,
  });

  assert.ok(
    (await validateReleaseCandidateDirectory(missingCandidate.manifest, missingCandidate.assetsDir))
      .some((error) => error.includes("payload set does not match")),
  );
  assert.ok(
    (await validateReleaseCandidateDirectory(digestCandidate.manifest, digestCandidate.assetsDir))
      .some((error) => error.includes("checksum does not match")),
  );
});

test("accepts only named, bounded support files", async () => {
  const { assetsDir, manifest } = await createCandidate();
  await writeFile(
    join(assetsDir, "moneysiren-release-sbom.spdx.json"),
    JSON.stringify({ spdxVersion: "SPDX-2.3" }),
  );

  assert.deepEqual(await validateReleaseCandidateDirectory(manifest, assetsDir), []);

  await writeFile(join(assetsDir, "moneysiren-release-sbom.json"), "{}");
  assert.ok(
    (await validateReleaseCandidateDirectory(manifest, assetsDir))
      .some((error) => error.includes("unexpected entry")),
  );
});

async function createCandidate(options = {}) {
  const assetsDir = await mkdtemp(join(tmpdir(), "moneysiren-release-candidate-"));
  const asset = {
    name: PAYLOAD_NAME,
    surface: "web",
    platform: "any",
    archive: "tar.gz",
    size: PAYLOAD.length,
    sha256: PAYLOAD_SHA,
    signing: {
      state: "not-required",
      method: "none",
    },
    ...options.asset,
  };
  const manifest = {
    schemaVersion: 1,
    repository: "example/moneysiren",
    tag: TAG,
    version: TAG.slice(1),
    sourceCommit: COMMIT,
    assets: [asset],
  };

  if (options.writePayload !== false) {
    await writeFile(join(assetsDir, PAYLOAD_NAME), PAYLOAD);
  }
  if (options.writeChecksum !== false) {
    await writeFile(
      join(assetsDir, CHECKSUM_NAME),
      options.checksum ?? `${asset.sha256}  ${PAYLOAD_NAME}\n`,
    );
  }
  await writeFile(
    join(assetsDir, RELEASE_MANIFEST_FILE_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return { assetsDir, manifest };
}
