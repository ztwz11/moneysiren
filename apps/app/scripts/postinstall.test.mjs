import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
  runPostinstall,
  writeCommandShim,
} from "./postinstall.mjs";

test("global postinstall creates command shims repeatedly without EEXIST failures or remote runtime writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "moneysiren-postinstall-"));
  const packageRoot = join(root, "package");
  const prefix = join(root, "prefix");
  const cliEntry = join(packageRoot, "dist", "apps", "cli", "src", "index.js");

  await mkdir(dirname(cliEntry), {
    recursive: true,
  });
  await writeFile(cliEntry, "export {};\n", "utf8");

  const input = {
    env: {
      npm_config_global: "true",
      npm_config_prefix: prefix,
    },
    packageRoot,
    platform: "linux",
  };

  runPostinstall(input);
  runPostinstall(input);

  const moneysiren = await readFile(join(prefix, "bin", "moneysiren"), "utf8");
  const msiren = await readFile(join(prefix, "bin", "msiren"), "utf8");

  assert.match(moneysiren, /MoneySiren app command shim/);
  assert.match(msiren, /dist\/apps\/cli\/src\/index\.js/);
  await assert.rejects(readFile(join(prefix, "bin", "install-manifest.json"), "utf8"));
});

test("postinstall preserves command files it does not own", async () => {
  const root = await mkdtemp(join(tmpdir(), "moneysiren-postinstall-"));
  const packageRoot = join(root, "package");
  const prefix = join(root, "prefix");
  const cliEntry = join(packageRoot, "dist", "apps", "cli", "src", "index.js");
  const existingShim = join(prefix, "bin", "msiren");

  await mkdir(dirname(cliEntry), {
    recursive: true,
  });
  await mkdir(dirname(existingShim), {
    recursive: true,
  });
  await writeFile(cliEntry, "export {};\n", "utf8");
  await writeFile(existingShim, "#!/bin/sh\necho unrelated\n", "utf8");

  runPostinstall({
    env: {
      npm_config_global: "true",
      npm_config_prefix: prefix,
    },
    packageRoot,
    platform: "linux",
  });

  assert.equal(await readFile(existingShim, "utf8"), "#!/bin/sh\necho unrelated\n");
});

test("Windows shim generation can be repeated over MoneySiren-owned files", async () => {
  const root = await mkdtemp(join(tmpdir(), "moneysiren-postinstall-"));
  const entrypoint = join(root, "package", "dist", "apps", "cli", "src", "index.js");

  await mkdir(dirname(entrypoint), {
    recursive: true,
  });
  await writeFile(entrypoint, "export {};\n", "utf8");

  assert.equal(writeCommandShim(root, "msiren", entrypoint, "win32").length, 3);
  assert.equal(writeCommandShim(root, "msiren", entrypoint, "win32").length, 3);
  assert.match(await readFile(join(root, "msiren.cmd"), "utf8"), /MoneySiren app command shim/);
  assert.match(await readFile(join(root, "msiren.ps1"), "utf8"), /MoneySiren app command shim/);
});
