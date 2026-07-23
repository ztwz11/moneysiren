export interface ProviderIconAsset {
  filename: string;
  brandKey: string;
}

const providerIconAssets: Record<string, ProviderIconAsset> = {
  aws: { filename: "aws.svg", brandKey: "aws" },
  openai: { filename: "openai.svg", brandKey: "openai" },
  supabase: { filename: "supabase.svg", brandKey: "supabase" },
  cloudflare: { filename: "cloudflare.svg", brandKey: "cloudflare" },
  gcp: { filename: "gcp.svg", brandKey: "gcp" },
  azure: { filename: "azure.svg", brandKey: "azure" },
  oracle: { filename: "oracle-cloud.svg", brandKey: "oracle" },
  anthropic: { filename: "anthropic-claude.svg", brandKey: "anthropic" },
  gemini: { filename: "google-gemini-vertex-ai.svg", brandKey: "gemini" },
  vercel: { filename: "vercel.svg", brandKey: "vercel" },
  "github-actions": { filename: "github-actions.svg", brandKey: "github-actions" },
  railway: { filename: "railway.svg", brandKey: "railway" },
  fly: { filename: "fly-io.svg", brandKey: "fly" },
  netlify: { filename: "netlify.svg", brandKey: "netlify" },
  render: { filename: "render.svg", brandKey: "render" },
  neon: { filename: "neon.svg", brandKey: "neon" },
  "mongodb-atlas": { filename: "mongodb-atlas.svg", brandKey: "mongodb-atlas" },
  datadog: { filename: "datadog.svg", brandKey: "datadog" },
  sentry: { filename: "sentry.svg", brandKey: "sentry" },
  "codex-cli": { filename: "openai.svg", brandKey: "openai" },
  "codex-app": { filename: "openai.svg", brandKey: "openai" },
  "claude-cli": { filename: "anthropic-claude.svg", brandKey: "anthropic" },
  "claude-app": { filename: "anthropic-claude.svg", brandKey: "anthropic" },
  antigravity: { filename: "google-gemini-vertex-ai.svg", brandKey: "gemini" },
};

export function providerIconAssetFor(providerKey: string): ProviderIconAsset | undefined {
  return providerIconAssets[providerKey];
}
