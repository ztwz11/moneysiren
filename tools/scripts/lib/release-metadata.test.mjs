import assert from "node:assert/strict";
import test from "node:test";

import { readReleaseTag } from "./release-metadata.mjs";

test("defaults to the current package tag when no argument is supplied", () => {
  assert.equal(readReleaseTag([], "v0.1.5"), "v0.1.5");
});

test("preserves explicit --tag support", () => {
  assert.equal(
    readReleaseTag(["--tag", " v0.1.6 "], "v0.1.5"),
    "v0.1.6",
  );
});

test("preserves the legacy positional tag", () => {
  assert.equal(readReleaseTag(["v0.1.4"], "v0.1.5"), "v0.1.4");
});

test("rejects incomplete or ambiguous arguments", () => {
  for (const args of [
    ["--tag"],
    ["--unknown"],
    ["--tag", "v0.1.5", "extra"],
    ["", "extra"],
  ]) {
    assert.throws(
      () => readReleaseTag(args, "v0.1.5"),
      /Usage: node tools\/scripts\/check-release-metadata\.mjs/,
    );
  }
});
