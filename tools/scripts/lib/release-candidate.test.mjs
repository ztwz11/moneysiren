import assert from "node:assert/strict";
import test from "node:test";
import {
  validatePublishedReleaseIsImmutable,
  validateReleaseCandidate,
} from "./release-candidate.mjs";

const TAG = "v0.1.6";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const REPOSITORY = "ztwz11/moneysiren";

function candidate(overrides = {}) {
  return {
    schemaVersion: 1,
    repository: REPOSITORY,
    tag: TAG,
    version: TAG.slice(1),
    sourceCommit: COMMIT,
      repository: REPOSITORY,
    assets: [
      {
        name: `moneysiren-web-runtime-${TAG}.tar.gz`,
        surface: "web",
        platform: "any",
        archive: "tar.gz",
        size: 42,
        sha256: "a".repeat(64),
        signing: { state: "not-required", method: "none" },
      },
      {
        name: "MoneySiren.Tray_0.1.6_x64-portable.exe",
        surface: "hud",
        platform: "win32",
        archive: "none",
        size: 84,
        sha256: "b".repeat(64),
        signing: {
          state: "signed",
          method: "authenticode",
          signerThumbprint: "A".repeat(40),
        },
      },
    ],
    ...overrides,
  };
}

test("accepts a complete stable candidate", () => {
  assert.deepEqual(
    validateReleaseCandidate(candidate(), {
      channel: "stable",
      tag: TAG,
      sourceCommit: COMMIT,
      repository: REPOSITORY,
    }),
    { ok: true, errors: [] },
  );
});

test("stable refuses an included unsigned Windows HUD", () => {
  const unsigned = candidate();
  unsigned.assets[1].signing = {
    state: "unsigned",
    method: "authenticode",
  };

  const result = validateReleaseCandidate(unsigned, {
    channel: "stable",
    tag: TAG,
    sourceCommit: COMMIT,
      repository: REPOSITORY,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /not signed/);
});

test("stable accepts a web-only candidate", () => {
  const webOnly = candidate({ assets: [candidate().assets[0]] });

  assert.deepEqual(
    validateReleaseCandidate(webOnly, {
      channel: "stable",
      tag: TAG,
      sourceCommit: COMMIT,
      repository: REPOSITORY,
    }),
    { ok: true, errors: [] },
  );
});

test("preview permits a structurally valid unsigned HUD", () => {
  const unsigned = candidate();
  unsigned.assets[1].signing = {
    state: "unsigned",
    method: "authenticode",
  };

  assert.deepEqual(
    validateReleaseCandidate(unsigned, {
      channel: "preview",
      tag: TAG,
      sourceCommit: COMMIT,
      repository: REPOSITORY,
    }),
    { ok: true, errors: [] },
  );
});

test("rejects version, commit, duplicate, and digest mismatches", () => {
  const invalid = candidate({
    version: "0.1.7",
    sourceCommit: "f".repeat(40),
  });
  invalid.assets.push({
    ...invalid.assets[0],
    sha256: "not-a-digest",
  });

  const result = validateReleaseCandidate(invalid, {
    channel: "preview",
    tag: TAG,
    sourceCommit: COMMIT,
      repository: REPOSITORY,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /version does not match/);
  assert.match(result.errors.join("\n"), /sourceCommit does not match/);
  assert.match(result.errors.join("\n"), /unique safe basenames/);
  assert.match(result.errors.join("\n"), /invalid SHA256/);
  assert.match(result.errors.join("\n"), /exactly one web runtime/);
});


test("rejects extra keys, Windows separators, oversized assets, and uppercase commits", () => {
  const invalid = candidate({ unexpectedRoot: true });
  invalid.assets[0].name = `folder\\moneysiren-web-runtime-${TAG}.tar.gz`;
  invalid.assets[1].unexpectedAssetKey = true;
  invalid.assets[1].size = 1024 * 1024 * 1024 + 1;

  const result = validateReleaseCandidate(invalid, {
    channel: "preview",
    tag: TAG,
    sourceCommit: COMMIT,
      repository: REPOSITORY,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /root must contain only/);
  assert.match(result.errors.join("\n"), /unique safe basenames/);
  assert.match(result.errors.join("\n"), /documented keys/);
  assert.match(result.errors.join("\n"), /invalid size/);

  const uppercase = validateReleaseCandidate(candidate(), {
    channel: "preview",
    tag: TAG,
    sourceCommit: COMMIT.toUpperCase(),
    repository: REPOSITORY,
  });
  assert.equal(uppercase.ok, false);
  assert.match(uppercase.errors.join("\n"), /full lowercase SHA/);
});

test("requires an explicit channel and exact repository binding", () => {
  const missingChannel = validateReleaseCandidate(candidate(), {
    tag: TAG,
    sourceCommit: COMMIT,
    repository: REPOSITORY,
  });
  assert.equal(missingChannel.ok, false);
  assert.match(missingChannel.errors.join("\n"), /channel must be preview or stable/);

  const wrongRepository = validateReleaseCandidate(candidate(), {
    channel: "stable",
    tag: TAG,
    sourceCommit: COMMIT,
    repository: "other/moneysiren",
  });
  assert.equal(wrongRepository.ok, false);
  assert.match(wrongRepository.errors.join("\n"), /repository does not match/);
});

test("published assets require exact unique names, sizes, and digests", () => {
  const manifest = candidate();
  const assets = manifest.assets.map((asset) => ({
    name: asset.name,
    size: asset.size,
    digest: `sha256:${asset.sha256}`,
  }));

  assert.equal(
    validatePublishedReleaseIsImmutable({
      draft: false,
      assets,
    }, manifest).ok,
    true,
  );

  const missingDigest = structuredClone(assets);
  delete missingDigest[0].digest;
  assert.equal(
    validatePublishedReleaseIsImmutable({
      draft: false,
      assets: missingDigest,
    }, manifest).ok,
    false,
  );

  assert.equal(
    validatePublishedReleaseIsImmutable({
      draft: false,
      assets: [...assets, assets[0]],
    }, manifest).ok,
    false,
  );
});
test("published assets cannot be replaced in place", () => {
  assert.equal(
    validatePublishedReleaseIsImmutable({
      draft: false,
      assets: [{ name: "different.zip" }],
    }, candidate()).ok,
    false,
  );

  assert.equal(
    validatePublishedReleaseIsImmutable({
      draft: true,
      assets: [],
    }, candidate()).ok,
    true,
  );
});
