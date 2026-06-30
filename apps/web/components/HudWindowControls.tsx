"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Pin, PinOff, RefreshCw, Save, Settings, X } from "lucide-react";
import type { Locale } from "../lib/i18n";
import { openHudDashboardRoute } from "../lib/hud-navigation";
import {
  HUD_BACKGROUND_NONE,
  HUD_DISPLAY_MODES,
  type HudDisplayMode,
  type NotificationPreferences,
} from "./NotificationSettingsModel";
import { withAppLoading } from "./AppLoadingOverlay";

type SaveState = "idle" | "saving" | "saved" | "error";
type HudWindowAction = "close" | "minimize";
const DEFAULT_HUD_BACKGROUND_COLOR = "#ffffff";

interface HudWindowControlsProps {
  compactMode?: boolean;
  initialPreferences: NotificationPreferences;
  initialSetupOpen?: boolean;
  labels: {
    alwaysOnTop: string;
    backgroundColor: string;
    backgroundNone: string;
    close: string;
    displayMode: string;
    displayModeCells: string;
    displayModeRows: string;
    displayModeSingleLine: string;
    error: string;
    fontColor: string;
    fontSize: string;
    minimize: string;
    opacity: string;
    padding: string;
    refresh: string;
    rowHeight: string;
    save: string;
    saved: string;
    settings: string;
    showRemainingPercent: string;
    showUsagePercent: string;
    toolLoadingPreparingView: string;
  };
  locale: Locale;
  onMinimizeRequest?: () => Promise<void> | void;
  onRefresh?: () => void;
  refreshBusy?: boolean;
}

interface TauriWindow {
  close: () => Promise<void>;
  hide: () => Promise<void>;
  isAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
}

export function HudWindowControls({
  compactMode = false,
  initialPreferences,
  initialSetupOpen = false,
  labels,
  locale,
  onMinimizeRequest,
  onRefresh,
  refreshBusy = false,
}: HudWindowControlsProps) {
  const router = useRouter();
  const [controlsOpen, setControlsOpen] = useState(initialSetupOpen);
  const [draftAlwaysOnTop, setDraftAlwaysOnTop] = useState(initialPreferences.hud.alwaysOnTop);
  const [draftBackgroundColor, setDraftBackgroundColor] = useState(initialPreferences.hud.backgroundColor);
  const [draftDisplayMode, setDraftDisplayMode] = useState<HudDisplayMode>(initialPreferences.hud.displayMode);
  const [draftFontColor, setDraftFontColor] = useState(initialPreferences.hud.fontColor);
  const [draftFontScale, setDraftFontScale] = useState(initialPreferences.hud.fontScale);
  const [draftOpacity, setDraftOpacity] = useState(initialPreferences.hud.opacity);
  const [draftPadding, setDraftPadding] = useState(initialPreferences.hud.padding);
  const [draftRowHeight, setDraftRowHeight] = useState(initialPreferences.hud.rowHeight);
  const [draftShowRemainingPercent, setDraftShowRemainingPercent] = useState(initialPreferences.hud.showRemainingPercent);
  const [draftShowUsagePercent, setDraftShowUsagePercent] = useState(initialPreferences.hud.showUsagePercent);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const controlsLayerRef = useRef<HTMLDivElement | null>(null);
  const draftBackgroundNone = draftBackgroundColor === HUD_BACKGROUND_NONE;
  const draftPercentModeIsRemaining = draftShowRemainingPercent && !draftShowUsagePercent;

  useEffect(() => {
    if (compactMode) {
      setControlsOpen(false);
    }
  }, [compactMode]);

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
    setDraftBackgroundColor(initialPreferences.hud.backgroundColor);
    setDraftDisplayMode(initialPreferences.hud.displayMode);
    setDraftFontColor(initialPreferences.hud.fontColor);
    setDraftFontScale(initialPreferences.hud.fontScale);
    setDraftOpacity(initialPreferences.hud.opacity);
    setDraftPadding(initialPreferences.hud.padding);
    setDraftRowHeight(initialPreferences.hud.rowHeight);
    setDraftShowRemainingPercent(initialPreferences.hud.showRemainingPercent);
    setDraftShowUsagePercent(initialPreferences.hud.showUsagePercent);
    setSaveState("idle");
  }, [
    initialPreferences.hud.alwaysOnTop,
    initialPreferences.hud.backgroundColor,
    initialPreferences.hud.displayMode,
    initialPreferences.hud.fontColor,
    initialPreferences.hud.fontScale,
    initialPreferences.hud.opacity,
    initialPreferences.hud.padding,
    initialPreferences.hud.rowHeight,
    initialPreferences.hud.showRemainingPercent,
    initialPreferences.hud.showUsagePercent,
  ]);

  useEffect(() => {
    const hudPage = document.querySelector<HTMLElement>(".hud-page");

    hudPage?.style.setProperty("--hud-background-color", draftBackgroundColor);
    hudPage?.style.setProperty("--hud-font-color", draftFontColor);
    hudPage?.style.setProperty("--hud-font-scale", String(draftFontScale));
    hudPage?.style.setProperty("--hud-opacity", String(draftOpacity));
    hudPage?.style.setProperty("--hud-padding", `${draftPadding}px`);
    hudPage?.style.setProperty("--hud-row-height", `${draftRowHeight}px`);
  }, [draftBackgroundColor, draftFontColor, draftFontScale, draftOpacity, draftPadding, draftRowHeight]);

  useEffect(() => {
    if (!controlsOpen) {
      return;
    }

    const closeWhenOutside = (event: Event) => {
      const target = event.target;

      if (target instanceof Node && controlsLayerRef.current?.contains(target)) {
        return;
      }

      setControlsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setControlsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeWhenOutside, { capture: true });
    document.addEventListener("click", closeWhenOutside, { capture: true });
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside, { capture: true });
      document.removeEventListener("click", closeWhenOutside, { capture: true });
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [controlsOpen]);

  return (
    <>
      <div ref={controlsLayerRef}>
        <div className="hud-window-controls" aria-label={labels.settings}>
          <button
            aria-label={labels.refresh}
            aria-busy={refreshBusy}
            className="hud-control-button"
            disabled={refreshBusy}
            onClick={() => {
              if (onRefresh === undefined) {
                router.refresh();
                return;
              }

              onRefresh();
            }}
            title={labels.refresh}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.9} />
          </button>
          <button
            aria-expanded={controlsOpen}
            aria-label={labels.settings}
            aria-pressed={controlsOpen}
            className={controlsOpen ? "hud-control-button hud-control-button-active" : "hud-control-button"}
            data-state={controlsOpen ? "open" : "closed"}
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
              if (onMinimizeRequest !== undefined) {
                void onMinimizeRequest();
                return;
              }

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
          <>
            <button
              aria-label={labels.close}
              className="hud-settings-dismiss-layer"
              data-hud-no-drag
              onClick={() => setControlsOpen(false)}
              tabIndex={-1}
              type="button"
            />
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
          <label className="hud-toggle-row">
            <input
              checked={draftPercentModeIsRemaining}
              onChange={(event) => {
                const showRemaining = event.currentTarget.checked;
                setDraftShowRemainingPercent(showRemaining);
                setDraftShowUsagePercent(!showRemaining);
                setSaveState("idle");
              }}
              type="checkbox"
            />
            <span className="toggle-switch" aria-hidden="true" />
            <span>{draftPercentModeIsRemaining ? labels.showRemainingPercent : labels.showUsagePercent}</span>
          </label>
          <label className="hud-select-row">
            <span>{labels.displayMode}</span>
            <select
              onChange={(event) => {
                setDraftDisplayMode(event.currentTarget.value as HudDisplayMode);
                setSaveState("idle");
              }}
              value={draftDisplayMode}
            >
              {HUD_DISPLAY_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {hudDisplayModeLabel(mode, labels)}
                </option>
              ))}
            </select>
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
          <label className="hud-color-row">
            <span>{labels.fontColor}</span>
            <input
              onChange={(event) => {
                setDraftFontColor(event.currentTarget.value);
                setSaveState("idle");
              }}
              type="color"
              value={draftFontColor}
            />
            <strong>{draftFontColor}</strong>
          </label>
          <label className="hud-color-row">
            <span>{labels.backgroundColor}</span>
            <input
              disabled={draftBackgroundNone}
              onChange={(event) => {
                setDraftBackgroundColor(event.currentTarget.value);
                setSaveState("idle");
              }}
              type="color"
              value={draftBackgroundNone ? DEFAULT_HUD_BACKGROUND_COLOR : draftBackgroundColor}
            />
            <strong>{draftBackgroundNone ? labels.backgroundNone : draftBackgroundColor}</strong>
          </label>
          <label className="hud-toggle-row hud-background-none-row">
            <input
              checked={draftBackgroundNone}
              onChange={(event) => {
                setDraftBackgroundColor(event.currentTarget.checked ? HUD_BACKGROUND_NONE : DEFAULT_HUD_BACKGROUND_COLOR);
                setSaveState("idle");
              }}
              type="checkbox"
            />
            <span className="toggle-switch" aria-hidden="true" />
            <span>{labels.backgroundNone}</span>
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
          <label className="hud-range-row">
            <span>{labels.rowHeight}</span>
            <input
              max="76"
              min="28"
              onChange={(event) => {
                setDraftRowHeight(Number(event.currentTarget.value));
                setSaveState("idle");
              }}
              step="2"
              type="range"
              value={draftRowHeight}
            />
            <strong>{draftRowHeight}px</strong>
          </label>
          <label className="hud-range-row">
            <span>{labels.padding}</span>
            <input
              max="18"
              min="0"
              onChange={(event) => {
                setDraftPadding(Number(event.currentTarget.value));
                setSaveState("idle");
              }}
              step="1"
              type="range"
              value={draftPadding}
            />
            <strong>{draftPadding}px</strong>
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
          <button
            className="hud-settings-link"
            data-hud-no-drag
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void openNotificationSettings(locale);
            }}
            type="button"
          >
            <Settings aria-hidden="true" size={13} strokeWidth={1.9} />
            <span>{labels.settings}</span>
          </button>
          {saveState === "saved" ? (
            <span className="hud-save-status">
              <Check aria-hidden="true" size={12} strokeWidth={2} />
              {labels.saved}
            </span>
          ) : null}
          {saveState === "error" ? <span className="hud-save-status hud-save-status-error">{labels.error}</span> : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  );

  async function saveHudSettings() {
    await withAppLoading(labels.toolLoadingPreparingView, async () => {
      setSaveState("saving");

      try {
        const savedPreferences = await saveHudPreferences(initialPreferences, {
          alwaysOnTop: draftAlwaysOnTop,
          backgroundColor: draftBackgroundColor,
          displayMode: draftDisplayMode,
          fontColor: draftFontColor,
          fontScale: draftFontScale,
          opacity: draftOpacity,
          padding: draftPadding,
          rowHeight: draftRowHeight,
          showRemainingPercent: draftPercentModeIsRemaining,
          showUsagePercent: !draftPercentModeIsRemaining,
        });
        void applyAlwaysOnTop(savedPreferences.hud.alwaysOnTop);
        router.refresh();
        setSaveState("saved");
      } catch (error) {
        console.error("MoneySiren HUD settings save failed.", error);
        setSaveState("error");
      }
    });
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

async function openNotificationSettings(locale: Locale): Promise<void> {
  const routePath = `/${locale}/settings/notifications`;
  const openedExternally = await openHudDashboardRoute(routePath, { preopenFallback: true });

  if (openedExternally || typeof window === "undefined") {
    return;
  }

  const targetUrl = new URL(routePath, window.location.origin);
  const opened = window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");

  opened?.focus();
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
  hudPreferences: Pick<
    NotificationPreferences["hud"],
    | "alwaysOnTop"
    | "backgroundColor"
    | "displayMode"
    | "fontColor"
    | "fontScale"
    | "opacity"
    | "padding"
    | "rowHeight"
    | "showRemainingPercent"
    | "showUsagePercent"
  >,
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

function hudDisplayModeLabel(
  mode: HudDisplayMode,
  labels: HudWindowControlsProps["labels"],
): string {
  if (mode === "cells") {
    return labels.displayModeCells;
  }

  if (mode === "singleLine") {
    return labels.displayModeSingleLine;
  }

  return labels.displayModeRows;
}
