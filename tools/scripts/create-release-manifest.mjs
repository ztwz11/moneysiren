#!/usr/bin/env node

import { resolve } from "node:path";
import { writeReleaseManifest } from "./lib/release-manifest.mjs";

const options = parseArgs(process.argv.slice(2));
const assetsDir = resolve(options.assetsDir);
const outputPath = options.outputPath === undefined ? undefined : resolve(options.outputPath);

try {
  const result = await writeReleaseManifest({
    assetsDir,
    repository: options.repository,
    tag: options.tag,
    sourceCommit: options.sourceCommit,
    ...(outputPath === undefined ? {} : { outputPath }),
  });

  console.log(`Release manifest: ${result.outputPath}`);
  console.log(`Source commit: ${result.manifest.sourceCommit}`);
  console.log(`Assets: ${result.manifest.assets.length}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseArgs(args) {
  const values = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg?.startsWith("--")) {
      usage();
    }

    const equalsIndex = arg.indexOf("=");
    const key = equalsIndex === -1 ? arg.slice(2) : arg.slice(2, equalsIndex);
    const value = equalsIndex === -1 ? args[index + 1] : arg.slice(equalsIndex + 1);

    if (!["assets-dir", "output", "repository", "tag", "source-commit"].includes(key) || !value || value.startsWith("--")) {
      usage();
    }

    if (values.has(key)) {
      throw new Error(`Duplicate option: --${key}`);
    }

    values.set(key, value);

    if (equalsIndex === -1) {
      index += 1;
    }
  }

  const assetsDir = values.get("assets-dir");
  const tag = values.get("tag");
  const sourceCommit = values.get("source-commit");

  if (!assetsDir || !tag || !sourceCommit) {
    usage();
  }

  return {
    assetsDir,
    repository: values.get("repository") ?? "ztwz11/moneysiren",
    tag,
    sourceCommit,
    ...(values.has("output") ? { outputPath: values.get("output") } : {}),
  };
}

function usage() {
  throw new Error(
    "Usage: node tools/scripts/create-release-manifest.mjs --assets-dir <dir> --tag <vX.Y.Z> --source-commit <40-char-sha> [--repository <owner/name>] [--output <path>]",
  );
}
