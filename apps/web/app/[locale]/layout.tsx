import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, type ServiceNavItem } from "../../components/AppShell";
import { getMessages, isLocale, type Locale } from "../../lib/i18n";
import { readDashboardSnapshot } from "../../lib/dashboard-data";
import { resolveDashboardTimezone } from "../../lib/operations-data";
import {
  CONNECTABLE_PROVIDER_KEYS,
  LOCAL_PROVIDER_KEYS,
  findAvailableProvider,
} from "../../lib/provider-catalog";
import { loadMoneySirenConfig } from "../../../../packages/config/src/index";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export function generateStaticParams() {
  return [{ locale: "ko" }, { locale: "en" }, { locale: "ja" }];
}

export const dynamic = "force-dynamic";

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale as Locale;
  const messages = getMessages(locale);
  const timezone = resolveDashboardTimezone();
  const serviceNavItems = await readSavedServiceNavItems();

  return (
    <AppShell locale={locale} messages={messages} serviceNavItems={serviceNavItems} timezone={timezone}>
      {children}
    </AppShell>
  );
}

async function readSavedServiceNavItems(): Promise<ServiceNavItem[]> {
  try {
    const [snapshot, config] = await Promise.all([
      readDashboardSnapshot(),
      Promise.resolve(loadMoneySirenConfig(process.env)),
    ]);
    const savedProviderKeys = new Set(snapshot.providers.map((provider) => provider.providerKey));

    return CONNECTABLE_PROVIDER_KEYS
      .filter((providerKey) =>
        savedProviderKeys.has(providerKey) ||
        config.providers[providerKey].configured ||
        (LOCAL_PROVIDER_KEYS as readonly string[]).includes(providerKey)
      )
      .map((provider) => ({
        providerKey: provider,
        label: findAvailableProvider(provider)?.name ?? provider,
      }));
  } catch {
    return [];
  }
}
