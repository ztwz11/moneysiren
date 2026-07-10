const usage = "Usage: node tools/scripts/check-release-metadata.mjs [--tag vX.Y.Z]";

export function readReleaseTag(args, defaultTag) {
  if (typeof defaultTag !== "string" || defaultTag.trim().length === 0) {
    throw new Error("A non-empty default release tag is required.");
  }

  if (args.length === 0) {
    return defaultTag.trim();
  }

  if (args[0] === "--tag") {
    if (args.length !== 2) {
      throw new Error(usage);
    }

    return requireTag(args[1]);
  }

  if (args.length === 1 && !args[0].startsWith("--")) {
    return requireTag(args[0]);
  }

  throw new Error(usage);
}

function requireTag(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(usage);
  }

  return value.trim();
}
