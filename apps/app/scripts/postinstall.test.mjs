import assert from "node:assert/strict";
import test from "node:test";

import { createAssetInstallPlan, executeAssetInstallPlan } from "./postinstall-assets.mjs";

test("default global install requests the complete web and HUD release", () => {
  const plan = createAssetInstallPlan();

  assert.deepEqual(plan.primary, ["install", "--all"]);
  assert.deepEqual(plan.fallback, [
    ["install", "--web"],
    ["install", "--all", "--profile-only"],
  ]);
});

test("unsigned HUD acceptance stays behind explicit local opt-in", () => {
  const plan = createAssetInstallPlan({ allowUnsignedHud: true });

  assert.deepEqual(plan.primary, ["install", "--all", "--allow-unsigned-hud"]);
  assert.equal(plan.fallback.flat().includes("--allow-unsigned-hud"), false);
});

test("a complete install does not run the partial fallback", () => {
  const result = executeAssetInstallPlan(createAssetInstallPlan(), () => true);

  assert.equal(result.complete, true);
  assert.equal(result.fallbackComplete, false);
  assert.deepEqual(result.attempts, [["install", "--all"]]);
});

test("a failed complete install keeps web and retry profile usable", () => {
  const outcomes = [false, true, true];
  const result = executeAssetInstallPlan(
    createAssetInstallPlan(),
    () => outcomes.shift() ?? false,
  );

  assert.equal(result.complete, false);
  assert.equal(result.fallbackComplete, true);
  assert.deepEqual(result.attempts, [
    ["install", "--all"],
    ["install", "--web"],
    ["install", "--all", "--profile-only"],
  ]);
  assert.equal(JSON.stringify(result).includes("token"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("fallback stops after the first failed recovery step", () => {
  const result = executeAssetInstallPlan(
    createAssetInstallPlan(),
    (args) => args.includes("--profile-only"),
  );

  assert.equal(result.complete, false);
  assert.equal(result.fallbackComplete, false);
  assert.deepEqual(result.attempts, [
    ["install", "--all"],
    ["install", "--web"],
  ]);
});
