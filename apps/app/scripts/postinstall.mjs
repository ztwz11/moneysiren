#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(scriptPath)) {
  runPostinstall();
}

export function runPostinstall(input = {}) {
  const env = input.env ?? process.env;
  const platform = input.platform ?? process.platform;
  const scriptDir = dirname(scriptPath);
  const packageRoot = input.packageRoot ?? resolve(scriptDir, "..");
  const cliEntry = resolve(packageRoot, "dist", "apps", "cli", "src", "index.js");

  if (isTruthy(env.MONEYSIREN_SKIP_APP_POSTINSTALL)) {
    console.log("MoneySiren app command setup skipped by MONEYSIREN_SKIP_APP_POSTINSTALL.");
    return;
  }

  if (!existsSync(cliEntry)) {
    console.warn("MoneySiren app package is missing its bundled CLI entrypoint.");
    console.warn("No remote runtime download was attempted.");
    return;
  }

  if (isGlobalInstall(env) || isTruthy(env.MONEYSIREN_APP_INSTALL_GLOBAL_SHIMS)) {
    installGlobalCommandShims(cliEntry, {
      env,
      platform,
    });
  }

  console.log("MoneySiren commands installed.");
  console.log("Remote runtime: not installed by npm.");
  console.log("Run `msiren install --web` to download and verify the matching release runtime.");
  console.log("HUD artifacts remain explicit: `msiren install --hud`.");
}

export function installGlobalCommandShims(entrypoint, input = {}) {
  const env = input.env ?? process.env;
  const platform = input.platform ?? process.platform;
  const binDirs = getGlobalBinDirs({
    env,
    platform,
  });
  const installed = [];

  for (const binDir of binDirs) {
    try {
      mkdirSync(binDir, {
        recursive: true,
      });

      for (const command of ["moneysiren", "msiren"]) {
        installed.push(...writeCommandShim(binDir, command, entrypoint, platform));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`MoneySiren app command shim setup skipped for ${binDir}: ${message}`);
    }
  }

  if (installed.length > 0) {
    console.log(`MoneySiren command shim(s) ready: ${Array.from(new Set(installed)).join(", ")}`);
  }

  return installed;
}

export function writeCommandShim(binDir, command, entrypoint, platform = process.platform) {
  if (platform === "win32") {
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

function getGlobalBinDirs(input) {
  const candidates = [input.env.npm_config_prefix ?? dirname(process.execPath)];
  const dirs = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    addBinDir(dirs, candidate, input.platform);

    try {
      addBinDir(dirs, realpathSync(candidate), input.platform);
    } catch {
      // The original candidate remains usable when realpath is unavailable.
    }
  }

  return dirs;
}

function addBinDir(dirs, candidate, platform) {
  const binDir = platform === "win32"
    ? resolve(candidate)
    : basename(candidate) === "bin"
      ? resolve(candidate)
      : resolve(candidate, "bin");
  const normalized = platform === "win32" ? binDir.toLowerCase() : binDir;

  if (!dirs.some((dir) => (platform === "win32" ? dir.toLowerCase() : dir) === normalized)) {
    dirs.push(binDir);
  }
}

function writeShimFile(filePath, content, executable) {
  if (existsSync(filePath) && !isMoneySirenShim(filePath)) {
    console.warn(`MoneySiren app command shim not replaced because it is not MoneySiren-owned: ${filePath}`);
    return null;
  }

  writeFileSync(filePath, content, {
    encoding: "utf8",
    flag: "w",
  });

  if (executable) {
    try {
      chmodSync(filePath, 0o755);
    } catch {
      // Windows may ignore POSIX executable bits.
    }
  }

  return filePath;
}

export function isMoneySirenShim(filePath) {
  try {
    const source = readFileSync(filePath, "utf8");

    return /@moneysiren[\\/]app|@moneysiren[\\/]cli|moneysiren-app|moneysiren-cli|MoneySiren app command shim|dist[\\/]apps[\\/]cli[\\/]src[\\/]index\.js/i.test(source);
  } catch {
    return false;
  }
}

function createPosixShim(entrypoint) {
  return [
    "#!/bin/sh",
    "# MoneySiren app command shim",
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
    "REM MoneySiren app command shim",
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
    "# MoneySiren app command shim",
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

function isGlobalInstall(env) {
  return env.npm_config_global === "true" ||
    env.npm_config_location === "global";
}

function isTruthy(value) {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 &&
    normalized !== "0" &&
    normalized !== "false" &&
    normalized !== "no";
}
