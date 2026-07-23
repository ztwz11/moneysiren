const providerIconAssets: Record<string, string> = {
  aws: "aws.svg",
  openai: "openai.svg",
  supabase: "supabase.svg",
  cloudflare: "cloudflare.svg",
  gcp: "gcp.svg",
  azure: "azure.svg",
  oracle: "oracle-cloud.svg",
  anthropic: "anthropic-claude.svg",
  gemini: "google-gemini-vertex-ai.svg",
  vercel: "vercel.svg",
  "github-actions": "github-actions.svg",
  railway: "railway.svg",
  fly: "fly-io.svg",
  netlify: "netlify.svg",
  render: "render.svg",
  neon: "neon.svg",
  "mongodb-atlas": "mongodb-atlas.svg",
  datadog: "datadog.svg",
  sentry: "sentry.svg",
  "codex-cli": "openai.svg",
  "codex-app": "openai.svg",
  "claude-cli": "anthropic-claude.svg",
  "claude-app": "anthropic-claude.svg",
  antigravity: "google-gemini-vertex-ai.svg",
};

export function ProviderIcon({
  providerKey,
  className,
}: {
  providerKey: string;
  className: string;
}) {
  const filename = providerIconAssets[providerKey];

  return (
    <span aria-hidden="true" className={className}>
      {filename === undefined ? (
        <Cloud aria-hidden="true" className="provider-icon-fallback" strokeWidth={1.8} />
      ) : (
        <img alt="" draggable={false} src={`/provider-icons/${filename}`} />
      )}
    </span>
  );
}
import { Cloud } from "lucide-react";
