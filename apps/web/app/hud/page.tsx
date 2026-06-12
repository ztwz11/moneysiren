import { getMessages, isLocale, type Locale } from "../../lib/i18n";
import {
  readWebLocalNotificationDigest,
  readWebNotificationPreferences,
} from "../../lib/local-notification-model";
import type { CSSProperties } from "react";

interface HudPageProps {
  searchParams?: Promise<{
    locale?: string | string[];
  }>;
}

export const dynamic = "force-dynamic";

export default async function HudPage({ searchParams }: HudPageProps) {
  const locale = await readLocale(searchParams);
  const messages = getMessages(locale);
  const preferences = await readWebNotificationPreferences();
  const digest = await readWebLocalNotificationDigest({
    notificationPreferences: {
      ...preferences,
      enabled: true,
      digestEnabled: true,
      selectedWidgets: preferences.hud.selectedWidgets,
    },
  });
  const hudStyle = {
    "--hud-font-scale": String(preferences.hud.fontScale),
    "--hud-opacity": String(preferences.hud.opacity),
  } as CSSProperties & Record<"--hud-font-scale" | "--hud-opacity", string>;

  return (
    <main className="hud-page" style={hudStyle}>
      <header className="hud-header" data-tauri-drag-region>
        <div>
          <p className="hud-kicker">{messages.nav.notifications}</p>
          <h1>StackSpend HUD</h1>
        </div>
        <span className={digest.status === "ok" ? "badge badge-ok" : digest.status === "critical" ? "badge badge-critical" : "badge badge-warn"}>
          {digest.status}
        </span>
      </header>
      <section className="hud-item-list" aria-label={messages.settings.widgetSelection}>
        {digest.items.length === 0 ? (
          <div className="hud-empty">
            <strong>{messages.settings.notificationDisabled}</strong>
            <span>{digest.suppressedReason ?? messages.settings.notificationPreview}</span>
          </div>
        ) : digest.items.map((item) => (
          <a className="hud-item" href={item.clickPath ?? `/${locale}/dashboard/overview`} key={item.widgetKey}>
            <span className="hud-item-copy">
              <strong>{messages.notificationWidgets[item.widgetKey]}</strong>
              <span className="metric-meta">{item.label}</span>
            </span>
            <span className={`hud-value hud-value-${item.severity}`}>{item.value}</span>
          </a>
        ))}
      </section>
    </main>
  );
}

async function readLocale(searchParams: HudPageProps["searchParams"]): Promise<Locale> {
  const raw = (await searchParams)?.locale;
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value !== undefined && isLocale(value) ? value : "ko";
}
