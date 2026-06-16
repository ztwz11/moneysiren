import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const webRoot = resolve(repoRoot, "apps", "web");
const standaloneRoot = resolve(webRoot, ".next", "standalone");
const standaloneAppRoot = resolve(standaloneRoot, "apps", "web");
const packageRoot = resolve(repoRoot, "dist", "web-runtime", "moneysiren-web-runtime");
const packageAppRoot = resolve(packageRoot, "apps", "web");

if (!existsSync(resolve(standaloneAppRoot, "server.js"))) {
  console.error([
    "Missing Next standalone server output.",
    "Run `npm run build` or `node tools/scripts/run-pnpm.mjs --filter @moneysiren/web build` first.",
  ].join("\n"));
  process.exit(1);
}

try {
  rmSync(packageRoot, {
    force: true,
    recursive: true,
  });
  mkdirSync(packageRoot, {
    recursive: true,
  });

  copyRecursive(standaloneRoot, packageRoot);
  copyPnpmStorePackages(resolve(packageRoot, "node_modules", ".pnpm"), resolve(packageRoot, "node_modules"));
  copyRecursive(resolve(webRoot, ".next", "static"), resolve(packageAppRoot, ".next", "static"));

  if (existsSync(resolve(webRoot, "public"))) {
    copyRecursive(resolve(webRoot, "public"), resolve(packageAppRoot, "public"));
  }

  writeFileSync(resolve(packageRoot, "start.mjs"), [
    "import { spawn } from 'node:child_process';",
    "import { dirname, resolve } from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    "",
    "const root = dirname(fileURLToPath(import.meta.url));",
    "const appRoot = resolve(root, 'apps', 'web');",
    "const server = resolve(appRoot, 'server.js');",
    "const child = spawn(process.execPath, [server], {",
    "  cwd: appRoot,",
    "  env: {",
    "    ...process.env,",
    "    HOSTNAME: process.env.HOSTNAME || '127.0.0.1',",
    "    PORT: process.env.PORT || '3000',",
    "  },",
    "  stdio: 'inherit',",
    "});",
    "",
    "child.on('exit', (code, signal) => {",
    "  if (signal) {",
    "    process.kill(process.pid, signal);",
    "    return;",
    "  }",
    "",
    "  process.exit(code ?? 1);",
    "});",
    "",
  ].join("\n"));

  writeFileSync(resolve(packageRoot, "README.md"), [
    "# MoneySiren Web Runtime",
    "",
    "This archive contains the built MoneySiren Next.js dashboard runtime for local alpha review.",
    "",
    "## Run",
    "",
    "```bash",
    "node start.mjs",
    "```",
    "",
    "The runtime listens on `http://127.0.0.1:3000` by default. Set `PORT` only if you also point the desktop shell at the same port.",
    "",
    "Use process-local environment variables for live provider credentials. Do not create `.env` files with real secrets.",
    "",
  ].join("\n"));

  console.log(`Packaged web runtime at ${packageRoot}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function copyRecursive(source, destination) {
  const sourceStat = lstatSync(source);

  if (sourceStat.isSymbolicLink()) {
    const target = resolve(dirname(source), readlinkSync(source));
    const targetStat = statSync(target);

    if (targetStat.isDirectory()) {
      copyRecursive(target, destination);
      return;
    }

    mkdirSync(dirname(destination), {
      recursive: true,
    });
    copyFileSync(target, destination);
    return;
  }

  if (sourceStat.isDirectory()) {
    mkdirSync(destination, {
      recursive: true,
    });

    for (const entry of readdirSync(source)) {
      copyRecursive(resolve(source, entry), resolve(destination, entry));
    }
    return;
  }

  mkdirSync(dirname(destination), {
    recursive: true,
  });
  copyFileSync(source, destination);
}

function copyPnpmStorePackages(storeRoot, destination) {
  if (!existsSync(storeRoot)) {
    return;
  }

  for (const entry of readdirSync(storeRoot)) {
    if (entry === "lock.yaml" || entry === "node_modules") {
      continue;
    }

    const packageName = decodePnpmStorePackageName(entry);
    if (packageName === null) {
      continue;
    }

    const sourceEntry = resolve(storeRoot, entry, "node_modules", ...packageName.split("/"));
    if (!existsSync(sourceEntry)) {
      continue;
    }

    copyIfMissing(sourceEntry, resolve(destination, ...packageName.split("/")));
  }
}

function copyIfMissing(source, destination) {
  if (existsSync(destination)) {
    return;
  }

  copyRecursive(source, destination);
}

function decodePnpmStorePackageName(entry) {
  if (entry.startsWith("@")) {
    const versionSeparator = entry.indexOf("@", 1);

    if (versionSeparator === -1) {
      return null;
    }

    return entry.slice(0, versionSeparator).replace("+", "/");
  }

  const versionSeparator = entry.indexOf("@");

  if (versionSeparator <= 0) {
    return null;
  }

  return entry.slice(0, versionSeparator);
}
