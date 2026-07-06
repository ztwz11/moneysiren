import { redactSensitiveString } from "../../../packages/security/src/index";
import type { EmergencyActionCandidate, EmergencyActionProvider } from "./emergency-actions";

export interface EmergencyOfficialLink {
  label: string;
  href: string;
  description: string;
  surface: string;
}

type EmergencyProviderLinkInput = Pick<EmergencyActionProvider, "providerKey" | "setupLinks">;
type EmergencyCandidateLinkInput = Pick<EmergencyActionCandidate, "actionKey" | "kind" | "providerConsoleHref">;

const OFFICIAL_LINKS_BY_PROVIDER: Readonly<Record<string, readonly EmergencyOfficialLink[]>> = {
  aws: [
    {
      label: "AWS Cost Explorer",
      href: "https://console.aws.amazon.com/costmanagement/home#/cost-explorer",
      description: "Open AWS Cost Explorer to review month-to-date spend, forecasts, and service-level drivers.",
      surface: "cost",
    },
    {
      label: "AWS Budgets",
      href: "https://console.aws.amazon.com/costmanagement/home#/budgets",
      description: "Open AWS Budgets to review configured budget alarms before any manual action.",
      surface: "budget",
    },
    {
      label: "AWS Cost Anomaly Detection",
      href: "https://console.aws.amazon.com/costmanagement/home#/anomaly-detection",
      description: "Open AWS Cost Anomaly Detection to check unusual spend signals.",
      surface: "cost",
    },
    {
      label: "AWS EC2 Instances",
      href: "https://console.aws.amazon.com/ec2/home#Instances:",
      description: "Open the official EC2 instances page for manual review. MoneySiren does not stop instances.",
      surface: "future_write",
    },
  ],
  openai: [
    {
      label: "OpenAI Usage",
      href: "https://platform.openai.com/usage",
      description: "Open the official OpenAI usage dashboard to review usage drivers manually.",
      surface: "usage",
    },
    {
      label: "OpenAI Billing",
      href: "https://platform.openai.com/settings/organization/billing/overview",
      description: "Open OpenAI billing settings to review invoices, payment state, and billing context.",
      surface: "billing",
    },
    {
      label: "OpenAI Admin API Keys",
      href: "https://platform.openai.com/settings/organization/admin-keys",
      description: "Open Admin API key settings for manual credential review. MoneySiren does not revoke keys.",
      surface: "credentials",
    },
    {
      label: "OpenAI Admin API key docs",
      href: "https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/admin_api_keys",
      description: "Review official Admin API key documentation before changing any key-management policy.",
      surface: "docs",
    },
  ],
  supabase: [
    {
      label: "Supabase Projects",
      href: "https://supabase.com/dashboard/projects",
      description: "Open the official Supabase project dashboard for manual project usage and health review.",
      surface: "dashboard",
    },
    {
      label: "Supabase Access Tokens",
      href: "https://supabase.com/dashboard/account/tokens",
      description: "Open Supabase account tokens for manual PAT review. MoneySiren does not regenerate tokens.",
      surface: "credentials",
    },
    {
      label: "Supabase Management API docs",
      href: "https://supabase.com/docs/reference/api/management",
      description: "Review official Management API behavior and read-scope requirements.",
      surface: "docs",
    },
    {
      label: "Supabase OAuth scopes docs",
      href: "https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes",
      description: "Review official OAuth scopes before changing local connection setup.",
      surface: "credentials",
    },
  ],
  cloudflare: [
    {
      label: "Cloudflare Billing",
      href: "https://dash.cloudflare.com/?to=/:account/billing",
      description: "Open the official Cloudflare Billing page for manual spend review.",
      surface: "billing",
    },
    {
      label: "Cloudflare API Tokens",
      href: "https://dash.cloudflare.com/profile/api-tokens",
      description: "Open Cloudflare API tokens for manual permission review. MoneySiren does not rotate tokens.",
      surface: "credentials",
    },
    {
      label: "Cloudflare Workers & Pages",
      href: "https://dash.cloudflare.com/?to=/:account/workers-and-pages",
      description: "Open Workers & Pages for manual service review. MoneySiren does not disable workers.",
      surface: "future_write",
    },
    {
      label: "Cloudflare Analytics",
      href: "https://dash.cloudflare.com/?to=/:account/analytics",
      description: "Open Cloudflare analytics to review usage trends manually.",
      surface: "usage",
    },
    {
      label: "Cloudflare API token docs",
      href: "https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
      description: "Review official API token creation and permission guidance.",
      surface: "docs",
    },
  ],
  "codex-cli": [
    {
      label: "OpenAI Codex docs",
      href: "https://developers.openai.com/codex",
      description: "Open official Codex documentation for local CLI and app behavior. MoneySiren does not expose prompts or auth files.",
      surface: "docs",
    },
    {
      label: "ChatGPT Codex",
      href: "https://chatgpt.com/codex",
      description: "Open ChatGPT Codex for manual review of Codex sessions and account state.",
      surface: "dashboard",
    },
  ],
  "codex-app": [
    {
      label: "OpenAI Codex docs",
      href: "https://developers.openai.com/codex",
      description: "Open official Codex documentation for local CLI and app behavior. MoneySiren does not expose prompts or auth files.",
      surface: "docs",
    },
    {
      label: "ChatGPT Codex",
      href: "https://chatgpt.com/codex",
      description: "Open ChatGPT Codex for manual review of Codex sessions and account state.",
      surface: "dashboard",
    },
  ],
  "claude-cli": [
    {
      label: "Claude Code docs",
      href: "https://code.claude.com/docs/en/overview",
      description: "Open official Claude Code documentation. MoneySiren only displays sanitized local usage metadata.",
      surface: "docs",
    },
    {
      label: "Claude Code web",
      href: "https://claude.ai/code",
      description: "Open Claude Code on the web for manual review of account and session state.",
      surface: "dashboard",
    },
  ],
  "claude-app": [
    {
      label: "Claude Code docs",
      href: "https://code.claude.com/docs/en/overview",
      description: "Open official Claude Code documentation. MoneySiren only displays sanitized local usage metadata.",
      surface: "docs",
    },
    {
      label: "Claude Code web",
      href: "https://claude.ai/code",
      description: "Open Claude Code on the web for manual review of account and session state.",
      surface: "dashboard",
    },
  ],
  antigravity: [
    {
      label: "Google Antigravity",
      href: "https://antigravity.google/",
      description: "Open the official Google Antigravity site for manual account and product review.",
      surface: "dashboard",
    },
  ],
};

const ACTION_SURFACES: Readonly<Record<string, readonly string[]>> = {
  manual_runbook: ["cost", "usage", "billing", "budget", "dashboard", "docs", "credentials"],
  credential_recovery: ["credentials", "docs", "dashboard"],
  sync_recovery: ["cost", "usage", "billing", "dashboard", "docs", "credentials"],
  provider_console: ["cost", "usage", "billing", "dashboard", "budget", "credentials", "docs"],
  notification_escalate: ["cost", "usage", "billing", "dashboard", "budget"],
  future_write_requirements: ["future_write", "credentials", "docs", "dashboard"],
};

export function officialLinksForEmergencyCandidate(
  provider: EmergencyProviderLinkInput,
  candidate: EmergencyCandidateLinkInput,
): EmergencyOfficialLink[] {
  const staticLinks = OFFICIAL_LINKS_BY_PROVIDER[provider.providerKey] ?? [];
  const setupLinks = (provider.setupLinks ?? []).flatMap((link) => {
    const sanitized = safeOfficialLink({
      label: link.label,
      href: link.href,
      description: link.description ?? "Open the provider's official setup or documentation page.",
      surface: "docs",
    });

    return sanitized === null ? [] : [sanitized];
  });
  const candidateLink = candidate.providerConsoleHref === undefined
    ? []
    : [safeOfficialLink({
        label: "Provider console",
        href: candidate.providerConsoleHref,
        description: "Open the provider's official console in a new browser tab.",
        surface: "dashboard",
      })].filter((link): link is EmergencyOfficialLink => link !== null);
  const allowedSurfaces = new Set(ACTION_SURFACES[candidate.actionKey] ?? ACTION_SURFACES[candidate.kind] ?? ["dashboard", "docs"]);
  const links = [...candidateLink, ...staticLinks, ...setupLinks]
    .flatMap((link) => {
      const sanitized = safeOfficialLink(link);

      return sanitized === null ? [] : [sanitized];
    })
    .filter((link) => allowedSurfaces.has(link.surface) || link.surface === "docs")
    .filter((link, index, allLinks) =>
      allLinks.findIndex((candidateLinkItem) => candidateLinkItem.href === link.href) === index
    );

  return links.slice(0, 6);
}

function safeOfficialLink(link: EmergencyOfficialLink): EmergencyOfficialLink | null {
  const href = redactSensitiveString(link.href.trim());

  if (!href.startsWith("https://") || href.includes("[REDACTED:")) {
    return null;
  }

  return {
    label: redactSensitiveString(link.label).slice(0, 80),
    href,
    description: redactSensitiveString(link.description).slice(0, 240),
    surface: redactSensitiveString(link.surface).slice(0, 40),
  };
}
