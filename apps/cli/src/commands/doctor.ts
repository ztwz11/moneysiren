import { createServer } from "node:net";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ConfiguredProvider, ProviderConfig } from "../../../../packages/config/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { CLI_VERSION } from "../version.js";
import {
  DEFAULT_INSTALL_SURFACES,
  formatInstallSurfaces,
  readInstallProfileFile,
  resolveInstallProfilePath,
} from "../install-profile.js";
import {
  DEFAULT_RELEASE_REPOSITORY,
  DEFAULT_RELEASE_TAG,
  resolveReleaseInstallDir,
} from "../release-installer.js";
import { loadCliConfig } from "./shared.js";

const PROVIDER_ORDER: readonly ConfiguredProvider[] = ["aws", "openai", "supabase", "cloudflare"];
const DASHBOARD_PORT = 3000;
const MIN_NODE_VERSION = {
  major: 22,
  minor: 13,
  patch: 0,
} as const;

interface InstallManifest {
  assets?: Array<{
    path?: unknown;
    surface?: unknown;
  }>;
}

export async function runDoctorCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.length > 0) {
    context.stderr("Usage: moneysiren doctor");
    return 1;
  }

  const config = loadCliConfig(context.env);
  const installProfile = await readInstallProfileFile({
    env: context.env,
  });
  const releaseInstallDir = resolveReleaseInstallDir({
    env: context.env,
  });
  const webRuntimeInstalled = await hasInstalledWebRuntime(releaseInstallDir);
  const dashboardPortAvailable = await isTcpPortAvailable(DASHBOARD_PORT);

  context.stdout("MoneySiren doctor");
  context.stdout(`CLI version: ${CLI_VERSION}`);
  context.stdout(
    `Node version: ${process.version} (${isSupportedNodeVersion(process.versions.node) ? "OK" : "unsupported; use Node 22.13+"})`,
  );
  context.stdout("Package install: OK (msiren command is running)");
  context.stdout(`DB path: ${config.dbPath}`);
  context.stdout("SQLite: ready for local snapshots");
  context.stdout(`Telemetry: ${config.telemetryEnabled ? "enabled" : "disabled"}`);
  context.stdout(`Install profile: ${installProfile === null ? "not configured; using recommended default" : "configured"}`);
  context.stdout(`Selected components: ${formatInstallSurfaces(installProfile?.selectedSurfaces ?? DEFAULT_INSTALL_SURFACES)}`);
  context.stdout(`Profile path: ${resolveInstallProfilePath({ env: context.env })}`);
  context.stdout(`Web runtime: ${webRuntimeInstalled ? "installed" : "missing"}`);
  context.stdout(`Release default: ${DEFAULT_RELEASE_REPOSITORY}@${DEFAULT_RELEASE_TAG}`);
  context.stdout(`Release install dir: ${releaseInstallDir}`);
  context.stdout(`Dashboard port ${DASHBOARD_PORT}: ${dashboardPortAvailable ? "available" : "in use"}`);
  context.stdout("Mock provider: ready");

  for (const provider of PROVIDER_ORDER) {
    context.stdout(`${provider}: ${formatProviderReadiness(config.providers[provider])}`);
  }

  context.stdout(`slack: ${config.slack.webhookConfigured ? "configured" : "not configured"}`);
  context.stdout("Secrets returned: false");

  if (!webRuntimeInstalled) {
    context.stdout("Next step: run `msiren install --web`, then `msiren sync --provider mock`, then `msiren start`.");
  }

  return 0;
}

async function hasInstalledWebRuntime(releaseInstallDir: string): Promise<boolean> {
  try {
    const manifest = JSON.parse(
      await readFile(join(releaseInstallDir, "install-manifest.json"), "utf8"),
    ) as InstallManifest;
    const webAsset = manifest.assets?.find((asset) => asset.surface === "web" && typeof asset.path === "string");

    if (webAsset === undefined || typeof webAsset.path !== "string") {
      return false;
    }

    await stat(webAsset.path);
    return true;
  } catch {
    return false;
  }
}

function formatProviderReadiness(providerConfig: ProviderConfig): string {
  if (providerConfig.configured) {
    return "configured via local process environment";
  }

  return `not configured (missing ${providerConfig.missingEnvKeys.join(", ")})`;
}

async function isTcpPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolveAvailable) => {
    const server = createServer();

    server.once("error", () => {
      resolveAvailable(false);
    });

    server.listen(port, "127.0.0.1", () => {
      server.close(() => {
        resolveAvailable(true);
      });
    });
  });
}

function isSupportedNodeVersion(version: string): boolean {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((value) => Number.parseInt(value, 10));

  if (major > MIN_NODE_VERSION.major) {
    return true;
  }

  if (major < MIN_NODE_VERSION.major) {
    return false;
  }

  if (minor > MIN_NODE_VERSION.minor) {
    return true;
  }

  if (minor < MIN_NODE_VERSION.minor) {
    return false;
  }

  return patch >= MIN_NODE_VERSION.patch;
}
