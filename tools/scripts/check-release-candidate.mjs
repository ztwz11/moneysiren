import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateReleaseCandidate } from "./lib/release-candidate.mjs";

const args = parseArgs(process.argv.slice(2));

try {
  const manifest = JSON.parse(await readFile(resolve(args.manifest), "utf8"));
  const result = validateReleaseCandidate(manifest, {
    channel: args.channel,
    tag: args.tag,
    sourceCommit: args.sourceCommit,
  });

  if (!result.ok) {
    console.error("Release candidate policy failed.");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Release candidate policy passed for ${args.tag} (${args.channel}).`);
  }
} catch {
  console.error("Release candidate policy could not read a valid bounded manifest.");
  process.exitCode = 1;
}

function parseArgs(values) {
  const result = {
    channel: "preview",
    manifest: "dist/release/release-manifest.json",
    sourceCommit: process.env.GITHUB_SHA ?? "",
    tag: process.env.GITHUB_REF_NAME ?? "",
  };

  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    const value = values[index + 1];

    if (name === "--channel" && (value === "preview" || value === "stable")) {
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
    } else {
      throw new Error("Usage: check-release-candidate --manifest <file> --tag <vX.Y.Z> --source-commit <sha> [--channel preview|stable]");
    }
  }

  if (result.tag.length === 0 || result.sourceCommit.length === 0) {
    throw new Error("tag and source commit are required");
  }

  return result;
}
