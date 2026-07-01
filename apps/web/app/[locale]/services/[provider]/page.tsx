import { notFound } from "next/navigation";
import {
  PageHeader,
  ProviderSourceLink,
  ServiceDetail,
} from "../../../../components/OperationsViews";
import { LiveRefreshButton } from "../../../../components/LiveRefreshButton";
import { getMessages, isLocale, type Locale } from "../../../../lib/i18n";
import { readCodexResetCreditMetrics, summarizeLocalAiCliUsage } from "../../../../lib/live-today";
import { readLocalAiCliStatus } from "../../../../lib/local-tools";
import { readOperationsDashboard, type OperationsProvider } from "../../../../lib/operations-data";
import { isProviderKey, type ProviderKey } from "../../../../lib/provider-catalog";

interface PageProps {
  params: Promise<{
    locale: string;
    provider: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({ params }: PageProps) {
  const { locale, provider: providerKey } = await readParams(params);
  const messages = getMessages(locale);
  const dashboard = await readOperationsDashboard();
  const localCliProvider = isLocalAiCliProvider(providerKey);
  const providerRows = localCliProvider ? dashboard.providers : dashboard.visibleProviders;
  const provider = providerRows.find((item) => item.providerKey === providerKey) ??
    (isCodexLocalAiProvider(providerKey)
      ? providerRows.find((item) => isCodexLocalAiProvider(item.providerKey))
      : undefined);

  if (provider === undefined) {
    notFound();
  }

  const selectedProvider = await withFreshLocalAiCliUsage(provider);

  return (
    <>
      <PageHeader
        title={selectedProvider.displayName}
        subtitle={localCliProvider
          ? messages.services.localCliUsageNote
          : `${messages.services.serviceTitle} - ${messages.services.readOnly}`}
        meta={
          <div className="header-control-row">
            <ProviderSourceLink provider={selectedProvider} variant="button" />
            <LiveRefreshButton className="ghost-button header-control" label={messages.dashboard.refresh} />
          </div>
        }
      />
      <ServiceDetail dashboard={dashboard} locale={locale} messages={messages} provider={selectedProvider} />
    </>
  );
}

async function readParams(params: PageProps["params"]): Promise<{ locale: Locale; provider: ProviderKey }> {
  const { locale, provider } = await params;

  if (!isLocale(locale) || !isProviderKey(provider)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    provider: provider as ProviderKey,
  };
}

async function withFreshLocalAiCliUsage(provider: OperationsProvider): Promise<OperationsProvider> {
  if (!isLocalAiCliProvider(provider.providerKey)) {
    return provider;
  }

  const status = await readLocalAiCliStatus({
    providerKeys: [provider.providerKey],
  });
  const localProvider = status.providers.find((item) => item.providerKey === provider.providerKey);

  if (localProvider === undefined) {
    return provider;
  }

  const usageSummary = summarizeLocalAiCliUsage(
    localProvider,
    isCodexLocalAiProvider(provider.providerKey)
      ? await readCodexResetCreditMetrics({
          env: process.env,
          now: new Date(),
        })
      : [],
  );
  const localConfigured = localProvider.cli.state === "installed" || localProvider.usage.logFileCount > 0;
  const configuredEnvKeys = localConfigured
    ? [...new Set([
        ...provider.configuredEnvKeys,
        ...(localProvider.cli.state === "installed" ? [`${localProvider.command} command`] : []),
        ...(localProvider.usage.logFileCount > 0 ? [localProvider.usage.source] : []),
      ])].sort()
    : provider.configuredEnvKeys;

  return {
    ...provider,
    configuredEnvKeys,
    currentUsageSummary: usageSummary,
    latestLiveCheck: status.generatedAt,
    liveConfidence: usageSummary === null ? "none" : "low",
    liveFreshness: localProvider.cli.state === "error"
      ? "error"
      : usageSummary === null
        ? "stale"
        : "live",
    missingEnvKeys: localConfigured ? [] : provider.missingEnvKeys,
    readOnlyTestState: localConfigured ? "read_only_ready" : provider.readOnlyTestState,
  };
}

function isLocalAiCliProvider(
  providerKey: ProviderKey,
): providerKey is "codex-cli" | "codex-app" | "claude-cli" | "claude-app" | "antigravity" {
  return providerKey === "codex-cli" ||
    providerKey === "codex-app" ||
    providerKey === "claude-cli" ||
    providerKey === "claude-app" ||
    providerKey === "antigravity";
}

function isCodexLocalAiProvider(providerKey: ProviderKey): providerKey is "codex-cli" | "codex-app" {
  return providerKey === "codex-cli" || providerKey === "codex-app";
}
