import type { ConfiguredProvider, ProviderConfig } from "../../../../packages/config/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { loadCliConfig } from "./shared.js";

const PROVIDER_ORDER: readonly ConfiguredProvider[] = ["aws", "openai", "supabase", "cloudflare"];

export async function runDoctorCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.length > 0) {
    context.stderr("Usage: moneysiren doctor");
    return 1;
  }

  const config = loadCliConfig(context.env);

  context.stdout("MoneySiren doctor");
  context.stdout(`DB path: ${config.dbPath}`);
  context.stdout(`telemetry: ${config.telemetryEnabled ? "enabled" : "disabled"}`);
  context.stdout("mock provider: available");

  for (const provider of PROVIDER_ORDER) {
    context.stdout(`${provider}: ${formatProviderReadiness(config.providers[provider])}`);
  }

  context.stdout(`slack: ${config.slack.webhookConfigured ? "configured" : "not configured"}`);
  return 0;
}

function formatProviderReadiness(providerConfig: ProviderConfig): string {
  if (providerConfig.configured) {
    return "configured";
  }

  return `missing ${providerConfig.missingEnvKeys.join(", ")}`;
}
