import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateReleaseCandidate } from "./lib/release-candidate.mjs";
import { validateReleaseCandidateDirectory } from "./lib/release-candidate-directory.mjs";
import { RELEASE_MANIFEST_FILE_NAME } from "./lib/release-manifest.mjs";


try {
  const args = parseArgs(process.argv.slice(2));
  const assetsDir = resolve(args.assetsDir);
  const manifestPath = resolve(
    args.manifest ?? join(assetsDir, RELEASE_MANIFEST_FILE_NAME),
  );
  const canonicalManifestPath = resolve(
    join(assetsDir, RELEASE_MANIFEST_FILE_NAME),
  );

  if (manifestPath !== canonicalManifestPath) {
    throw new Error(`Release manifest must be ${RELEASE_MANIFEST_FILE_NAME} inside the candidate asset directory.`);
  }

  const manifest = await readBoundedManifest(manifestPath);
  const result = validateReleaseCandidate(manifest, {
    channel: args.channel,
    tag: args.tag,
    sourceCommit: args.sourceCommit,
    repository: args.repository,
  });

  const errors = [...result.errors];

  if (result.ok) {
    errors.push(...await validateReleaseCandidateDirectory(manifest, assetsDir));
  }

  if (errors.length > 0) {
    console.error("Release candidate policy failed.");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Release candidate policy passed for ${args.tag} (${args.channel}).`);
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Release candidate validation failed.",
  );
  process.exitCode = 1;
}
const MAX_RELEASE_MANIFEST_BYTES = 512 * 1024;

async function readBoundedManifest(path) {
  const metadata = await lstat(path);

  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > MAX_RELEASE_MANIFEST_BYTES
  ) {
    throw new Error("Release manifest must be a bounded regular file.");
  }

  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error("Release manifest must contain valid JSON.");
  }
}

function parseArgs(values) {
  const result = {
    channel: undefined,
    assetsDir: "dist/release-assets",
    manifest: undefined,
    sourceCommit: process.env.GITHUB_SHA ?? "",
    tag: process.env.GITHUB_REF_NAME ?? "",
    repository: process.env.GITHUB_REPOSITORY ?? "",
  };
  const seen = new Set();

  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    const value = values[index + 1];
    if (seen.has(name)) {
      throw new Error(`Duplicate release candidate option: ${name}`);
    }
    seen.add(name);


    if (name === "--assets-dir" && value !== undefined && !value.startsWith("--")) {
      result.assetsDir = value;
      index += 1;
    } else if (name === "--channel" && (value === "preview" || value === "stable")) {
      result.channel = value;
      index += 1;
    } else if (name === "--manifest" && value !== undefined && !value.startsWith("--")) {
      result.manifest = value;
      index += 1;
    } else if (name === "--source-commit" && value !== undefined && !value.startsWith("--")) {
      result.sourceCommit = value;
      index += 1;
    } else if (name === "--tag" && value !== undefined && !value.startsWith("--")) {
      result.tag = value;
      index += 1;
    } else if (name === "--repository" && value !== undefined && !value.startsWith("--")) {
      result.repository = value;
      index += 1;
    } else {
      throw new Error("Usage: check-release-candidate --assets-dir <dir> [--manifest <canonical-file>] --tag <vX.Y.Z> --source-commit <sha> --repository <owner/name> --channel <preview|stable>");
    }
  }

  if (
    result.tag.length === 0 ||
    result.sourceCommit.length === 0 ||
    result.repository.length === 0 ||
    result.channel === undefined
  ) {
    throw new Error("tag, source commit, repository, and channel are required");
  }

  return result;
}
