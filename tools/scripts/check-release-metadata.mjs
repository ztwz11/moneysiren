import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { readReleaseTag } from "./lib/release-metadata.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");
const rootPackage = await readJson(resolve(repoRoot, "package.json"));
const version = requireVersion(rootPackage, "package.json");
const expectedTag = "v" + version;
const tag = readReleaseTag(process.argv.slice(2), expectedTag);
const failures = [];

if (tag !== expectedTag) {
  failures.push("Release tag " + tag + " does not match root package version " + expectedTag + ".");
}

for (const relativePath of await findPackageManifests()) {
  const manifest = await readJson(resolve(repoRoot, relativePath));
  if (typeof manifest.version === "string" && manifest.version !== version) {
    failures.push(relativePath + " version " + manifest.version + " does not match " + version + ".");
  }
}

const notesPath = "docs/release/desktop-" + tag + "-notes.md";
const notes = await readRequiredText(notesPath);
const expectedHeading = "# MoneySiren " + tag;

if (notes !== null && firstNonEmptyLine(notes) !== expectedHeading) {
  failures.push(notesPath + " must start with exactly: " + expectedHeading);
}

const changelog = await readRequiredText("CHANGELOG.md");
const changelogPattern = new RegExp(
  "^## \\[" + escapeRegExp(version) + "\\] - \\d{4}-\\d{2}-\\d{2}$",
  "m",
);

if (changelog !== null && !changelogPattern.test(changelog)) {
  failures.push("CHANGELOG.md is missing a dated " + version + " release heading.");
}

if (failures.length > 0) {
  console.error("Release metadata failed for " + tag + ".");
  for (const failure of failures) {
    console.error("- " + failure);
  }
  process.exit(1);
}

console.log("Release metadata passed for " + tag + ".");
console.log("- version: " + version);
console.log("- notes: " + notesPath);
console.log("- changelog: matched");

async function findPackageManifests() {
  const manifests = ["package.json"];

  for (const root of ["apps", "packages"]) {
    await visitDirectory(root, manifests);
  }

  return manifests.sort();
}

async function visitDirectory(relativeDirectory, manifests) {
  const entries = await readdir(resolve(repoRoot, relativeDirectory), {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }

    const relativePath = join(relativeDirectory, entry.name).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      await visitDirectory(relativePath, manifests);
    } else if (entry.isFile() && basename(relativePath) === "package.json") {
      manifests.push(relativePath);
    }
  }
}

async function readRequiredText(relativePath) {
  try {
    return await readFile(resolve(repoRoot, relativePath), "utf8");
  } catch (error) {
    if (isErrorWithCode(error, "ENOENT")) {
      failures.push("Missing required release metadata file: " + relativePath);
      return null;
    }
    throw error;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function requireVersion(manifest, path) {
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)
  ) {
    throw new Error(path + " has no valid release version.");
  }

  return manifest.version;
}

function firstNonEmptyLine(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
}

function isErrorWithCode(error, code) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code;
}
