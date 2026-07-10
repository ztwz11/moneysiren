import type { CliExecutionContext } from "../cli.js";
import {
  DEFAULT_INSTALL_SURFACES,
  INSTALL_SURFACES,
  isInstallSurface,
  readInstallProfileFile,
  resolveInstallProfilePath,
  writeInstallProfileFile,
  type InstallSurface,
} from "../install-profile.js";
import {
  formatInstallSelectionLine,
  installSelectionHelp,
  parseInstallSurfaceSelection,
  promptForInstallSurfaces,
} from "../install-selector.js";
import {
  DEFAULT_RELEASE_REPOSITORY,
  DEFAULT_RELEASE_TAG,
  installReleaseAssets,
  readReleaseRuntimeInstallStatus,
  type ReleaseInstallResult,
} from "../release-installer.js";

const INSTALL_USAGE = [
  "Usage: moneysiren install [--status|--all|--cli|--web|--hud|--no-cli|--no-web|--no-hud] [--profile-only] [--allow-unsigned-hud] [--tag <tag>] [--repo <owner/name>] [--dir <path>]",
  "",
  "Components:",
  installSelectionHelp(),
  "",
  "Default: all components selected (recommended).",
  "Temporary Windows HUD smoke testing: pass --allow-unsigned-hud explicitly to accept an unsigned HUD artifact.",
  `Release default: ${DEFAULT_RELEASE_REPOSITORY}@${DEFAULT_RELEASE_TAG}.`,
].join("\n");

interface ParsedInstallArgs {
  allowUnsignedHud: boolean;
  installDir?: string;
  profileOnly: boolean;
  releaseRepository?: string;
  releaseTag?: string;
  selectedSurfaces?: readonly InstallSurface[];
}

export async function runInstallCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(INSTALL_USAGE);
    return 0;
  }

  if (args.length === 1 && args[0] === "--status") {
    return writeInstallStatus(context);
  }

  const parsed = parseInstallArgs(args);

  if (parsed === null) {
    context.stderr(INSTALL_USAGE);
    return 1;
  }

  const selectedSurfaces = parsed.selectedSurfaces ?? await selectedSurfacesFromPromptOrDefault(context);
  const releaseResult = await installReleaseAssetsForSelectionSafely({
    context,
    parsed,
    selectedSurfaces,
  });

  if (releaseResult === "failed") {
    return 1;
  }

  const profile = await writeInstallProfileFile({
    selectedSurfaces,
    source: "cli",
    recommendedDefault: isDefaultSelection(selectedSurfaces),
  }, {
    env: context.env,
    now: context.now,
  });

  context.stdout("MoneySiren install profile updated.");
  context.stdout(formatInstallSelectionLine(profile.selectedSurfaces));
  writeReleaseInstallResult(context, releaseResult);
  context.stdout("Secrets returned: false");
  return 0;
}

async function writeInstallStatus(context: CliExecutionContext): Promise<number> {
  const profile = await readInstallProfileFile({
    env: context.env,
  });
  const selectedSurfaces = profile?.selectedSurfaces ?? DEFAULT_INSTALL_SURFACES;

  const runtime = await readReleaseRuntimeInstallStatus({
    env: context.env,
  });

  context.stdout("MoneySiren install status");
  context.stdout("Commands: installed (this CLI is running).");
  context.stdout(`Install profile: ${profile === null ? "not configured; using recommended default" : "configured"}`);
  context.stdout(formatInstallSelectionLine(selectedSurfaces));
  context.stdout(`Recommended default: ${isDefaultSelection(selectedSurfaces) ? "yes" : "no"}`);
  context.stdout(`Profile path: ${resolveInstallProfilePath({ env: context.env })}`);
  context.stdout(`Remote runtime: ${runtime.status}`);
  context.stdout(`Runtime detail: ${runtime.message}`);
  context.stdout(`Runtime install directory: ${runtime.installDir}`);

  if (runtime.status === "ready") {
    context.stdout(`Runtime release: ${runtime.repository}@${runtime.tag}`);
    context.stdout(`Runtime version: ${runtime.version}`);
    context.stdout(`Runtime source commit: ${runtime.sourceCommit ?? "unavailable for legacy v0.1.5"}`);
  } else {
    context.stdout("Runtime next step: run `msiren install --web`.");
  }

  context.stdout("Secrets returned: false");
  return runtime.status === "invalid" ? 1 : 0;
}

async function selectedSurfacesFromPromptOrDefault(context: CliExecutionContext): Promise<readonly InstallSurface[]> {
  if (!context.interactive || context.stdin === undefined || context.output === undefined) {
    return DEFAULT_INSTALL_SURFACES;
  }

  return promptForInstallSurfaces({
    stdin: context.stdin,
    output: context.output,
  });
}

function parseInstallArgs(args: readonly string[]): ParsedInstallArgs | null {
  if (args.length === 0) {
    return {
      allowUnsignedHud: false,
      profileOnly: false,
    };
  }

  if (args.length === 1) {
    const selected = parseInstallSurfaceSelection(args[0] ?? "");

    if (selected !== null) {
      return {
        allowUnsignedHud: false,
        profileOnly: false,
        selectedSurfaces: selected,
      };
    }
  }

  let explicitIncludes = false;
  let allowUnsignedHud = false;
  let installDir: string | undefined;
  let profileOnly = false;
  let releaseRepository: string | undefined;
  let releaseTag: string | undefined;
  const selected = new Set<InstallSurface>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      return null;
    }

    if (arg === "--profile-only") {
      profileOnly = true;
      continue;
    }

    if (arg === "--allow-unsigned-hud") {
      allowUnsignedHud = true;
      continue;
    }

    if (arg === "--tag" || arg === "--repo" || arg === "--dir") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return null;
      }

      if (arg === "--tag") {
        releaseTag = value;
      } else if (arg === "--repo") {
        releaseRepository = value;
      } else {
        installDir = value;
      }

      index += 1;
      continue;
    }

    if (arg.startsWith("--tag=")) {
      releaseTag = arg.slice("--tag=".length);
      continue;
    }

    if (arg.startsWith("--repo=")) {
      releaseRepository = arg.slice("--repo=".length);
      continue;
    }

    if (arg.startsWith("--dir=")) {
      installDir = arg.slice("--dir=".length);
      continue;
    }

    if (arg === "--all") {
      for (const surface of DEFAULT_INSTALL_SURFACES) {
        selected.add(surface);
      }
      explicitIncludes = true;
      continue;
    }

    if (arg.startsWith("--no-")) {
      const surface = arg.slice("--no-".length);

      if (!isInstallSurface(surface)) {
        return null;
      }

      if (!explicitIncludes) {
        for (const defaultSurface of DEFAULT_INSTALL_SURFACES) {
          selected.add(defaultSurface);
        }
        explicitIncludes = true;
      }

      selected.delete(surface);
      continue;
    }

    if (arg.startsWith("--")) {
      const surface = arg.slice("--".length);

      if (!isInstallSurface(surface)) {
        return null;
      }

      selected.add(surface);
      explicitIncludes = true;
      continue;
    }

    if (!isInstallSurface(arg)) {
      return null;
    }

    selected.add(arg);
    explicitIncludes = true;
  }

  const normalized = INSTALL_SURFACES.filter((surface) => selected.has(surface));

  if (normalized.length === 0 && explicitIncludes) {
    return null;
  }

  return {
    allowUnsignedHud,
    ...(installDir === undefined ? {} : { installDir }),
    profileOnly,
    ...(releaseRepository === undefined ? {} : { releaseRepository }),
    ...(releaseTag === undefined ? {} : { releaseTag }),
    ...(normalized.length === 0 ? {} : { selectedSurfaces: normalized }),
  };
}

function isDefaultSelection(selectedSurfaces: readonly InstallSurface[]): boolean {
  return selectedSurfaces.length === INSTALL_SURFACES.length &&
    INSTALL_SURFACES.every((surface, index) => selectedSurfaces[index] === surface);
}

async function installReleaseAssetsForSelection(input: {
  context: CliExecutionContext;
  parsed: ParsedInstallArgs;
  selectedSurfaces: readonly InstallSurface[];
}): Promise<ReleaseInstallResult | "profile-only" | "cli-only"> {
  if (input.parsed.profileOnly) {
    return "profile-only";
  }

  if (!input.selectedSurfaces.some((surface) => surface === "web" || surface === "hud")) {
    return "cli-only";
  }

  return installReleaseAssets({
    env: createReleaseInstallEnv(input.context.env, input.parsed),
    fetchImpl: input.context.fetch,
    ...(input.parsed.installDir === undefined ? {} : { installDir: input.parsed.installDir }),
    now: input.context.now,
    ...(input.parsed.releaseRepository === undefined ? {} : { repository: input.parsed.releaseRepository }),
    selectedSurfaces: input.selectedSurfaces,
    ...(input.parsed.releaseTag === undefined ? {} : { tag: input.parsed.releaseTag }),
  });
}

function createReleaseInstallEnv(
  env: Record<string, string | undefined>,
  parsed: ParsedInstallArgs,
): Record<string, string | undefined> {
  if (!parsed.allowUnsignedHud) {
    return env;
  }

  return {
    ...env,
    MONEYSIREN_ALLOW_UNSIGNED_HUD: "true",
  };
}

async function installReleaseAssetsForSelectionSafely(input: {
  context: CliExecutionContext;
  parsed: ParsedInstallArgs;
  selectedSurfaces: readonly InstallSurface[];
}): Promise<ReleaseInstallResult | "profile-only" | "cli-only" | "failed"> {
  try {
    return await installReleaseAssetsForSelection(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    input.context.stderr(`Release asset installation failed: ${message}`);
    if (input.selectedSurfaces.includes("hud")) {
      input.context.stderr("The selected HUD desktop artifact must be present in the versioned release manifest, integrity-verified, and signed before MoneySiren will install it.");
      input.context.stderr("For now, use `moneysiren install --web` to install only the web runtime, or retry after a signed desktop release is published.");
      input.context.stderr("Temporary local smoke only: rerun `moneysiren install --hud --allow-unsigned-hud` to accept an unsigned HUD artifact explicitly.");
    }
    input.context.stderr("Install profile was not changed.");
    return "failed";
  }
}

function writeReleaseInstallResult(
  context: CliExecutionContext,
  result: ReleaseInstallResult | "profile-only" | "cli-only",
): void {
  if (result === "profile-only") {
    context.stdout("Release assets: skipped (--profile-only).");
    return;
  }

  if (result === "cli-only") {
    context.stdout("Release assets: skipped (CLI-only selection).");
    return;
  }

  writeReleaseInstallSummary(context, result);
}

function writeReleaseInstallSummary(context: CliExecutionContext, result: ReleaseInstallResult): void {
  context.stdout(`Release: ${result.repository}@${result.tag}`);
  context.stdout(`Release URL: ${result.releaseUrl}`);
  context.stdout(`Source commit: ${result.sourceCommit ?? "unavailable for legacy v0.1.5"}`);
  context.stdout(`Install directory: ${result.installDir}`);

  for (const asset of result.assets) {
    context.stdout(`Downloaded ${asset.surface}: ${asset.name}`);
    context.stdout(`  SHA256 verified: ${asset.checksumVerified ? "yes" : "checksum unavailable"}`);
    context.stdout(`  Signature status: ${formatSignatureStatus(asset)}`);
  }
}

function formatSignatureStatus(asset: ReleaseInstallResult["assets"][number]): string {
  if (asset.signatureVerified) {
    return "verified";
  }

  if (asset.signatureStatus === "unsigned-prerelease-accepted") {
    return "unsigned prerelease accepted";
  }

  if (asset.signatureStatus === "unsigned-opt-in-accepted") {
    return "unsigned local smoke opt-in accepted";
  }

  if (asset.signatureStatus === "signed-notarized-manifest") {
    return "signed and notarized in release manifest";
  }

  return asset.signingState === "not-required" ? "not required" : asset.signatureStatus;
}
