#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateProviderClaims,
  validateQuickstartDocument,
  validateReadme,
} from "./lib/docs-contract.mjs";

const root = resolve(import.meta.dirname, "../..");
const quickstartFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "docs/install.md",
  "docs/demo.md",
  "docs/website-plan.md",
  "docs/marketing/demo-script.md",
];
const documents = new Map();

for (const path of [...quickstartFiles, "docs/provider-support-matrix.md"]) {
  documents.set(path, await readFile(resolve(root, path), "utf8"));
}

const issues = [];

for (const path of quickstartFiles) {
  issues.push(...validateQuickstartDocument(path, documents.get(path)));
}

issues.push(...validateReadme(documents.get("README.md")));
issues.push(...validateProviderClaims(
  documents.get("README.md"),
  documents.get("docs/provider-support-matrix.md"),
));

if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`docs-contract: ${issue}`);
  }

  process.exitCode = 1;
} else {
  console.log("docs-contract: canonical quickstart, README, and maturity claims verified");
}
