import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const platform = normalizePlatform(args.platform ?? process.env.RUNNER_OS ?? process.platform);
const outputPath = resolve(args.out ?? `.tmp/tauri-signing-${platform}.json`);

const config = {
  bundle: {},
};

if (platform === "windows") {
  if (envValue("WINDOWS_CERTIFICATE_THUMBPRINT").length === 0) {
    await writeUnsignedConfig("windows");
    process.exit(0);
  }

  requireEnv(["WINDOWS_CERTIFICATE_THUMBPRINT"]);

  const windowsConfig = {
    certificateThumbprint: envValue("WINDOWS_CERTIFICATE_THUMBPRINT").replaceAll(/\s/g, ""),
    digestAlgorithm: envValue("WINDOWS_DIGEST_ALGORITHM") || "sha256",
  };

  const timestampUrl = envValue("WINDOWS_TIMESTAMP_URL") || "http://timestamp.digicert.com";
  if (timestampUrl.length > 0) {
    windowsConfig.timestampUrl = timestampUrl;
  }

  const tsp = envValue("WINDOWS_TSP");
  if (tsp.length > 0) {
    windowsConfig.tsp = parseBoolean(tsp, "WINDOWS_TSP");
  }

  config.bundle.windows = windowsConfig;
} else if (platform === "macos") {
  if ([
    "APPLE_CERTIFICATE",
    "APPLE_CERTIFICATE_PASSWORD",
    "APPLE_ID",
    "APPLE_PASSWORD",
    "APPLE_TEAM_ID",
  ].some((name) => envValue(name).length === 0)) {
    await writeUnsignedConfig("macos");
    process.exit(0);
  }

  requireEnv([
    "APPLE_CERTIFICATE",
    "APPLE_CERTIFICATE_PASSWORD",
    "APPLE_ID",
    "APPLE_PASSWORD",
    "APPLE_TEAM_ID",
  ]);

  const macOSConfig = {
    hardenedRuntime: true,
  };

  const signingIdentity = envValue("APPLE_SIGNING_IDENTITY");
  if (signingIdentity.length > 0) {
    macOSConfig.signingIdentity = signingIdentity;
  }

  const providerShortName = envValue("APPLE_PROVIDER_SHORT_NAME");
  if (providerShortName.length > 0) {
    macOSConfig.providerShortName = providerShortName;
  }

  config.bundle.macOS = macOSConfig;
} else {
  console.error(`Unsupported signing platform: ${platform}`);
  process.exit(1);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Prepared Tauri ${platform} signing config at ${outputPath}`);

async function writeUnsignedConfig(targetPlatform) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Prepared unsigned Tauri ${targetPlatform} local smoke config at ${outputPath}`);
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--platform") {
      parsed.platform = values[index + 1];
      index += 1;
    } else if (value === "--out") {
      parsed.out = values[index + 1];
      index += 1;
    } else {
      console.error(`Unknown argument: ${value}`);
      process.exit(1);
    }
  }

  return parsed;
}

function normalizePlatform(value) {
  const normalized = value.toLowerCase();
  if (normalized === "win32" || normalized === "windows") {
    return "windows";
  }
  if (normalized === "darwin" || normalized === "macos") {
    return "macos";
  }
  return normalized;
}

function requireEnv(names) {
  const missing = names.filter((name) => envValue(name).length === 0);
  if (missing.length > 0) {
    console.error(`Missing required desktop signing environment variable(s): ${missing.join(", ")}`);
    process.exit(1);
  }
}

function envValue(name) {
  return (process.env[name] ?? "").trim();
}

function parseBoolean(value, name) {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  console.error(`${name} must be a boolean-like value.`);
  process.exit(1);
}
