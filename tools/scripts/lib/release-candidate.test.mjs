import assert from "node:assert/strict";
import test from "node:test";
import {
  validatePublishedReleaseIsImmutable,
  validateReleaseCandidate,
} from "./release-candidate.mjs";

const TAG = "v0.1.6";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function candidate(overrides = {}) {
  return {
    schemaVersion: 1,
    repository: "ztwz11/moneysiren",
    tag: TAG,
    version: TAG.slice(1),
    sourceCommit: COMMIT,
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
    }),
    { ok: true, errors: [] },
  );
});

test("stable refuses an unsigned or missing Windows HUD", () => {
  const unsigned = candidate();
  unsigned.assets[1].signing = {
    state: "unsigned",
    method: "authenticode",
  };

  const unsignedResult = validateReleaseCandidate(unsigned, {
    channel: "stable",
    tag: TAG,
    sourceCommit: COMMIT,
  });
  assert.equal(unsignedResult.ok, false);
  assert.match(unsignedResult.errors.join("\n"), /not signed/);
  assert.match(unsignedResult.errors.join("\n"), /Authenticode metadata/);

  const noHud = candidate({ assets: [candidate().assets[0]] });
  const noHudResult = validateReleaseCandidate(noHud, {
    channel: "stable",
    tag: TAG,
    sourceCommit: COMMIT,
  });
  assert.equal(noHudResult.ok, false);
  assert.match(noHudResult.errors.join("\n"), /signed Windows HUD/);
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
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /version does not match/);
  assert.match(result.errors.join("\n"), /sourceCommit does not match/);
  assert.match(result.errors.join("\n"), /unique safe basenames/);
  assert.match(result.errors.join("\n"), /invalid SHA256/);
  assert.match(result.errors.join("\n"), /exactly one web runtime/);
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
