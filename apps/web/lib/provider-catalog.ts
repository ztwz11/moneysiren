export const PROVIDER_KEYS = [
  "aws",
  "openai",
  "supabase",
  "cloudflare",
  "gcp",
  "azure",
  "oracle",
  "anthropic",
  "gemini",
  "vercel",
  "github-actions",
  "railway",
  "fly",
  "netlify",
  "render",
  "neon",
  "mongodb-atlas",
  "datadog",
  "sentry",
  "codex-cli",
  "claude-cli",
] as const;

export const LIVE_PROVIDER_KEYS = ["aws", "openai", "supabase", "cloudflare"] as const;
export const AVAILABLE_PROVIDER_KEYS = LIVE_PROVIDER_KEYS;
export const LOCAL_PROVIDER_KEYS = ["codex-cli", "claude-cli"] as const;
export const CONNECTABLE_PROVIDER_KEYS = [
  ...AVAILABLE_PROVIDER_KEYS,
  ...LOCAL_PROVIDER_KEYS,
] as const satisfies readonly ProviderKey[];

export type ProviderKey = (typeof PROVIDER_KEYS)[number];
export type LiveProviderKey = (typeof LIVE_PROVIDER_KEYS)[number];
export type ProviderCatalogStatus = "available" | "planned" | "research";
export type ProviderCategory = "Cloud" | "AI" | "Database" | "Hosting" | "Observability";
export type LiveGranularity =
  | "exact_today"
  | "daily_bucket"
  | "month_to_date"
  | "current_period"
  | "usage_only"
  | "unavailable";

export interface ProviderCatalogItem {
  key: ProviderKey;
  name: string;
  category: ProviderCategory;
  status: ProviderCatalogStatus;
  authMethods: readonly string[];
  dataSurfaces: readonly string[];
  liveGranularity: LiveGranularity;
  requiredEnvKeys: readonly string[];
  credentialRequirements: readonly string[];
  setupLinks: readonly ProviderSetupLink[];
  liveProviderKey?: LiveProviderKey;
}

export interface ProviderSetupLink {
  label: string;
  href: string;
  description: string;
  valueHints: readonly string[];
}

export const providerCatalog: readonly ProviderCatalogItem[] = [
  {
    key: "aws",
    name: "AWS",
    category: "Cloud",
    status: "available",
    authMethods: ["AWS profile", "IAM Identity Center"],
    dataSurfaces: ["cost", "usage", "forecast", "health"],
    liveGranularity: "current_period",
    requiredEnvKeys: ["AWS_PROFILE"],
    credentialRequirements: ["AWS_PROFILE or SDK default credential chain outside StackSpend"],
    setupLinks: [
      {
        label: "Install AWS CLI",
        href: "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html",
        description: "Install AWS CLI v2 before creating a local profile or IAM Identity Center login.",
        valueHints: ["aws --version", "Windows MSI", "AWS CLI v2"],
      },
      {
        label: "AWS Cost Management console",
        href: "https://console.aws.amazon.com/costmanagement/home#/cost-explorer",
        description: "Open Cost Explorer and confirm Cost Management access for the local AWS profile.",
        valueHints: ["AWS_PROFILE", "ce:GetCostAndUsage", "ce:GetCostForecast"],
      },
      {
        label: "AWS IAM Identity Center SSO",
        href: "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html",
        description: "Create a local SSO profile that StackSpend can read through AWS_PROFILE.",
        valueHints: ["aws configure sso", "aws sso login", "AWS_PROFILE"],
      },
      {
        label: "AWS CLI profiles",
        href: "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html",
        description: "Find or create the AWS_PROFILE used by the local SDK credential chain.",
        valueHints: ["AWS_PROFILE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
      },
      {
        label: "Cost Explorer API access",
        href: "https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-explorer-access.html",
        description: "Confirm the read-only Cost Explorer permissions required for cost and usage queries.",
        valueHints: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
      },
    ],
    liveProviderKey: "aws",
  },
  {
    key: "openai",
    name: "OpenAI",
    category: "AI",
    status: "available",
    authMethods: ["Admin API key"],
    dataSurfaces: ["cost", "usage", "forecast"],
    liveGranularity: "daily_bucket",
    requiredEnvKeys: ["OPENAI_ADMIN_KEY"],
    credentialRequirements: ["OpenAI organization Admin API key"],
    setupLinks: [
      {
        label: "Admin API keys",
        href: "https://platform.openai.com/settings/organization/admin-keys",
        description: "Create or manage an organization Admin API key for usage and costs reads.",
        valueHints: ["OPENAI_ADMIN_KEY"],
      },
      {
        label: "Usage and costs API",
        href: "https://platform.openai.com/docs/api-reference/usage/cost",
        description: "Verify the Usage API and Costs endpoint surfaces used for current LLM usage.",
        valueHints: ["organization usage", "organization costs"],
      },
      {
        label: "Admin API key docs",
        href: "https://platform.openai.com/docs/api-reference/admin-api-keys",
        description: "Review Admin API key requirements before saving a local read-only credential.",
        valueHints: ["organization admin key"],
      },
    ],
    liveProviderKey: "openai",
  },
  {
    key: "supabase",
    name: "Supabase",
    category: "Database",
    status: "available",
    authMethods: ["OAuth2", "PAT"],
    dataSurfaces: ["usage", "health"],
    liveGranularity: "usage_only",
    requiredEnvKeys: ["SUPABASE_ACCESS_TOKEN"],
    credentialRequirements: ["Supabase OAuth2 connection or personal access token"],
    setupLinks: [
      {
        label: "Access tokens",
        href: "https://supabase.com/dashboard/account/tokens",
        description: "Create or review a Supabase access token for Management API reads.",
        valueHints: ["SUPABASE_ACCESS_TOKEN"],
      },
      {
        label: "Management API",
        href: "https://supabase.com/docs/reference/api/management",
        description: "Confirm Management API token behavior before using it locally.",
        valueHints: ["personal access token", "projects:read"],
      },
      {
        label: "OAuth scopes",
        href: "https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes",
        description: "Confirm OAuth scopes before using the local OAuth broker flow.",
        valueHints: ["projects:read", "analytics_usage_read"],
      },
    ],
    liveProviderKey: "supabase",
  },
  {
    key: "cloudflare",
    name: "Cloudflare",
    category: "Cloud",
    status: "available",
    authMethods: ["API token"],
    dataSurfaces: ["cost", "usage", "health"],
    liveGranularity: "month_to_date",
    requiredEnvKeys: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_IDS"],
    credentialRequirements: ["Cloudflare API token", "Cloudflare account IDs"],
    setupLinks: [
      {
        label: "API tokens",
        href: "https://dash.cloudflare.com/profile/api-tokens",
        description: "Create or manage a Cloudflare API token with billing read permissions.",
        valueHints: ["CLOUDFLARE_API_TOKEN"],
      },
      {
        label: "Billing API permissions",
        href: "https://developers.cloudflare.com/billing/understand/billing-permissions/",
        description: "Create an API token with Account Billing Read access.",
        valueHints: ["Account Billing Read"],
      },
      {
        label: "Billing usage API",
        href: "https://developers.cloudflare.com/api/resources/organizations/subresources/billing",
        description: "Confirm the billing usage API surface and account or organization identifiers.",
        valueHints: ["CLOUDFLARE_ACCOUNT_IDS"],
      },
    ],
    liveProviderKey: "cloudflare",
  },
  {
    key: "gcp",
    name: "GCP",
    category: "Cloud",
    status: "planned",
    authMethods: ["Google Cloud CLI", "Application Default Credentials", "Service account"],
    dataSurfaces: ["cost", "usage", "forecast"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"],
    credentialRequirements: ["Google Cloud CLI auth plus Application Default Credentials or service account key"],
    setupLinks: [
      {
        label: "Install Google Cloud CLI",
        href: "https://docs.cloud.google.com/sdk/docs/install",
        description: "Install gcloud before configuring local Google Cloud auth.",
        valueHints: ["gcloud --version", "gcloud init"],
      },
      {
        label: "Authenticate gcloud CLI",
        href: "https://docs.cloud.google.com/docs/authentication/gcloud",
        description: "Sign in to Google Cloud CLI and select the local project.",
        valueHints: ["gcloud auth login", "gcloud config set project"],
      },
      {
        label: "Application Default Credentials",
        href: "https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/login",
        description: "Create local ADC credentials for Google SDK reads without storing keys in StackSpend.",
        valueHints: ["gcloud auth application-default login", "application_default_credentials.json"],
      },
      {
        label: "Service accounts",
        href: "https://console.cloud.google.com/iam-admin/serviceaccounts",
        description: "Create or manage the service account used by local Google Cloud credentials.",
        valueHints: ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"],
      },
      {
        label: "Service account keys",
        href: "https://docs.cloud.google.com/iam/docs/keys-create-delete",
        description: "Review service account key creation and rotation guidance.",
        valueHints: ["JSON key file", "least privilege"],
      },
    ],
  },
  {
    key: "azure",
    name: "Azure",
    category: "Cloud",
    status: "planned",
    authMethods: ["Azure CLI", "Service principal"],
    dataSurfaces: ["cost", "usage"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_SUBSCRIPTION_ID"],
    credentialRequirements: ["Microsoft Entra app registration or Azure CLI login"],
    setupLinks: [
      {
        label: "App registrations",
        href: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
        description: "Create or manage the service principal used for local Azure reads.",
        valueHints: ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"],
      },
      {
        label: "Add credentials",
        href: "https://learn.microsoft.com/en-my/entra/identity-platform/how-to-add-credentials?tabs=client-secret",
        description: "Create a client secret for the service principal.",
        valueHints: ["client secret"],
      },
      {
        label: "Cost Management permissions",
        href: "https://learn.microsoft.com/en-us/azure/cost-management-billing/automate/cost-management-api-permissions",
        description: "Review read permissions for Cost Management APIs.",
        valueHints: ["Cost Management Reader", "AZURE_SUBSCRIPTION_ID"],
      },
    ],
  },
  {
    key: "oracle",
    name: "Oracle Cloud",
    category: "Cloud",
    status: "planned",
    authMethods: ["OCI profile"],
    dataSurfaces: ["cost", "usage"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["OCI_CONFIG_FILE", "OCI_PROFILE"],
    credentialRequirements: ["OCI config profile with an API signing key"],
    setupLinks: [
      {
        label: "OCI Console",
        href: "https://cloud.oracle.com/",
        description: "Open the OCI Console and manage API keys from the signed-in user's profile.",
        valueHints: ["OCI_CONFIG_FILE", "OCI_PROFILE"],
      },
      {
        label: "API signing key",
        href: "https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm",
        description: "Create or upload the API signing key used by the OCI config profile.",
        valueHints: ["tenancy OCID", "user OCID", "fingerprint", "private key path"],
      },
      {
        label: "Manage credentials",
        href: "https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managingcredentials.htm",
        description: "Review OCI user credential management before connecting.",
        valueHints: ["API keys", "auth tokens"],
      },
    ],
  },
  {
    key: "anthropic",
    name: "Anthropic Claude",
    category: "AI",
    status: "planned",
    authMethods: ["Admin API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["ANTHROPIC_ADMIN_KEY"],
    credentialRequirements: ["Anthropic Console API key with usage reporting access"],
    setupLinks: [
      {
        label: "API keys",
        href: "https://console.anthropic.com/settings/keys",
        description: "Create or manage an Anthropic Console API key.",
        valueHints: ["ANTHROPIC_ADMIN_KEY", "ANTHROPIC_API_KEY"],
      },
      {
        label: "API access help",
        href: "https://support.anthropic.com/en/articles/8114521-how-can-i-access-the-anthropic-api",
        description: "Review Anthropic API access and Console requirements.",
        valueHints: ["Console API key"],
      },
      {
        label: "Usage report API",
        href: "https://platform.claude.com/docs/en/api/admin/usage_report/retrieve_messages",
        description: "Planned integration target for Claude message usage reporting.",
        valueHints: ["usage report", "messages"],
      },
    ],
  },
  {
    key: "gemini",
    name: "Google Gemini / Vertex AI",
    category: "AI",
    status: "research",
    authMethods: ["Google auth", "API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["GEMINI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"],
    credentialRequirements: ["Google AI Studio API key or Vertex AI service account"],
    setupLinks: [
      {
        label: "Google AI Studio API keys",
        href: "https://aistudio.google.com/apikey",
        description: "Create or manage Gemini API keys for Google AI Studio usage.",
        valueHints: ["GEMINI_API_KEY"],
      },
      {
        label: "Gemini API key docs",
        href: "https://ai.google.dev/gemini-api/docs/api-key",
        description: "Review Gemini API key setup before local usage tracking.",
        valueHints: ["API key"],
      },
      {
        label: "Gemini billing",
        href: "https://ai.google.dev/gemini-api/docs/billing",
        description: "Research target for Gemini usage and Cloud Billing visibility.",
        valueHints: ["Google Cloud project", "billing account"],
      },
    ],
  },
  {
    key: "vercel",
    name: "Vercel",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["VERCEL_API_TOKEN"],
    credentialRequirements: ["Vercel account API token"],
    setupLinks: [
      {
        label: "Account tokens",
        href: "https://vercel.com/account/settings/tokens",
        description: "Create or manage a Vercel API access token.",
        valueHints: ["VERCEL_API_TOKEN"],
      },
      {
        label: "API access token guide",
        href: "https://vercel.com/guides/how-do-i-use-a-vercel-api-access-token",
        description: "Review Vercel token creation and usage guidance.",
        valueHints: ["Bearer token"],
      },
    ],
  },
  {
    key: "github-actions",
    name: "GitHub Actions",
    category: "Hosting",
    status: "planned",
    authMethods: ["GitHub token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["GITHUB_TOKEN"],
    credentialRequirements: ["Fine-grained or classic GitHub token with Actions billing reads"],
    setupLinks: [
      {
        label: "Fine-grained token",
        href: "https://github.com/settings/personal-access-tokens/new",
        description: "Create a fine-grained personal access token for GitHub API reads.",
        valueHints: ["GITHUB_TOKEN"],
      },
      {
        label: "Manage personal access tokens",
        href: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
        description: "Review GitHub PAT creation, scopes, and expiration guidance.",
        valueHints: ["Actions billing", "read-only scopes"],
      },
    ],
  },
  {
    key: "railway",
    name: "Railway",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["RAILWAY_API_TOKEN"],
    credentialRequirements: ["Railway account API token"],
    setupLinks: [
      {
        label: "Account tokens",
        href: "https://railway.com/account/tokens",
        description: "Create or manage Railway account tokens.",
        valueHints: ["RAILWAY_API_TOKEN"],
      },
      {
        label: "CLI token docs",
        href: "https://docs.railway.com/cli/login",
        description: "Review Railway token usage through the CLI and API.",
        valueHints: ["RAILWAY_API_TOKEN"],
      },
    ],
  },
  {
    key: "fly",
    name: "Fly.io",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["FLY_ACCESS_TOKEN"],
    credentialRequirements: ["Fly.io access token"],
    setupLinks: [
      {
        label: "Personal access tokens",
        href: "https://fly.io/user/personal_access_tokens",
        description: "Create or manage Fly.io personal access tokens.",
        valueHints: ["FLY_ACCESS_TOKEN"],
      },
      {
        label: "flyctl tokens",
        href: "https://fly.io/docs/flyctl/tokens/",
        description: "Review Fly.io token creation and environment variable usage.",
        valueHints: ["FLY_ACCESS_TOKEN"],
      },
    ],
  },
  {
    key: "netlify",
    name: "Netlify",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["NETLIFY_AUTH_TOKEN"],
    credentialRequirements: ["Netlify personal access token"],
    setupLinks: [
      {
        label: "Personal access tokens",
        href: "https://app.netlify.com/user/applications#personal-access-tokens",
        description: "Create or manage a Netlify personal access token.",
        valueHints: ["NETLIFY_AUTH_TOKEN"],
      },
      {
        label: "Netlify API guide",
        href: "https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/",
        description: "Review Netlify API authentication guidance.",
        valueHints: ["Bearer token"],
      },
    ],
  },
  {
    key: "render",
    name: "Render",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["RENDER_API_KEY"],
    credentialRequirements: ["Render API key"],
    setupLinks: [
      {
        label: "API keys",
        href: "https://dashboard.render.com/u/settings#api-keys",
        description: "Create or manage Render API keys from account settings.",
        valueHints: ["RENDER_API_KEY"],
      },
      {
        label: "Render API docs",
        href: "https://render.com/api",
        description: "Review Render API authentication before local usage tracking.",
        valueHints: ["Bearer token"],
      },
    ],
  },
  {
    key: "neon",
    name: "Neon",
    category: "Database",
    status: "planned",
    authMethods: ["API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["NEON_API_KEY"],
    credentialRequirements: ["Neon API key"],
    setupLinks: [
      {
        label: "API keys",
        href: "https://console.neon.tech/app/settings/api-keys",
        description: "Create or manage Neon API keys.",
        valueHints: ["NEON_API_KEY"],
      },
      {
        label: "Neon API key docs",
        href: "https://api-docs.neon.tech/reference/listapikeys",
        description: "Review Neon API key management before local usage tracking.",
        valueHints: ["API key"],
      },
    ],
  },
  {
    key: "mongodb-atlas",
    name: "MongoDB Atlas",
    category: "Database",
    status: "planned",
    authMethods: ["API key"],
    dataSurfaces: ["usage", "cost", "health"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["MONGODB_ATLAS_PUBLIC_KEY", "MONGODB_ATLAS_PRIVATE_KEY", "MONGODB_ATLAS_ORG_ID"],
    credentialRequirements: ["MongoDB Atlas organization API key pair"],
    setupLinks: [
      {
        label: "API access",
        href: "https://cloud.mongodb.com/v2#/account/publicApi",
        description: "Create or manage MongoDB Atlas programmatic API keys.",
        valueHints: ["MONGODB_ATLAS_PUBLIC_KEY", "MONGODB_ATLAS_PRIVATE_KEY"],
      },
      {
        label: "Configure API access",
        href: "https://www.mongodb.com/docs/atlas/configure-api-access/?interface=atlas-cli&programmatic-access=api-key",
        description: "Review Atlas organization API key setup and access list requirements.",
        valueHints: ["organization ID", "API access list"],
      },
    ],
  },
  {
    key: "datadog",
    name: "Datadog",
    category: "Observability",
    status: "planned",
    authMethods: ["API key", "Application key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["DATADOG_API_KEY", "DATADOG_APP_KEY", "DATADOG_SITE"],
    credentialRequirements: ["Datadog API key and application key"],
    setupLinks: [
      {
        label: "API keys",
        href: "https://app.datadoghq.com/organization-settings/api-keys",
        description: "Create or manage Datadog API keys and application keys.",
        valueHints: ["DATADOG_API_KEY", "DATADOG_APP_KEY"],
      },
      {
        label: "API and app key docs",
        href: "https://docs.datadoghq.com/account_management/api-app-keys/",
        description: "Review Datadog API key and application key management.",
        valueHints: ["DATADOG_SITE", "application key"],
      },
    ],
  },
  {
    key: "sentry",
    name: "Sentry",
    category: "Observability",
    status: "planned",
    authMethods: ["Auth token"],
    dataSurfaces: ["usage"],
    liveGranularity: "unavailable",
    requiredEnvKeys: ["SENTRY_AUTH_TOKEN", "SENTRY_ORG"],
    credentialRequirements: ["Sentry user auth token with organization read access"],
    setupLinks: [
      {
        label: "Auth tokens",
        href: "https://sentry.io/settings/account/api/auth-tokens/",
        description: "Create or manage Sentry user auth tokens.",
        valueHints: ["SENTRY_AUTH_TOKEN"],
      },
      {
        label: "Sentry API auth",
        href: "https://docs.sentry.io/hosted/api/auth/",
        description: "Review Sentry API token usage and scopes.",
        valueHints: ["org:read", "project:read"],
      },
    ],
  },
  {
    key: "codex-cli",
    name: "Codex CLI",
    category: "AI",
    status: "available",
    authMethods: ["Local CLI"],
    dataSurfaces: ["usage", "health"],
    liveGranularity: "usage_only",
    requiredEnvKeys: [],
    credentialRequirements: ["Local codex command, STACKSPEND_CODEX_SESSIONS_DIR, CODEX_HOME, or Codex session logs"],
    setupLinks: [
      {
        label: "Codex CLI command",
        href: "https://help.openai.com/en/articles/11096431",
        description: "Install or inspect the local Codex CLI used for local usage estimates.",
        valueHints: ["codex --version", "STACKSPEND_CODEX_SESSIONS_DIR", "CODEX_HOME", ".codex/sessions"],
      },
    ],
  },
  {
    key: "claude-cli",
    name: "Claude CLI",
    category: "AI",
    status: "available",
    authMethods: ["Local CLI"],
    dataSurfaces: ["usage", "health"],
    liveGranularity: "usage_only",
    requiredEnvKeys: [],
    credentialRequirements: ["Local claude command, CLAUDE_CONFIG_DIR, or Claude Code project logs"],
    setupLinks: [
      {
        label: "Claude CLI command",
        href: "https://docs.anthropic.com/en/docs/claude-code/cli-usage",
        description: "Install or inspect the local Claude CLI used for local usage estimates.",
        valueHints: ["claude --version", "CLAUDE_CONFIG_DIR", ".claude/projects"],
      },
    ],
  },
];

export function findAvailableProvider(key: string): ProviderCatalogItem | undefined {
  return providerCatalog.find((provider) => provider.key === key || provider.liveProviderKey === key);
}

export function isProviderKey(value: string): value is ProviderKey {
  return (PROVIDER_KEYS as readonly string[]).includes(value);
}

export function isLiveProviderKey(value: string): value is LiveProviderKey {
  return (LIVE_PROVIDER_KEYS as readonly string[]).includes(value);
}

export function isConnectableProviderKey(value: string): value is (typeof CONNECTABLE_PROVIDER_KEYS)[number] {
  return (CONNECTABLE_PROVIDER_KEYS as readonly string[]).includes(value);
}
