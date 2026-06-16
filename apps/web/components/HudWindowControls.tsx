"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Pin, PinOff, RefreshCw, Save, Settings, X } from "lucide-react";
import type { Locale } from "../lib/i18n";
import type { NotificationPreferences } from "./NotificationSettingsModel";

type SaveState = "idle" | "saving" | "saved" | "error";
type HudWindowAction = "close" | "minimize";
const HUD_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface HudWindowControlsProps {
  initialPreferences: NotificationPreferences;
  labels: {
    alwaysOnTop: string;
    close: string;
    error: string;
    fontSize: string;
    minimize: string;
    opacity: string;
    refresh: string;
    save: string;
    saved: string;
    settings: string;
  };
  locale: Locale;
}

interface TauriWindow {
  close: () => Promise<void>;
  hide: () => Promise<void>;
  isAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
}

export function HudWindowControls({ initialPreferences, labels, locale }: HudWindowControlsProps) {
  const router = useRouter();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [draftAlwaysOnTop, setDraftAlwaysOnTop] = useState(initialPreferences.hud.alwaysOnTop);
  const [draftFontScale, setDraftFontScale] = useState(initialPreferences.hud.fontScale);
  const [draftOpacity, setDraftOpacity] = useState(initialPreferences.hud.opacity);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    let mounted = true;

    void syncInitialAlwaysOnTop();

    return () => {
      mounted = false;
    };

    async function syncInitialAlwaysOnTop(): Promise<void> {
      const hudWindow = await getCurrentHudWindow();

      if (!mounted || hudWindow === null) {
        return;
      }

      try {
        await hudWindow.setAlwaysOnTop(initialPreferences.hud.alwaysOnTop);
      } catch (error) {
        console.warn("MoneySiren HUD always-on-top initial sync failed.", error);
      }

      try {
        const currentAlwaysOnTop = await hudWindow.isAlwaysOnTop();

        if (mounted) {
          setDraftAlwaysOnTop(currentAlwaysOnTop);
        }
      } catch (error) {
        console.warn("MoneySiren HUD always-on-top read failed.", error);
      }
    }
  }, [initialPreferences.hud.alwaysOnTop]);

  useEffect(() => {
    setDraftAlwaysOnTop(initialPreferences.hud.alwaysOnTop);
    setDraftFontScale(initialPreferences.hud.fontScale);
    setDraftOpacity(initialPreferences.hud.opacity);
    setSaveState("idle");
  }, [
    initialPreferences.hud.alwaysOnTop,
    initialPreferences.hud.fontScale,
    initialPreferences.hud.opacity,
  ]);

  useEffect(() => {
    const hudPage = document.querySelector<HTMLElement>(".hud-page");

    hudPage?.style.setProperty("--hud-font-scale", String(draftFontScale));
    hudPage?.style.setProperty("--hud-opacity", String(draftOpacity));
  }, [draftFontScale, draftOpacity]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, HUD_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [router]);

  return (
    <>
      <div className="hud-window-controls" aria-label={labels.settings}>
        <button
          aria-label={labels.refresh}
          className="hud-control-button"
          onClick={() => router.refresh()}
          title={labels.refresh}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={14} strokeWidth={1.9} />
        </button>
        <button
          aria-expanded={controlsOpen}
          aria-label={labels.settings}
          className="hud-control-button"
          onClick={() => setControlsOpen((current) => !current)}
          title={labels.settings}
          type="button"
        >
          <Settings aria-hidden="true" size={14} strokeWidth={1.9} />
        </button>
        <button
          aria-label={labels.minimize}
          className="hud-control-button"
          onClick={() => {
            void handleWindowAction("minimize");
          }}
          title={labels.minimize}
          type="button"
        >
          <Minus aria-hidden="true" size={15} strokeWidth={2} />
        </button>
        <button
          aria-label={labels.close}
          className="hud-control-button hud-control-button-danger"
          onClick={() => {
            void handleWindowAction("close");
          }}
          title={labels.close}
          type="button"
        >
          <X aria-hidden="true" size={15} strokeWidth={2} />
        </button>
      </div>

      {controlsOpen ? (
        <div className="hud-settings-popover">
          <label className="hud-toggle-row">
            <input
              checked={draftAlwaysOnTop}
              onChange={() => {
                setDraftAlwaysOnTop((current) => !current);
                setSaveState("idle");
              }}
              type="checkbox"
            />
            <span className="toggle-switch" aria-hidden="true" />
            <span>{labels.alwaysOnTop}</span>
            {draftAlwaysOnTop ? (
              <Pin aria-hidden="true" size={13} strokeWidth={1.9} />
            ) : (
              <PinOff aria-hidden="true" size={13} strokeWidth={1.9} />
            )}
          </label>
          <label className="hud-range-row">
            <span>{labels.fontSize}</span>
            <input
              max="130"
              min="80"
              onChange={(event) => {
                setDraftFontScale(Number(event.currentTarget.value) / 100);
                setSaveState("idle");
              }}
              step="5"
              type="range"
              value={Math.round(draftFontScale * 100)}
            />
            <strong>{Math.round(draftFontScale * 100)}%</strong>
          </label>
          <label className="hud-range-row">
            <span>{labels.opacity}</span>
            <input
              max="100"
              min="0"
              onChange={(event) => {
                setDraftOpacity(Number(event.currentTarget.value) / 100);
                setSaveState("idle");
              }}
              step="5"
              type="range"
              value={Math.round(draftOpacity * 100)}
            />
            <strong>{Math.round(draftOpacity * 100)}%</strong>
          </label>
          <button
            className="hud-save-button"
            disabled={saveState === "saving"}
            onClick={() => {
              void saveHudSettings();
            }}
            type="button"
          >
            <Save aria-hidden="true" size={13} strokeWidth={1.9} />
            <span>{labels.save}</span>
          </button>
          <a className="hud-settings-link" href={`/${locale}/settings/notifications`}>
            <Settings aria-hidden="true" size={13} strokeWidth={1.9} />
            <span>{labels.settings}</span>
          </a>
          {saveState === "saved" ? (
            <span className="hud-save-status">
              <Check aria-hidden="true" size={12} strokeWidth={2} />
              {labels.saved}
            </span>
          ) : null}
          {saveState === "error" ? <span className="hud-save-status hud-save-status-error">{labels.error}</span> : null}
        </div>
      ) : null}
    </>
  );

  async function saveHudSettings() {
    setSaveState("saving");

    try {
      const savedPreferences = await saveHudPreferences(initialPreferences, {
        alwaysOnTop: draftAlwaysOnTop,
        fontScale: draftFontScale,
        opacity: draftOpacity,
      });
      void applyAlwaysOnTop(savedPreferences.hud.alwaysOnTop);
      router.refresh();
      setSaveState("saved");
    } catch (error) {
      console.error("MoneySiren HUD settings save failed.", error);
      setSaveState("error");
    }
  }

  async function handleWindowAction(action: HudWindowAction): Promise<void> {
    try {
      await runWindowAction(action);
    } catch (error) {
      console.error(`MoneySiren HUD ${action} action failed.`, error);
    }
  }
}

async function runWindowAction(action: HudWindowAction): Promise<void> {
  const hudWindow = await getCurrentHudWindow();

  if (hudWindow === null) {
    throw new Error("MoneySiren HUD window API is not available.");
  }

  if (action === "close") {
    await hudWindow.close();
  } else {
    await hudWindow.hide();
  }
}

async function applyAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  const hudWindow = await getCurrentHudWindow();

  if (hudWindow === null) {
    return;
  }

  try {
    await hudWindow.setAlwaysOnTop(alwaysOnTop);
  } catch (error) {
    console.warn("MoneySiren HUD always-on-top apply failed.", error);
  }
}

async function getCurrentHudWindow(): Promise<TauriWindow | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");

    return getCurrentWindow() as TauriWindow;
  } catch {
    return null;
  }
}

async function saveHudPreferences(
  initialPreferences: NotificationPreferences,
  hudPreferences: Pick<NotificationPreferences["hud"], "alwaysOnTop" | "fontScale" | "opacity">,
): Promise<NotificationPreferences> {
  const preferences = await loadNotificationPreferences(initialPreferences);
  const session = await createLocalSession();
  const response = await fetch("/api/notification-preferences", {
    body: JSON.stringify({
      ...preferences,
      hud: {
        ...preferences.hud,
        ...hudPreferences,
      },
    }),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-MoneySiren-CSRF": session.csrfToken,
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(`Save failed with status ${response.status}.`);
  }

  const payload = await response.json() as { preferences?: NotificationPreferences };

  if (payload.preferences === undefined) {
    throw new Error("Notification preferences payload is missing.");
  }

  return payload.preferences;
}

async function loadNotificationPreferences(fallback: NotificationPreferences): Promise<NotificationPreferences> {
  const response = await fetch("/api/notification-preferences", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    return fallback;
  }

  const payload = await response.json() as { preferences?: NotificationPreferences };

  return payload.preferences ?? fallback;
}

async function createLocalSession(): Promise<{ csrfToken: string }> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Session failed with status ${response.status}.`);
  }

  return await response.json() as { csrfToken: string };
}
