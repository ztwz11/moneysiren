import type { Theme } from "./theme.js";

export function renderHomeScreen(input: { version: string; theme: Theme }): string {
  const { theme, version } = input;

  return [
    `${theme.brand("StackSpend")} ${theme.muted(version)}`,
    "Local-first cloud/SaaS usage, status, and expected billing.",
    "",
    theme.heading("Slash commands"),
    `  ${theme.command("/help")}                 Show CLI usage and slash guide`,
    `  ${theme.command("/version")}              Print the installed CLI version`,
    `  ${theme.command("/doctor")}               Check local readiness without printing secrets`,
    `  ${theme.command("/init")}                 Create local SQLite storage`,
    `  ${theme.command("/dashboard")}            Check the local dashboard API`,
    `  ${theme.command("/dashboard check")}      Same as /dashboard`,
    `  ${theme.command("/theme preview")}        Preview the active CLI image-reference theme`,
    `  ${theme.command("/sync mock")}            Sync fake local review snapshots`,
    `  ${theme.command("/sync aws")}             Sync AWS Cost Explorer snapshots`,
    `  ${theme.command("/sync openai")}          Sync OpenAI usage/cost snapshots`,
    `  ${theme.command("/sync supabase")}        Sync Supabase usage/health snapshots`,
    `  ${theme.command("/sync cloudflare")}      Sync Cloudflare billing/usage snapshots`,
    `  ${theme.command("/report ko")}            Render the Korean daily report`,
    `  ${theme.command("/quit")}                 Exit the slash prompt`,
    "",
    theme.heading("Classic CLI"),
    "  stackspend doctor",
    "  stackspend init",
    "  stackspend sync --provider mock",
    "  stackspend report daily --lang ko",
    "  stackspend dashboard check",
    "  stackspend theme preview",
    "  stackspend theme image-prompt",
    "  stackspend theme image-generate",
    "",
    theme.warning("Security"),
    "  Home/help does not call provider APIs, read secret values, create .env, or enable telemetry.",
  ].join("\n");
}

export function renderHelpScreen(version: string): string {
  return `StackSpend ${version}

Local-first cloud/SaaS usage, status, and expected billing dashboard.

Usage:
  stackspend
  stackspend --help
  stackspend --version
  stackspend init
  stackspend doctor
  stackspend dashboard check [--url <local-dashboard-url>]
  stackspend theme preview
  stackspend theme image-prompt
  stackspend theme image-generate [--out <png> --theme-out <json> --model <model>]
  stackspend sync --provider <mock|aws|openai|supabase|cloudflare>
  stackspend report daily --lang ko [--send slack]

Slash commands:
  stackspend /help
  stackspend /version
  stackspend /doctor
  stackspend /init
  stackspend /dashboard
  stackspend /dashboard check
  stackspend /theme <preview|image-prompt|image-generate>
  stackspend /sync <mock|aws|openai|supabase|cloudflare>
  stackspend /report ko
  stackspend /quit
`;
}
