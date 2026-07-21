import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

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
});

test("Windows candidate and public HUD smokes gate npm publication", async () => {
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
  assert.match(source, /publish-npm:\s*\r?\n\s+name: publish-npm-after-public-smoke\s*\r?\n\s+needs: public-smoke/);
  assert.match(source, /uses: \.\/\.github\/workflows\/npm-publish-cli\.yml/);
  assert.match(source, /secrets: inherit/);
});

test("candidate layout includes app, web, and portable HUD artifacts", async () => {
  const smoke = await readFile(resolve(root, "tools", "scripts", "smoke-installed-package.mjs"), "utf8");

  assert.match(smoke, /moneysiren-app-/);
  assert.match(smoke, /moneysiren-web-runtime-/);
  assert.match(smoke, /x64-portable\\\.exe/);
  assert.match(smoke, /Web runtime: running/);
  assert.match(smoke, /HUD: running/);
  assert.match(smoke, /PUBLIC_HUD_SIGNATURE_NOT_VERIFIED/);
});

test("public release polling follows the caller workflow after npm became reusable", async () => {
  const source = await readFile(resolve(root, "tools", "scripts", "release-public.mjs"), "utf8");

  assert.match(source, /expectedWorkflows = \["ci", "secret-scan", "desktop-release"\]/);
  assert.doesNotMatch(source, /expectedWorkflows = \[[^\]]*"npm-publish-cli"/);
});
