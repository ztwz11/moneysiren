#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const cliEntry = resolve(packageRoot, "dist", "apps", "cli", "src", "index.js");
const isGlobal = isGlobalInstall();

if (isTruthy(process.env.MONEYSIREN_SKIP_APP_POSTINSTALL)) {
  console.log("MoneySiren app asset installation skipped by MONEYSIREN_SKIP_APP_POSTINSTALL.");
  process.exit(0);
}

if (!existsSync(cliEntry)) {
  console.warn("MoneySiren app package is missing its bundled CLI entrypoint.");
  console.warn("Run `msiren install --web` after installation if the command is available.");
  process.exit(0);
}

if (isGlobal || isTruthy(process.env.MONEYSIREN_APP_INSTALL_GLOBAL_SHIMS)) {
  installGlobalCommandShims(cliEntry);
}

if (!shouldInstallReleaseAssets()) {
  console.log("MoneySiren app package installed.");
  console.log("Run `msiren install --web` to download the local web dashboard runtime.");
  console.log("For temporary unsigned HUD smoke testing, set MONEYSIREN_ALLOW_UNSIGNED_HUD=true and run `msiren install --hud`.");
  process.exit(0);
}

console.log("MoneySiren app package installed.");
if (isTruthy(process.env.MONEYSIREN_ALLOW_UNSIGNED_HUD)) {
  console.log("Installing local web dashboard and HUD artifacts...");
  runCliInstall(["install", "--all"]);
} else {
  console.log("Installing local web dashboard runtime...");
  console.log("Unsigned Windows HUD artifacts require explicit MONEYSIREN_ALLOW_UNSIGNED_HUD=true opt-in.");
  runCliInstall(["install", "--web"]);
  runCliInstall(["install", "--all", "--profile-only"]);
}

function runCliInstall(args) {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: process.env.INIT_CWD || process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      MONEYSIREN_APP_POSTINSTALL: "1",
    },
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error !== undefined) {
    handleAssetInstallFailure(`MoneySiren app asset installation failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    handleAssetInstallFailure("MoneySiren app asset installation failed.");
  }
}

function installGlobalCommandShims(entrypoint) {
  const binDirs = getGlobalBinDirs();
  const installed = [];

  for (const binDir of binDirs) {
    try {
      mkdirSync(binDir, {
        recursive: true,
      });

      for (const command of ["moneysiren", "msiren"]) {
        installed.push(...writeCommandShim(binDir, command, entrypoint));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`MoneySiren app command shim setup skipped for ${binDir}: ${message}`);
    }
  }

  if (installed.length > 0) {
    console.log(`MoneySiren command shim(s) ready: ${Array.from(new Set(installed)).join(", ")}`);
  }
}

function getGlobalBinDirs() {
  const candidates = [process.env.npm_config_prefix ?? dirname(process.execPath)];
  const dirs = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    addBinDir(dirs, candidate);

    try {
      addBinDir(dirs, realpathSync(candidate));
    } catch {
      // Best effort only. The original candidate is still useful.
    }
  }

  return dirs;
}

function addBinDir(dirs, candidate) {
  const binDir = process.platform === "win32"
    ? resolve(candidate)
    : basename(candidate) === "bin"
      ? resolve(candidate)
      : resolve(candidate, "bin");
  const normalized = binDir.toLowerCase();

  if (!dirs.some((dir) => dir.toLowerCase() === normalized)) {
    dirs.push(binDir);
  }
}

function writeCommandShim(binDir, command, entrypoint) {
  if (process.platform === "win32") {
    return [
      writeShimFile(resolve(binDir, command), createPosixShim(entrypoint), true),
      writeShimFile(resolve(binDir, `${command}.cmd`), createCmdShim(entrypoint), false),
      writeShimFile(resolve(binDir, `${command}.ps1`), createPowerShellShim(entrypoint), false),
    ].filter(Boolean);
  }

  return [
    writeShimFile(resolve(binDir, command), createPosixShim(entrypoint), true),
  ].filter(Boolean);
}

function writeShimFile(filePath, content, executable) {
  if (existsSync(filePath) && !isMoneySirenShim(filePath)) {
    console.warn(`MoneySiren app command shim not replaced because it is not MoneySiren-owned: ${filePath}`);
    return null;
  }

  writeFileSync(filePath, content, "utf8");

  if (executable) {
    try {
      chmodSync(filePath, 0o755);
    } catch {
      // Windows may ignore POSIX executable bits.
    }
  }

  return filePath;
}

function handleAssetInstallFailure(message) {
  console.warn(message);
  console.warn("MoneySiren commands were installed. Retry web asset installation with `msiren install --web` after npm finishes.");
  console.warn("For temporary unsigned HUD smoke testing, set MONEYSIREN_ALLOW_UNSIGNED_HUD=true and run `msiren install --hud`.");

  if (isTruthy(process.env.MONEYSIREN_APP_STRICT_POSTINSTALL)) {
    process.exit(1);
  }

  process.exit(0);
}

function isMoneySirenShim(filePath) {
  try {
    const source = readFileSync(filePath, "utf8");

    return /@moneysiren[\\/]app|@moneysiren[\\/]cli|moneysiren-app|moneysiren-cli|MoneySiren app command shim/i.test(source);
  } catch {
    return false;
  }
}

function createPosixShim(entrypoint) {
  return [
    "#!/bin/sh",
    "basedir=$(dirname \"$(echo \"$0\" | sed -e 's,\\\\,/,g')\")",
    "",
    "case `uname` in",
    "    *CYGWIN*|*MINGW*|*MSYS*)",
    "        if command -v cygpath > /dev/null 2>&1; then",
    "            basedir=`cygpath -w \"$basedir\"`",
    "        fi",
    "    ;;",
    "esac",
    "",
    "if [ -x \"$basedir/node\" ]; then",
    `  exec "$basedir/node" ${shellQuote(toPosixPath(entrypoint))} "$@"`,
    "else",
    `  exec node ${shellQuote(toPosixPath(entrypoint))} "$@"`,
    "fi",
    "",
  ].join("\n");
}

function createCmdShim(entrypoint) {
  return [
    "@ECHO off",
    "SETLOCAL",
    "IF EXIST \"%~dp0\\node.exe\" (",
    "  SET \"_prog=%~dp0\\node.exe\"",
    ") ELSE (",
    "  SET \"_prog=node\"",
    "  SET PATHEXT=%PATHEXT:;.JS;=;%",
    ")",
    `"%_prog%" "${entrypoint}" %*`,
    "",
  ].join("\r\n");
}

function createPowerShellShim(entrypoint) {
  const escapedEntrypoint = entrypoint.replace(/'/g, "''");

  return [
    "#!/usr/bin/env pwsh",
    "$basedir = Split-Path $MyInvocation.MyCommand.Definition -Parent",
    "$exe = \"\"",
    "if ($PSVersionTable.PSVersion -lt \"6.0\" -or $IsWindows) {",
    "  $exe = \".exe\"",
    "}",
    "$node = if (Test-Path \"$basedir/node$exe\") { \"$basedir/node$exe\" } else { \"node\" }",
    `$entry = '${escapedEntrypoint}'`,
    "if ($MyInvocation.ExpectingInput) {",
    "  $input | & $node $entry $args",
    "} else {",
    "  & $node $entry $args",
    "}",
    "exit $LASTEXITCODE",
    "",
  ].join("\n");
}

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function shouldInstallReleaseAssets() {
  return isTruthy(process.env.MONEYSIREN_APP_INSTALL_ALL) ||
    isGlobal;
}

function isGlobalInstall() {
  return process.env.npm_config_global === "true" ||
    process.env.npm_config_location === "global";
}

function isTruthy(value) {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 && normalized !== "0" && normalized !== "false" && normalized !== "no";
}
