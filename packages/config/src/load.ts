import {
  DEFAULT_DB_PATH,
  PROVIDER_ENV_KEYS,
  type ConfiguredProvider,
  type ProviderConfig,
  type ProviderConfigMap,
  type StackSpendConfig,
  type StackSpendEnv,
} from "./schema.js";

const TELEMETRY_OPT_IN_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

export function loadStackSpendConfig(env: StackSpendEnv = process.env): StackSpendConfig {
  const dbPath = loadDbPath(env);
  const telemetryEnabled = loadTelemetryFlag(env);

  return {
    dbPath,
    telemetryEnabled,
    providers: loadProviders(env),
    slack: {
      webhookConfigured: isConfigured(env.SLACK_WEBHOOK_URL),
      requiredEnvKey: "SLACK_WEBHOOK_URL",
    },
  };
}

function loadDbPath(env: StackSpendEnv): string {
  const rawPath = env.STACKSPEND_DB_PATH;

  if (rawPath === undefined) {
    return DEFAULT_DB_PATH;
  }

  const trimmedPath = rawPath.trim();

  if (trimmedPath.length === 0) {
    throw new Error("STACKSPEND_DB_PATH must not be blank.");
  }

  return trimmedPath;
}

function loadTelemetryFlag(env: StackSpendEnv): false {
  const rawTelemetry = env.STACKSPEND_TELEMETRY;

  if (rawTelemetry === undefined || rawTelemetry.trim().length === 0) {
    return false;
  }

  const normalizedTelemetry = rawTelemetry.trim().toLowerCase();

  if (TELEMETRY_OPT_IN_VALUES.has(normalizedTelemetry)) {
    throw new Error("Telemetry is not supported in StackSpend v0.1.");
  }

  return false;
}

function loadProviders(env: StackSpendEnv): ProviderConfigMap {
  return {
    aws: loadProviderConfig("aws", env),
    openai: loadProviderConfig("openai", env),
    supabase: loadProviderConfig("supabase", env),
    cloudflare: loadProviderConfig("cloudflare", env),
    gcp: loadProviderConfig("gcp", env),
    azure: loadProviderConfig("azure", env),
    oracle: loadProviderConfig("oracle", env),
    anthropic: loadProviderConfig("anthropic", env),
    gemini: loadProviderConfig("gemini", env),
    vercel: loadProviderConfig("vercel", env),
    "github-actions": loadProviderConfig("github-actions", env),
    railway: loadProviderConfig("railway", env),
    fly: loadProviderConfig("fly", env),
    netlify: loadProviderConfig("netlify", env),
    render: loadProviderConfig("render", env),
    neon: loadProviderConfig("neon", env),
    "mongodb-atlas": loadProviderConfig("mongodb-atlas", env),
    datadog: loadProviderConfig("datadog", env),
    sentry: loadProviderConfig("sentry", env),
  };
}

function loadProviderConfig(provider: ConfiguredProvider, env: StackSpendEnv): ProviderConfig {
  const requiredEnvKeys = PROVIDER_ENV_KEYS[provider];
  const configuredEnvKeys = requiredEnvKeys.filter((envKey) => isConfigured(env[envKey]));
  const missingEnvKeys = requiredEnvKeys.filter((envKey) => !isConfigured(env[envKey]));

  return {
    configured: missingEnvKeys.length === 0,
    requiredEnvKeys,
    configuredEnvKeys,
    missingEnvKeys,
  };
}

function isConfigured(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}
