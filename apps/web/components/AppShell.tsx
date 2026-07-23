"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BellRing,
  ChevronDown,
  ChevronsLeft,
  CircleHelp,
  FileText,
  Home,
  KeyRound,
  Link2,
  Monitor,
  Settings,
  SlidersHorizontal,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  LOCALE_OPTIONS,
  replaceLocale,
  type Locale,
  type Messages,
} from "../lib/i18n";
import { AppLoadingOverlay } from "./AppLoadingOverlay";
import {
  DESKTOP_PREFERENCE_EVENT,
  desktopPreferenceFromEvent,
} from "../lib/desktop-preference-events";
import { openHudDashboardRoute } from "../lib/hud-navigation";
import { ProviderIcon } from "./ProviderIcon";

interface AppShellProps {
  children: ReactNode;
  desktopEnabled: boolean;
  locale: Locale;
  messages: Messages;
  serviceNavItems: readonly ServiceNavItem[];
  timezone: string;
}

export interface ServiceNavItem {
  providerKey: string;
  label: string;
}

interface NavItem {
  action?: "open-hud";
  href?: string;
  label: string;
  icon?: LucideIcon;
  providerKey?: string;
}

interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

export function AppShell({
  children,
  desktopEnabled: initialDesktopEnabled,
  locale,
  messages,
  serviceNavItems,
  timezone,
}: AppShellProps) {
  const pathname = usePathname();
  const [desktopEnabled, setDesktopEnabled] = useState(initialDesktopEnabled);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navGroups = buildNavGroups(locale, messages, serviceNavItems);

  useEffect(() => {
    setDesktopEnabled(initialDesktopEnabled);
  }, [initialDesktopEnabled]);

  useEffect(() => {
    const handleDesktopPreference = (event: Event) => {
      const nextDesktopEnabled = desktopPreferenceFromEvent(event);

      if (nextDesktopEnabled !== null) {
        setDesktopEnabled(nextDesktopEnabled);
      }
    };

    window.addEventListener(DESKTOP_PREFERENCE_EVENT, handleDesktopPreference);

    return () => {
      window.removeEventListener(DESKTOP_PREFERENCE_EVENT, handleDesktopPreference);
    };
  }, []);

  return (
    <div className="app-shell" lang={locale}>
      <AppLoadingOverlay
        navigationLabel={messages.settings.toolLoadingPreparingView}
        savingLabel={messages.settings.toolLoadingPreparingView}
      />
      <div className="mobile-bar">
        <button
          aria-label={messages.app.menu}
          className="menu-button"
          type="button"
          onClick={() => setDrawerOpen(true)}
        >
          <span>{messages.app.menu}</span>
        </button>
        <strong>{messages.app.title}</strong>
        <span className="muted">{locale.toUpperCase()}</span>
      </div>

      {drawerOpen ? (
        <>
          <button
            aria-label={messages.app.closeMenu}
            className="drawer-backdrop"
            type="button"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="drawer">
            <div className="drawer-header">
              <strong>{messages.app.title}</strong>
              <button className="ghost-button" type="button" onClick={() => setDrawerOpen(false)}>
                {messages.app.closeMenu}
              </button>
            </div>
            <Navigation
              desktopEnabled={desktopEnabled}
              groups={navGroups}
              locale={locale}
              messages={messages}
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
            />
            <ShellFooter locale={locale} messages={messages} pathname={pathname} timezone={timezone} />
          </aside>
        </>
      ) : null}

      <div className={sidebarCollapsed ? "layout-grid layout-grid-collapsed" : "layout-grid"}>
        <aside className={sidebarCollapsed ? "sidebar sidebar-collapsed" : "sidebar"}>
          <div>
            <div className="brand">
              <img alt="" aria-hidden="true" className="brand-logo" draggable={false} src="/icon.png" />
              <p className="brand-title">{messages.app.title}</p>
            </div>
            <Navigation
              desktopEnabled={desktopEnabled}
              groups={navGroups}
              locale={locale}
              messages={messages}
              pathname={pathname}
            />
          </div>
          <ShellFooter
            collapsed={sidebarCollapsed}
            locale={locale}
            messages={messages}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            pathname={pathname}
            timezone={timezone}
          />
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function Navigation({
  desktopEnabled,
  groups,
  locale,
  messages,
  pathname,
  onNavigate,
}: {
  desktopEnabled: boolean;
  groups: readonly NavGroup[];
  locale: Locale;
  messages: Messages;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="nav-groups">
      {groups.map((group) => (
        <div key={group.label}>
          {group.items.map((item) => {
            const active = item.href !== undefined && pathname === item.href;
            const key = item.href ?? item.action ?? item.label;

            if (item.action === "open-hud") {
              return (
                <button
                  className="nav-link nav-button"
                  key={key}
                  onClick={() => {
                    void openHudDashboardRoute(`/hud?locale=${encodeURIComponent(locale)}`, {
                      allowBrowserFallback: !desktopEnabled,
                      preopenFallback: !desktopEnabled,
                    }).then((opened) => {
                      if (!opened) {
                        window.alert(messages.settings.hudDesktopUnavailable);
                      }
                    });
                    onNavigate?.();
                  }}
                  title={item.label}
                  type="button"
                >
                  <span className="nav-link-body">
                    <NavItemIcon item={item} />
                    <span className="nav-link-label">{item.label}</span>
                  </span>
                </button>
              );
            }

            if (item.href === undefined) {
              return null;
            }

            return (
              <Link
                className={active ? "nav-link nav-link-active" : "nav-link"}
                href={item.href}
                key={key}
                {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
              >
                <span className="nav-link-body">
                  <NavItemIcon item={item} />
                  <span className="nav-link-label">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function NavItemIcon({ item }: { item: NavItem }) {
  if (item.providerKey !== undefined) {
    return <ProviderIcon className={`nav-provider-icon provider-mark-${item.providerKey}`} providerKey={item.providerKey} />;
  }

  const Icon = item.icon;

  return Icon === undefined ? null : <Icon aria-hidden="true" size={16} strokeWidth={1.8} />;
}

function ShellFooter({
  collapsed = false,
  locale,
  messages,
  onToggleCollapsed,
  pathname,
  timezone,
}: {
  collapsed?: boolean;
  locale: Locale;
  messages: Messages;
  onToggleCollapsed?: () => void;
  pathname: string;
  timezone: string;
}) {
  const preferencesHref = `/${locale}/settings/preferences`;
  const localeListId = useId();
  const [localeOpen, setLocaleOpen] = useState(false);
  const selectedLocaleOption = LOCALE_OPTIONS.find((option) => option.locale === locale) ?? LOCALE_OPTIONS[0];

  return (
    <div className="sidebar-footer">
      <div>
        <div
          className="locale-switcher locale-combobox"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setLocaleOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setLocaleOpen(false);
            }
          }}
        >
          <button
            aria-controls={localeListId}
            aria-expanded={localeOpen}
            aria-haspopup="listbox"
            aria-label={messages.app.locale}
            className="locale-combobox-trigger"
            onClick={() => setLocaleOpen((current) => !current)}
            type="button"
          >
            <img
              alt=""
              aria-hidden="true"
              className="locale-flag"
              height={18}
              src={selectedLocaleOption.iconSrc}
              width={24}
            />
            <span className="locale-label">{selectedLocaleOption.label}</span>
            <ChevronDown aria-hidden="true" className="locale-combobox-caret" size={14} />
          </button>
          {localeOpen ? (
            <div aria-label={messages.app.locale} className="locale-combobox-menu" id={localeListId} role="listbox">
              {LOCALE_OPTIONS.map(({ iconSrc, label, locale: nextLocale }) => (
                <Link
                  aria-selected={nextLocale === locale}
                  className={nextLocale === locale ? "locale-option locale-option-active" : "locale-option"}
                  href={replaceLocale(pathname, nextLocale)}
                  key={nextLocale}
                  onClick={() => setLocaleOpen(false)}
                  role="option"
                >
                  <img alt="" aria-hidden="true" className="locale-flag" height={18} src={iconSrc} width={24} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div>
        <Link className="footer-link" href={preferencesHref} title={messages.nav.preferences}>
          <Settings aria-hidden="true" size={15} />
          <span className="footer-link-label">{messages.nav.preferences}</span>
        </Link>
        <Link
          className="footer-link"
          href={`${preferencesHref}#timezone`}
          title={`${messages.app.timezone}: ${timezone}`}
        >
          <CircleHelp aria-hidden="true" size={15} />
          <span className="footer-link-label">{messages.app.timezone}: {timezone}</span>
        </Link>
        {onToggleCollapsed === undefined ? null : (
          <button
            aria-pressed={collapsed}
            className="footer-link footer-button"
            onClick={onToggleCollapsed}
            title={collapsed ? messages.app.menu : messages.app.closeMenu}
            type="button"
          >
            <ChevronsLeft aria-hidden="true" className="footer-toggle-icon" size={15} />
            <span className="footer-link-label">{collapsed ? messages.app.menu : messages.app.closeMenu}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function buildNavGroups(
  locale: Locale,
  messages: Messages,
  serviceNavItems: readonly ServiceNavItem[],
): readonly NavGroup[] {
  const base = `/${locale}`;

  return [
    {
      label: messages.nav.dashboard,
      items: [
        { href: `${base}/dashboard/overview`, label: messages.nav.overview, icon: Home },
        { action: "open-hud", label: messages.nav.hud, icon: Monitor },
        { href: `${base}/dashboard/today`, label: messages.nav.today, icon: BarChart3 },
        { href: `${base}/dashboard/forecast`, label: messages.nav.forecast, icon: WalletCards },
        { href: `${base}/dashboard/risks`, label: messages.nav.risks, icon: Bell },
      ],
    },
    {
      label: messages.nav.services,
      items: [
        { href: `${base}/services`, label: messages.nav.allServices, icon: FileText },
        ...serviceNavItems.map((item) => ({
          href: `${base}/services/${item.providerKey}`,
          label: item.label,
          providerKey: item.providerKey,
        })),
      ],
    },
    {
      label: messages.nav.settings,
      items: [
        { href: `${base}/settings/connections`, label: messages.nav.connections, icon: Link2 },
        { href: `${base}/settings/notifications`, label: messages.nav.notifications, icon: BellRing },
        { href: `${base}/settings/preferences`, label: messages.nav.preferences, icon: SlidersHorizontal },
        { href: `${base}/providers`, label: messages.nav.providers, icon: KeyRound },
      ],
    },
  ];
}
