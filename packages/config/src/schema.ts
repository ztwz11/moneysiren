export const DEFAULT_DB_PATH = ".stackspend/stackspend.sqlite";

export const PROVIDER_ENV_KEYS = {
  aws: ["AWS_PROFILE"],
  openai: ["OPENAI_ADMIN_KEY"],
  supabase: ["SUPABASE_ACCESS_TOKEN"],
  cloudflare: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_IDS"],
  gcp: ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"],
  azure: ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_SUBSCRIPTION_ID"],
  oracle: ["OCI_CONFIG_FILE", "OCI_PROFILE"],
  anthropic: ["ANTHROPIC_ADMIN_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"],
  vercel: ["VERCEL_API_TOKEN"],
  "github-actions": ["GITHUB_TOKEN"],
  railway: ["RAILWAY_API_TOKEN"],
  fly: ["FLY_ACCESS_TOKEN"],
  netlify: ["NETLIFY_AUTH_TOKEN"],
  render: ["RENDER_API_KEY"],
  neon: ["NEON_API_KEY"],
  "mongodb-atlas": ["MONGODB_ATLAS_PUBLIC_KEY", "MONGODB_ATLAS_PRIVATE_KEY", "MONGODB_ATLAS_ORG_ID"],
  datadog: ["DATADOG_API_KEY", "DATADOG_APP_KEY", "DATADOG_SITE"],
  sentry: ["SENTRY_AUTH_TOKEN", "SENTRY_ORG"],
  "codex-cli": [],
  "claude-cli": [],
} as const;

export type ConfiguredProvider = keyof typeof PROVIDER_ENV_KEYS;

export interface ProviderConfig {
  configured: boolean;
  requiredEnvKeys: readonly string[];
  configuredEnvKeys: readonly string[];
  missingEnvKeys: readonly string[];
}

export type ProviderConfigMap = {
  readonly [Provider in ConfiguredProvider]: ProviderConfig;
};

export interface SlackConfig {
  webhookConfigured: boolean;
  requiredEnvKey: "SLACK_WEBHOOK_URL";
}

export interface StackSpendConfig {
  dbPath: string;
  telemetryEnabled: false;
  providers: ProviderConfigMap;
  slack: SlackConfig;
}

export type StackSpendEnv = Record<string, string | undefined>;
