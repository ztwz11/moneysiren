import type { Theme } from "./theme.js";

export function renderHomeScreen(input: { version: string; theme: Theme }): string {
  const { theme, version } = input;

  return [
    `${theme.brand("MoneySiren")} ${theme.muted(version)}`,
    "Local-first cloud/SaaS usage, status, and expected billing.",
    "",
    theme.heading("Slash commands"),
    `  ${theme.command("/help")}                 Show CLI usage and slash guide`,
    `  ${theme.command("/version")}              Print the installed CLI version`,
    `  ${theme.command("/doctor")}               Check local readiness without printing secrets`,
    `  ${theme.command("/demo")}                 Install web, seed fake data, and open locally`,
    `  ${theme.command("/install")}              Choose CLI, web dashboard, and HUD components`,
    `  ${theme.command("/modes")}                Show the CLI, web, and desktop modes`,
    `  ${theme.command("/start")}                Start the installed dashboard runtime`,
    `  ${theme.command("/hud")}                  Start the installed runtime and open HUD`,
    `  ${theme.command("/status")}               Show managed web, HUD, and local API runtime status`,
    `  ${theme.command("/stop")}                 Stop managed web, HUD, and local API runtimes`,
    `  ${theme.command("/init")}                 Create local SQLite storage`,
    `  ${theme.command("/dashboard")}            Check the local dashboard API`,
    `  ${theme.command("/dashboard check")}      Same as /dashboard`,
    `  ${theme.command("/summary json")}         Print sanitized local summary JSON`,
    `  ${theme.command("/notify dry-run")}       Preview a sanitized notification digest`,
    `  ${theme.command("/notify prefs")}         List local notification defaults`,
    `  ${theme.command("/desktop status")}       Check local runtime status`,
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
    "  msiren demo",
    "  msiren start",
    "  msiren hud",
    "  msiren status",
    "  msiren stop",
    "  msiren install --all",
    "",
    theme.heading("Full command"),
    "  moneysiren doctor",
    "  moneysiren install",
    "  moneysiren install --status",
    "  moneysiren modes",
    "  moneysiren init",
    "  moneysiren serve [--port <port>]",
    "  moneysiren stop [--web|--hud|--api|--all]",
    "  moneysiren restart [--port <port>] [--open|--no-open] [--hud]",
    "  moneysiren open",
    "  moneysiren sync --provider mock",
    "  moneysiren summary --json",
    "  moneysiren notify once --dry-run",
    "  moneysiren notify prefs list",
    "  moneysiren desktop status",
    "  moneysiren report daily --lang ko",
    "  moneysiren dashboard check",
    "  moneysiren theme preview",
    "  moneysiren theme image-prompt",
    "  moneysiren theme image-generate",
    "",
    theme.warning("Security"),
    "  Home/help does not call provider APIs, read secret values, create .env, or enable telemetry.",
  ].join("\n");
}

export function renderHelpScreen(version: string): string {
  return `MoneySiren ${version}

Local-first cloud/SaaS usage, status, and expected billing dashboard.

Short command:
  msiren start
  msiren hud
  msiren install --all

Usage:
  moneysiren
  moneysiren --help
  moneysiren --version
  moneysiren init
  moneysiren install [--status|--all|--cli|--web|--hud|--no-cli|--no-web|--no-hud]
  moneysiren doctor
  moneysiren modes
  moneysiren start [--port <port>] [--open|--no-open] [--hud]
  moneysiren hud [--port <port>]
  moneysiren status
  moneysiren stop [--web|--hud|--api|--all]
  moneysiren restart [--port <port>] [--open|--no-open] [--hud]
  moneysiren dashboard check [--url <local-dashboard-url>]
  moneysiren serve [--port <port>]
  moneysiren open
  moneysiren theme preview
  moneysiren theme image-prompt
  moneysiren theme image-generate [--out <png> --theme-out <json> --model <model>]
  moneysiren sync --provider <mock|aws|openai|supabase|cloudflare>
  moneysiren summary --json
  moneysiren notify once --dry-run
  moneysiren notify prefs list
  moneysiren desktop status
  moneysiren report daily --lang ko [--send slack]

Slash commands:
  moneysiren /help
  moneysiren /version
  moneysiren /doctor
  moneysiren /install
  moneysiren /modes
  moneysiren /start
  moneysiren /hud
  moneysiren /status
  moneysiren /stop [--web|--hud|--api|--all]
  moneysiren /init
  moneysiren /dashboard
  moneysiren /dashboard check
  moneysiren /summary json
  moneysiren /notify dry-run
  moneysiren /notify prefs
  moneysiren /desktop status
  moneysiren /theme <preview|image-prompt|image-generate>
  moneysiren /sync <mock|aws|openai|supabase|cloudflare>
  moneysiren /report ko
  moneysiren /quit
`;
}
