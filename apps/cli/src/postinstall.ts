#!/usr/bin/env node

import { DEFAULT_INSTALL_SURFACES, writeInstallProfileFile } from "./install-profile.js";
import { formatInstallSelectionLine, promptForInstallSurfaces } from "./install-selector.js";

const selectedSurfaces = await selectSurfaces();

try {
  const profile = await writeInstallProfileFile({
    selectedSurfaces,
    source: "postinstall",
    recommendedDefault: selectedSurfaces.length === DEFAULT_INSTALL_SURFACES.length,
  });

  console.log("MoneySiren setup profile saved.");
  console.log(formatInstallSelectionLine(profile.selectedSurfaces));
  console.log("Run `moneysiren install --status` to review or `moneysiren install` to change it.");
} catch (error) {
  console.warn(`MoneySiren setup profile skipped: ${error instanceof Error ? error.message : String(error)}`);
}

async function selectSurfaces() {
  if (isTruthy(process.env.MONEYSIREN_SKIP_POSTINSTALL)) {
    return DEFAULT_INSTALL_SURFACES;
  }

  if (!shouldPrompt()) {
    return DEFAULT_INSTALL_SURFACES;
  }

  return promptForInstallSurfaces({
    stdin: process.stdin,
    output: process.stdout,
  });
}

function shouldPrompt(): boolean {
  return Boolean(process.stdin.isTTY) &&
    Boolean(process.stdout.isTTY) &&
    !isTruthy(process.env.CI);
}

function isTruthy(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 && normalized !== "0" && normalized !== "false" && normalized !== "no";
}
