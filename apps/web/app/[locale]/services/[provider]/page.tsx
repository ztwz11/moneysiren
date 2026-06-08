import { notFound } from "next/navigation";
import {
  PageHeader,
  ServiceDetail,
} from "../../../../components/OperationsViews";
import { getMessages, isLocale, type Locale } from "../../../../lib/i18n";
import { readOperationsDashboard } from "../../../../lib/operations-data";
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
  const provider = dashboard.visibleProviders.find((item) => item.providerKey === providerKey);

  if (provider === undefined) {
    notFound();
  }

  const selectedProvider = provider;

  return (
    <>
      <PageHeader
        title={selectedProvider.displayName}
        subtitle={`${messages.services.serviceTitle} - ${messages.services.readOnly}`}
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
