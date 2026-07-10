import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  validatePublishedReleaseIsImmutable,
  validateReleaseCandidate,
} from "./lib/release-candidate.mjs";
import {
  collectReleaseCandidateAssets,
  validateReleaseCandidateDirectory,
} from "./lib/release-candidate-directory.mjs";
import { RELEASE_MANIFEST_FILE_NAME } from "./lib/release-manifest.mjs";

const MAX_JSON_BYTES = 4 * 1024 * 1024;

try {
  const args = parseArgs(process.argv.slice(2));
  const assetsDir = resolve(args.assetsDir);
  const manifestPath = join(assetsDir, RELEASE_MANIFEST_FILE_NAME);
  const manifest = await readBoundedJson(manifestPath, "release manifest");
  const release = await readBoundedJson(resolve(args.releaseJson), "GitHub release state");
  const policy = validateReleaseCandidate(manifest, {
    channel: args.channel,
    tag: args.tag,
    sourceCommit: args.sourceCommit,
    repository: args.repository,
  });
  const errors = [...policy.errors];

  if (policy.ok) {
    errors.push(...await validateReleaseCandidateDirectory(manifest, assetsDir));
  }

  if (errors.length > 0) {
    fail("Release candidate policy failed before published-asset comparison.", errors);
  } else {
    const candidateAssets = await collectReleaseCandidateAssets(assetsDir);
    const payloadNames = new Set(manifest.assets.map((asset) => asset.name));
    const supportAssets = candidateAssets.filter((asset) => !payloadNames.has(asset.name));
    const immutable = validatePublishedReleaseIsImmutable(release, manifest, {
      supportAssets,
    });

    if (!immutable.ok) {
      fail("Published release assets differ from the validated candidate.", immutable.errors);
    } else if (release.draft === true) {
      console.log("Draft release may be replaced with the validated candidate.");
    } else {
      console.log("Published release assets exactly match the validated candidate; asset upload must be skipped.");
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Published release asset validation failed.");
  process.exitCode = 1;
}

function fail(message, errors) {
  console.error(message);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
}

async function readBoundedJson(path, label) {
  const metadata = await lstat(path);

  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > MAX_JSON_BYTES
  ) {
    throw new Error(`${label} must be a bounded regular JSON file.`);
  }

  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
}

function parseArgs(values) {
  const result = {
    assetsDir: "dist/release-assets",
    releaseJson: "",
    channel: "",
    tag: "",
    sourceCommit: "",
    repository: "",
  };
  const seen = new Set();

  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    const value = values[index + 1];

    if (seen.has(name)) {
      throw new Error(`Duplicate published-release option: ${name}`);
    }
    seen.add(name);

    if (
      ["--assets-dir", "--release-json", "--channel", "--tag", "--source-commit", "--repository"].includes(name) &&
      value !== undefined &&
      !value.startsWith("--")
    ) {
      const key = {
        "--assets-dir": "assetsDir",
        "--release-json": "releaseJson",
        "--channel": "channel",
        "--tag": "tag",
        "--source-commit": "sourceCommit",
        "--repository": "repository",
      }[name];
      result[key] = value;
      index += 1;
    } else {
      throw new Error("Usage: check-published-release-assets --assets-dir <dir> --release-json <file> --tag <vX.Y.Z> --source-commit <sha> --repository <owner/name> --channel <preview|stable>");
    }
  }

  if (
    result.releaseJson.length === 0 ||
    result.tag.length === 0 ||
    result.sourceCommit.length === 0 ||
    result.repository.length === 0 ||
    !["preview", "stable"].includes(result.channel)
  ) {
    throw new Error("release JSON, tag, source commit, repository, and channel are required");
  }

  return result;
}
