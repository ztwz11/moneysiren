import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, type ServiceNavItem } from "../../components/AppShell";
import { LOCALES, getMessages, isLocale, type Locale } from "../../lib/i18n";
import { readDashboardSnapshot } from "../../lib/dashboard-data";
import { readWebNotificationPreferences } from "../../lib/local-notification-model";
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
  return LOCALES.map((locale) => ({ locale }));
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
  const [serviceNavItems, notificationPreferences] = await Promise.all([
    readSavedServiceNavItems(),
    readWebNotificationPreferences(),
  ]);

  return (
    <AppShell
      desktopEnabled={notificationPreferences.desktopEnabled}
      locale={locale}
      messages={messages}
      serviceNavItems={serviceNavItems}
      timezone={timezone}
    >
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

    const navItems = CONNECTABLE_PROVIDER_KEYS
      .filter((providerKey) =>
        savedProviderKeys.has(providerKey) ||
        config.providers[providerKey].configured ||
        (LOCAL_PROVIDER_KEYS as readonly string[]).includes(providerKey)
      )
      .map((provider) => ({
        providerKey: provider,
        label: findAvailableProvider(provider)?.name ?? provider,
        saved: savedProviderKeys.has(provider),
        configured: config.providers[provider].configured,
      }));

    return mergeCodexServiceNavItems(navItems);
  } catch {
    return [];
  }
}

function mergeCodexServiceNavItems(
  items: readonly (ServiceNavItem & { saved: boolean; configured: boolean })[],
): ServiceNavItem[] {
  const codexItems = items.filter((item) => item.providerKey === "codex-app" || item.providerKey === "codex-cli");

  if (codexItems.length < 2) {
    return items.map(({ providerKey, label }) => ({ providerKey, label }));
  }

  const preferred = codexItems.find((item) => item.providerKey === "codex-app" && (item.saved || item.configured)) ??
    codexItems.find((item) => item.providerKey === "codex-cli" && (item.saved || item.configured)) ??
    codexItems.find((item) => item.providerKey === "codex-app") ??
    codexItems[0]!;
  let inserted = false;

  return items.flatMap((item) => {
    if (item.providerKey !== "codex-app" && item.providerKey !== "codex-cli") {
      return [{ providerKey: item.providerKey, label: item.label }];
    }

    if (inserted) {
      return [];
    }

    inserted = true;
    return [{ providerKey: preferred.providerKey, label: "Codex" }];
  });
}
