"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Cloud,
  Cpu,
  DollarSign,
  ExternalLink,
  Gauge,
  KeyRound,
  RotateCw,
  Server,
  Zap,
} from "lucide-react";
import type { CreditAccuracy, HudItemView, HudViewModel, QuotaItemView } from "../../../packages/view-model/src/hud-model";
import type { Locale } from "../lib/i18n";
import type { NotificationPreferences } from "./NotificationSettingsModel";
import { refreshLocalLive } from "../lib/local-client";
import { openHudDashboardRoute } from "../lib/hud-navigation";
import { HudWindowControls } from "./HudWindowControls";
import { ProviderIcon } from "./ProviderIcon";

const HUD_POLL_INTERVAL_MS = 5 * 60_000;
const HUD_TIME_ZONE = "Asia/Seoul";
const HUD_DETAIL_SEPARATOR = " · ";
const HUD_MINI_WIDTH = 278;
const HUD_MINI_HEIGHT = 38;
const HUD_MINI_MARGIN = 12;
const HUD_RESIZE_EDGE_GUARD_PX = 10;

export interface HudDashboardLabels {
  title: string;
  items: string;
  empty: string;
  ok: string;
  partial: string;
  stale: string;
  error: string;
  freshItems: string;
  staleItems: string;
  errorItems: string;
  generatedAt: string;
  lastSuccessAt: string;
  syncFailed: string;
  refreshFailed: string;
  used: string;
  remaining: string;
  resetAt: string;
  fiveHour: string;
  weekly: string;
  context: string;
  resetCredits: string;
  resetCreditExpiry: string;
  expiresAt: string;
  estimatedExpiry: string;
  unresolvedCredits: string;
  exact: string;
  estimated: string;
  bounded: string;
  unknown: string;
  active: string;
  expiringSoon: string;
  expired: string;
  noExpiry: string;
  openTarget: string;
}

type HudDragWindow = {
  startDragging: () => Promise<void>;
};

type HudMiniWindow = HudDragWindow & {
  outerPosition: () => Promise<unknown>;
  outerSize: () => Promise<unknown>;
  setFocus: () => Promise<void>;
  setPosition: (position: unknown) => Promise<void>;
  setSize: (size: unknown) => Promise<void>;
};

interface HudWindowRestoreState {
  position: unknown;
  size: unknown;
}

interface HudDashboardProps {
  initialModel?: HudViewModel;
  initialPreferences: NotificationPreferences;
  initialSetupOpen?: boolean;
  controlLabels: Parameters<typeof HudWindowControls>[0]["labels"];
  labels: HudDashboardLabels;
  locale: Locale;
}

type HudLabelMode = NotificationPreferences["hud"]["labelMode"];
type HudIconKind = "cost" | "live" | "risk" | "stale" | "tokens" | "quota" | "reset" | "health" | "cloud";

interface HudSummaryPart {
  icon: HudIconKind;
  id: string;
  label: string;
  value: string;
}

export function HudDashboard({
  initialModel,
  initialPreferences,
  initialSetupOpen = false,
  controlLabels,
  labels,
  locale,
}: HudDashboardProps) {
  const [model, setModel] = useState(() => initialModel ?? createEmptyHudViewModel());
  const [polling, setPolling] = useState(initialModel === undefined);
  const [manualRefreshBusy, setManualRefreshBusy] = useState(false);
  const [miniMode, setMiniMode] = useState(false);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [transportError, setTransportError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const restoreStateRef = useRef<HudWindowRestoreState | null>(null);
  const wasRecentDrag = useHudWindowDrag();

  const loadHud = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPolling(true);

    try {
      const response = await fetch("/api/local/hud", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HUD load failed with status ${response.status}.`);
      }

      const payload = await response.json() as unknown;

      if (!isHudViewModel(payload)) {
        throw new Error("HUD payload shape is invalid.");
      }

      setModel(payload);
      setTransportError(null);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setTransportError(labels.refreshFailed);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      setPolling(false);
    }
  }, [labels.refreshFailed]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    const schedule = () => {
      timer = window.setTimeout(async () => {
        await loadHud();

        if (!stopped) {
          schedule();
        }
      }, HUD_POLL_INTERVAL_MS);
    };
    const loadIfVisible = () => {
      if (document.visibilityState !== "hidden") {
        void loadHud();
      }
    };

    void loadHud();
    schedule();
    window.addEventListener("focus", loadIfVisible);
    window.addEventListener("online", loadIfVisible);
    window.addEventListener("moneysiren:live-refresh", loadIfVisible);
    document.addEventListener("visibilitychange", loadIfVisible);

    return () => {
      stopped = true;
      abortRef.current?.abort();

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      window.removeEventListener("focus", loadIfVisible);
      window.removeEventListener("online", loadIfVisible);
      window.removeEventListener("moneysiren:live-refresh", loadIfVisible);
      document.removeEventListener("visibilitychange", loadIfVisible);
    };
  }, [loadHud]);

  useEffect(() => {
    const hudPage = document.querySelector<HTMLElement>(".hud-page");

    hudPage?.classList.toggle("hud-page-mini", miniMode);

    return () => {
      hudPage?.classList.remove("hud-page-mini");
    };
  }, [miniMode]);

  const enterMiniMode = useCallback(async () => {
    const entered = await enterMiniHudWindow(restoreStateRef);

    if (entered) {
      setMiniMode(true);
    }
  }, []);

  const exitMiniMode = useCallback(async () => {
    setMiniMode(false);
    await restoreMiniHudWindow(restoreStateRef);
  }, []);

  const toggleMiniMode = useCallback(async () => {
    if (miniMode) {
      await exitMiniMode();
      return;
    }

    await enterMiniMode();
  }, [enterMiniMode, exitMiniMode, miniMode]);
  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  const displayMode = miniMode ? "singleLine" : preferences.hud.displayMode;
  const itemListClassName = `hud-item-list hud-item-list-${displayMode === "singleLine" ? "single-line" : displayMode}`;

  return (
    <>
      <HudWindowControls
        compactMode={miniMode}
        initialSetupOpen={initialSetupOpen}
        initialPreferences={preferences}
        labels={controlLabels}
        locale={locale}
        onMinimizeRequest={toggleMiniMode}
        onPreferencesChange={(savedPreferences) => {
          setPreferences(savedPreferences);
          void loadHud();
        }}
        onRefresh={() => {
          void handleManualRefresh();
        }}
        refreshBusy={manualRefreshBusy || polling}
      />
      <div className="hud-content">
        <div className="hud-drag-strip" aria-hidden="true" />
        {transportError === null ? null : (
          <div className="hud-inline-error" role="status">
            <AlertTriangle aria-hidden="true" size={13} />
            <span>{transportError}</span>
          </div>
        )}
        <section className={itemListClassName} aria-label={labels.items}>
          {model.items.length === 0 ? (
            miniMode ? (
              <button
                className="hud-empty hud-empty-button"
                onClick={() => {
                  void exitMiniMode();
                }}
                type="button"
              >
                <strong>{polling ? controlLabels.toolLoadingPreparingView : labels.empty}</strong>
              </button>
            ) : (
              <div className="hud-empty">
                <strong>{polling ? controlLabels.toolLoadingPreparingView : labels.empty}</strong>
              </div>
            )
          ) : displayMode === "singleLine" ? (
            <HudSummaryCard
              hudPreferences={preferences.hud}
              items={model.items}
              labels={labels}
              locale={locale}
              miniMode={miniMode}
              modelGeneratedAt={model.generatedAt}
              onMiniRestore={() => {
                void exitMiniMode();
              }}
              wasRecentDrag={wasRecentDrag}
            />
          ) : model.items.map((item) => (
            <HudItemCard
              hudPreferences={preferences.hud}
              item={item}
              key={item.id}
              labels={labels}
              locale={locale}
              modelGeneratedAt={model.generatedAt}
              wasRecentDrag={wasRecentDrag}
            />
          ))}
        </section>
      </div>
      {manualRefreshBusy || polling ? (
        <div className="hud-refresh-indicator" role="status">
          <RotateCw aria-hidden="true" size={12} />
        </div>
      ) : null}
    </>
  );

  async function handleManualRefresh(): Promise<void> {
    setManualRefreshBusy(true);

    try {
      await refreshLocalLive("hud");
      await loadHud();
    } catch {
      setTransportError(labels.refreshFailed);
    } finally {
      setManualRefreshBusy(false);
    }
  }
}

function HudSummaryCard({
  hudPreferences,
  items,
  labels,
  locale,
  miniMode = false,
  modelGeneratedAt,
  onMiniRestore,
  wasRecentDrag,
}: {
  hudPreferences: NotificationPreferences["hud"];
  items: readonly HudItemView[];
  labels: HudDashboardLabels;
  locale: Locale;
  miniMode?: boolean;
  modelGeneratedAt: string;
  onMiniRestore?: () => void;
  wasRecentDrag: () => boolean;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const summaryParts = hudSummaryParts(items, hudPreferences, labels, locale, modelGeneratedAt);

  return (
    <div className={popoverOpen ? "hud-item-shell hud-item-shell-open" : "hud-item-shell"}>
      <button
        aria-expanded={miniMode ? false : popoverOpen}
        className="hud-item hud-item-summary"
        onClick={() => {
          if (wasRecentDrag()) {
            return;
          }

          if (miniMode) {
            onMiniRestore?.();
            return;
          }

          setPopoverOpen((current) => !current);
        }}
        type="button"
      >
        {summaryParts.length === 0 ? (
          <span>{labels.empty}</span>
        ) : (
          <span className={hudPreferences.labelMode === "icon" ? "hud-summary-line hud-summary-line-icons" : "hud-summary-line"}>
            {summaryParts.map((part, index) => (
              <span
                aria-label={`${part.label} ${part.value}`}
                className="hud-summary-token"
                key={part.id}
                title={`${part.label} ${part.value}`}
              >
                {index > 0 ? (
                  <span aria-hidden="true" className="hud-summary-separator">
                    {HUD_DETAIL_SEPARATOR}
                  </span>
                ) : null}
                {hudPreferences.labelMode === "icon" ? (
                  <HudItemIcon kind={part.icon} />
                ) : (
                  <span className="hud-summary-label">{part.label}</span>
                )}
                <span className="hud-summary-value">{part.value}</span>
              </span>
            ))}
          </span>
        )}
      </button>
      {miniMode ? null : <HudItemOpenLink href={`/${locale}/dashboard/overview`} label={labels.openTarget} />}
      {!miniMode && popoverOpen ? (
        <div className="hud-item-popover" data-hud-no-drag role="status">
          {items.map((item) => (
            <span className="hud-sync-detail" key={item.id}>
              {summaryDetail(item, hudPreferences, labels, locale, modelGeneratedAt)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HudItemCard({
  hudPreferences,
  item,
  labels,
  locale,
  modelGeneratedAt,
  wasRecentDrag,
}: {
  hudPreferences: NotificationPreferences["hud"];
  item: HudItemView;
  labels: HudDashboardLabels;
  locale: Locale;
  modelGeneratedAt: string;
  wasRecentDrag: () => boolean;
}) {
  const href = targetHref(item, locale);
  const syncError = item.sync.error?.message ?? null;
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (item.kind === "quota") {
    const windowLabel = quotaWindowLabel(item.window, labels);
    const used = item.progress.usedPercent === null ? labels.unknown : formatPercent(item.progress.usedPercent, locale);
    const remaining = item.progress.remainingPercent === null ? labels.unknown : formatPercent(item.progress.remainingPercent, locale);
    const visibleValue = hudPreferences.showUsagePercent
      ? used
      : hudPreferences.showRemainingPercent
        ? remaining
        : null;

    return (
      <div className={popoverOpen ? "hud-item-shell hud-item-shell-open" : "hud-item-shell"}>
        <button
          aria-expanded={popoverOpen}
          className="hud-item hud-item-rich"
          onClick={() => {
            if (!wasRecentDrag()) {
              setPopoverOpen((current) => !current);
            }
          }}
        type="button"
      >
        <span className="hud-item-copy">
            <strong>
              <HudItemTitle
                icon="quota"
                label={`${providerLabel(item.providerKey)}${HUD_DETAIL_SEPARATOR}${windowLabel}`}
                labelMode={hudPreferences.labelMode}
                providerKey={item.providerKey}
              />
            </strong>
          </span>
          {visibleValue === null ? null : (
            <span className={`hud-value hud-value-${item.riskSeverity}`}>{visibleValue}</span>
          )}
        </button>
        <HudItemOpenLink href={href} label={labels.openTarget} />
        {popoverOpen ? (
          <div className="hud-item-popover" data-hud-no-drag role="status">
            <span><strong>{providerLabel(item.providerKey)}{HUD_DETAIL_SEPARATOR}{windowLabel}</strong></span>
            {hudPreferences.showUsagePercent ? <span>{labels.used}: {used}</span> : null}
            {hudPreferences.showRemainingPercent ? <span>{labels.remaining}: {remaining}</span> : null}
            {item.resetAt === null ? null : <span>{labels.resetAt}: {formatDateTime(item.resetAt, locale)}</span>}
            <HudSyncDetail error={syncError} item={item} labels={labels} locale={locale} />
          </div>
        ) : null}
      </div>
    );
  }

  if (item.kind === "widget") {
    const visibleValue = compactWidgetValue(item, locale);

    return (
      <div className={popoverOpen ? "hud-item-shell hud-item-shell-open" : "hud-item-shell"}>
        <button
          aria-expanded={popoverOpen}
          className="hud-item hud-item-rich"
          onClick={() => {
            if (!wasRecentDrag()) {
              setPopoverOpen((current) => !current);
            }
          }}
        type="button"
      >
        <span className="hud-item-copy">
            <strong>
              <HudItemTitle
                icon={widgetIconKind(item.widgetKey)}
                label={item.label}
                labelMode={hudPreferences.labelMode}
                providerKey={item.providerKey}
              />
            </strong>
          </span>
          <span className={`hud-value hud-value-${item.riskSeverity}`}>{visibleValue}</span>
        </button>
        <HudItemOpenLink href={href} label={labels.openTarget} />
        {popoverOpen ? (
          <div className="hud-item-popover" data-hud-no-drag role="status">
            <span><strong>{item.label}</strong></span>
            <span>{item.value}</span>
            <HudSyncDetail error={syncError} item={item} labels={labels} locale={locale} />
          </div>
        ) : null}
      </div>
    );
  }

  const count = item.availableCount === null ? labels.unknown : new Intl.NumberFormat(locale).format(item.availableCount);
  const expiryValue = item.nearestExpiryAt === null
    ? labels.noExpiry
    : formatRelative(item.nearestExpiryAt, modelGeneratedAt, locale);
  const title = item.variant === "count" ? labels.resetCredits : labels.resetCreditExpiry;
  const value = item.variant === "count" ? count : expiryValue;

  return (
    <div className={popoverOpen ? "hud-item-shell hud-item-shell-open" : "hud-item-shell"}>
      <button
        aria-expanded={popoverOpen}
        className="hud-item hud-item-rich"
        onClick={() => {
          if (!wasRecentDrag()) {
            setPopoverOpen((current) => !current);
          }
        }}
        type="button"
      >
        <span className="hud-item-copy">
          <strong>
            <HudItemTitle
              icon="reset"
              label={`${providerLabel(item.providerKey)} ${HUD_DETAIL_SEPARATOR} ${title}`}
              labelMode={hudPreferences.labelMode}
              providerKey={item.providerKey}
            />
          </strong>
        </span>
        <span className={`hud-value hud-value-${item.riskSeverity}`}>{value}</span>
      </button>
      <HudItemOpenLink href={href} label={labels.openTarget} />
      {popoverOpen ? (
        <div className="hud-item-popover" data-hud-no-drag role="status">
          <span><strong>{providerLabel(item.providerKey)} · {title}</strong></span>
          <span>{labels.resetCredits}: {count}</span>
          <span>
            {accuracyLabel(item.accuracy, labels)}
            {item.unresolvedCount > 0 ? ` · ${labels.unresolvedCredits}: ${item.unresolvedCount}` : ""}
          </span>
          {item.credits.length === 0 ? (
            <span>{labels.noExpiry}</span>
          ) : item.credits.map((credit) => (
            <span className="hud-credit-row" key={credit.itemKey}>
              <Clock aria-hidden="true" size={11} />
              <span>{creditLabel(credit.status, labels)}</span>
              <span>{creditTimeLabel(credit, labels, locale)}</span>
            </span>
          ))}
          <HudSyncDetail error={syncError} item={item} labels={labels} locale={locale} />
        </div>
      ) : null}
    </div>
  );
}

function HudItemTitle({
  icon,
  label,
  labelMode,
  providerKey,
}: {
  icon: HudIconKind;
  label: string;
  labelMode: HudLabelMode;
  providerKey?: string | null;
}) {
  if (labelMode === "icon") {
    return (
      <span aria-label={label} className="hud-icon-title" title={label}>
        {providerKey === null || providerKey === undefined ? (
          <HudItemIcon kind={icon} />
        ) : (
          <ProviderIcon
            className={`hud-provider-icon provider-mark provider-mark-${providerKey}`}
            providerKey={providerKey}
          />
        )}
        <span className="hud-sr-only">{label}</span>
      </span>
    );
  }

  return <>{label}</>;
}

function HudItemIcon({ kind }: { kind: HudIconKind }) {
  const props = {
    "aria-hidden": true,
    className: "hud-item-icon",
    size: 13,
    strokeWidth: 1.9,
  } as const;

  if (kind === "cost") {
    return <DollarSign {...props} />;
  }

  if (kind === "live") {
    return <Zap {...props} />;
  }

  if (kind === "risk") {
    return <AlertTriangle {...props} />;
  }

  if (kind === "stale") {
    return <Clock {...props} />;
  }

  if (kind === "tokens") {
    return <Cpu {...props} />;
  }

  if (kind === "quota") {
    return <Gauge {...props} />;
  }

  if (kind === "reset") {
    return <KeyRound {...props} />;
  }

  if (kind === "health") {
    return <Server {...props} />;
  }

  if (kind === "cloud") {
    return <Cloud {...props} />;
  }

  return <CalendarDays {...props} />;
}

function HudItemOpenLink({ href, label }: { href: string; label: string }) {
  return (
    <button
      aria-label={label}
      className="hud-item-open-link"
      data-hud-no-drag
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void openHudDashboardRoute(href);
      }}
      title={label}
      type="button"
    >
      <ExternalLink aria-hidden="true" size={13} strokeWidth={1.9} />
    </button>
  );
}

function HudSyncDetail({
  error,
  item,
  labels,
  locale,
}: {
  error: string | null;
  item: HudItemView;
  labels: HudDashboardLabels;
  locale: Locale;
}) {
  if (error !== null) {
    return <span className="hud-sync-detail hud-sync-detail-error">{labels.syncFailed}: {error}</span>;
  }

  if (item.sync.lastSuccessAt === null) {
    return null;
  }

  return <span className="hud-sync-detail">{labels.lastSuccessAt}: {formatDateTime(item.sync.lastSuccessAt, locale)}</span>;
}

async function enterMiniHudWindow(restoreStateRef: { current: HudWindowRestoreState | null }): Promise<boolean> {
  const hudWindow = await getCurrentHudMiniWindow();

  if (hudWindow === null || typeof window === "undefined") {
    return false;
  }

  try {
    if (restoreStateRef.current === null) {
      restoreStateRef.current = {
        position: await hudWindow.outerPosition(),
        size: await hudWindow.outerSize(),
      };
    }

    const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
    const target = bottomRightMiniHudPosition(HUD_MINI_WIDTH, HUD_MINI_HEIGHT);

    await hudWindow.setSize(new LogicalSize(HUD_MINI_WIDTH, HUD_MINI_HEIGHT));
    await hudWindow.setPosition(new LogicalPosition(target.x, target.y));
    await hudWindow.setFocus();

    return true;
  } catch (error) {
    console.warn("MoneySiren HUD mini mode failed.", error);
    return false;
  }
}

async function restoreMiniHudWindow(restoreStateRef: { current: HudWindowRestoreState | null }): Promise<void> {
  const hudWindow = await getCurrentHudMiniWindow();
  const restoreState = restoreStateRef.current;
  restoreStateRef.current = null;

  if (hudWindow === null || restoreState === null) {
    return;
  }

  try {
    await hudWindow.setSize(restoreState.size);
    await hudWindow.setPosition(restoreState.position);
    await hudWindow.setFocus();
  } catch (error) {
    console.warn("MoneySiren HUD restore failed.", error);
  }
}

function bottomRightMiniHudPosition(width: number, height: number): { x: number; y: number } {
  const screenInfo = window.screen as Screen & {
    availLeft?: number;
    availTop?: number;
  };
  const left = screenInfo.availLeft ?? 0;
  const top = screenInfo.availTop ?? 0;
  const availableWidth = Math.max(width, screenInfo.availWidth);
  const availableHeight = Math.max(height, screenInfo.availHeight);

  return {
    x: Math.max(left, left + availableWidth - width - HUD_MINI_MARGIN),
    y: Math.max(top, top + availableHeight - height - HUD_MINI_MARGIN),
  };
}

async function getCurrentHudMiniWindow(): Promise<HudMiniWindow | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");

    return getCurrentWindow() as HudMiniWindow;
  } catch {
    return null;
  }
}

function isHudViewModel(value: unknown): value is HudViewModel {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<HudViewModel>;

  return record.localOnly === true &&
    record.secretsReturned === false &&
    typeof record.generatedAt === "string" &&
    Array.isArray(record.items) &&
    typeof record.sync === "object" &&
    record.sync !== null;
}

function createEmptyHudViewModel(): HudViewModel {
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    localOnly: true,
    secretsReturned: false,
    dataRevision: `empty:${generatedAt}`,
    sync: {
      status: "empty",
      freshCount: 0,
      staleCount: 0,
      errorCount: 0,
      neutralCount: 0,
      lastSuccessAt: null,
    },
    risk: {
      severity: "info",
      warningCount: 0,
      criticalCount: 0,
    },
    items: [],
  };
}

function useHudWindowDrag(): () => boolean {
  const dragStartRef = useRef<{ x: number; y: number; started: boolean } | null>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".hud-page");

    if (root === null) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || shouldSkipHudDrag(event)) {
        dragStartRef.current = null;
        return;
      }

      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        started: false,
      };
    };
    const handlePointerMove = (event: PointerEvent) => {
      const start = dragStartRef.current;

      if (start === null || start.started) {
        return;
      }

      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) {
        return;
      }

      start.started = true;
      suppressClickUntilRef.current = Date.now() + 700;
      void startHudWindowDrag();
    };
    const clearDrag = () => {
      dragStartRef.current = null;
    };

    root.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", clearDrag, { capture: true });
    window.addEventListener("pointercancel", clearDrag, { capture: true });

    return () => {
      root.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", clearDrag, { capture: true });
      window.removeEventListener("pointercancel", clearDrag, { capture: true });
    };
  }, []);

  return useCallback(() => Date.now() < suppressClickUntilRef.current, []);
}

function shouldSkipHudDrag(event: PointerEvent): boolean {
  const target = event.target;

  if (isHudResizeEdgePointer(event)) {
    return true;
  }

  return target instanceof Element &&
    target.closest("[data-hud-no-drag], .hud-window-controls, .hud-settings-popover, input, select, textarea") !== null;
}

function isHudResizeEdgePointer(event: PointerEvent): boolean {
  const width = window.innerWidth;
  const height = window.innerHeight;

  return event.clientX <= HUD_RESIZE_EDGE_GUARD_PX ||
    width - event.clientX <= HUD_RESIZE_EDGE_GUARD_PX ||
    event.clientY <= HUD_RESIZE_EDGE_GUARD_PX ||
    height - event.clientY <= HUD_RESIZE_EDGE_GUARD_PX;
}

async function startHudWindowDrag(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await (getCurrentWindow() as HudDragWindow).startDragging();
  } catch {
    // Browser-only HUD previews do not have the Tauri window API.
  }
}

function targetHref(item: HudItemView, locale: Locale): string {
  if (item.target.type === "path") {
    return localizePath(item.target.path, locale);
  }

  if (item.target.type === "service" && item.target.providerKey !== undefined) {
    return `/${locale}/services/${item.target.providerKey}`;
  }

  return `/${locale}/dashboard/overview`;
}

function localizePath(path: string, locale: Locale): string {
  if (path.startsWith("/ko/") || path.startsWith("/en/") || path.startsWith("/ja/")) {
    return `/${locale}${path.slice(3)}`;
  }

  return path.startsWith("/") ? path : `/${locale}/dashboard/overview`;
}

function providerLabel(providerKey: string): string {
  if (providerKey === "codex-app" || providerKey === "codex-cli") {
    return "Codex";
  }

  if (providerKey === "claude-app") {
    return "Claude App";
  }

  if (providerKey === "claude-cli") {
    return "Claude CLI";
  }

  if (providerKey === "antigravity") {
    return "Antigravity";
  }

  return providerKey;
}

function hudSummaryParts(
  items: readonly HudItemView[],
  hudPreferences: NotificationPreferences["hud"],
  labels: HudDashboardLabels,
  locale: Locale,
  modelGeneratedAt: string,
): HudSummaryPart[] {
  return items.map((item): HudSummaryPart => {
    if (item.kind === "quota") {
      const percent = hudPreferences.showRemainingPercent
        ? item.progress.remainingPercent
        : item.progress.usedPercent;

      return {
        icon: "quota",
        id: item.id,
        label: `${providerLabel(item.providerKey)} ${quotaWindowLabel(item.window, labels)}`,
        value: percent === null ? labels.unknown : formatPercent(percent, locale),
      };
    }

    if (item.kind === "credit_pool") {
      if (item.variant === "count") {
        return {
          icon: "reset",
          id: item.id,
          label: `${providerLabel(item.providerKey)} ${labels.resetCredits}`,
          value: item.availableCount === null ? labels.unknown : new Intl.NumberFormat(locale).format(item.availableCount),
        };
      }

      return {
        icon: "reset",
        id: item.id,
        label: `${providerLabel(item.providerKey)} ${labels.resetCreditExpiry}`,
        value: item.nearestExpiryAt === null ? labels.noExpiry : formatRelative(item.nearestExpiryAt, modelGeneratedAt, locale),
      };
    }

    return {
      icon: widgetIconKind(item.widgetKey),
      id: item.id,
      label: item.label,
      value: compactWidgetValue(item, locale),
    };
  });
}

function widgetIconKind(widgetKey: Extract<HudItemView, { kind: "widget" }>["widgetKey"]): HudIconKind {
  if (widgetKey === "month_forecast" || widgetKey === "aws_month_forecast" || widgetKey === "openai_today_cost" || widgetKey === "cloudflare_month_to_date") {
    return "cost";
  }

  if (widgetKey === "today_live_cost") {
    return "live";
  }

  if (widgetKey === "risk_high_count") {
    return "risk";
  }

  if (widgetKey === "stale_connection_count") {
    return "stale";
  }

  if (widgetKey === "openai_today_tokens" || widgetKey === "codex_total_tokens") {
    return "tokens";
  }

  if (widgetKey === "codex_five_hour_percent" || widgetKey === "codex_weekly_percent" || widgetKey === "claude_five_hour_percent" || widgetKey === "claude_weekly_percent") {
    return "quota";
  }

  if (widgetKey === "codex_reset_credit_count" || widgetKey === "codex_reset_credit_expiry") {
    return "reset";
  }

  if (widgetKey === "supabase_usage_health") {
    return "health";
  }

  return "cloud";
}

function compactWidgetValue(
  item: Extract<HudItemView, { kind: "widget" }>,
  locale: Locale,
): string {
  if (item.numericValue !== null) {
    if (isCurrencyUnit(item.unit)) {
      return compactAmount(item.numericValue / 100, item.unit, locale);
    }

    if (item.unit === "tokens") {
      return compactNumber(item.numericValue, locale);
    }

    if (item.unit === "count") {
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(item.numericValue);
    }

    if (item.unit === "percent") {
      return formatPercent(item.numericValue, locale);
    }
  }

  const amount = parseDigestAmount(item.value);

  if (amount !== null) {
    return compactAmount(amount.amountMajor, amount.currency, locale);
  }

  return item.value === "Not available" ? "N/A" : item.value;
}

function parseDigestAmount(value: string): { currency: string; amountMajor: number } | null {
  const match = /^([A-Z]{3})\s+(-?\d+(?:\.\d+)?)$/.exec(value.trim());

  if (match === null) {
    return null;
  }

  const currency = match[1];
  const amountText = match[2];

  if (currency === undefined || amountText === undefined) {
    return null;
  }

  const amountMajor = Number(amountText);

  return Number.isFinite(amountMajor)
    ? {
        currency,
        amountMajor,
      }
    : null;
}

function isCurrencyUnit(value: string | null): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function compactAmount(amountMajor: number, currency: string, locale: Locale): string {
  const maximumFractionDigits = Math.abs(amountMajor) < 1 ? 2 : Math.abs(amountMajor) < 100 ? 1 : 0;
  const amount = new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(amountMajor);

  return currency === "USD" ? `$${amount}` : `${currency} ${amount}`;
}

function compactNumber(value: number, locale: Locale): string {
  const absolute = Math.abs(value);
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });

  if (absolute >= 1_000_000) {
    return `${formatter.format(value / 1_000_000)}m`;
  }

  if (absolute >= 1_000) {
    return `${formatter.format(value / 1_000)}k`;
  }

  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function summaryDetail(
  item: HudItemView,
  hudPreferences: NotificationPreferences["hud"],
  labels: HudDashboardLabels,
  locale: Locale,
  modelGeneratedAt: string,
): string {
  if (item.kind === "quota") {
    const used = item.progress.usedPercent === null ? labels.unknown : formatPercent(item.progress.usedPercent, locale);
    const remaining = item.progress.remainingPercent === null ? labels.unknown : formatPercent(item.progress.remainingPercent, locale);
    const summaryParts = [
      hudPreferences.showUsagePercent ? `${labels.used}: ${used}` : null,
      hudPreferences.showRemainingPercent ? `${labels.remaining}: ${remaining}` : null,
    ].filter((part): part is string => part !== null);

    return [
      providerLabel(item.providerKey),
      quotaWindowLabel(item.window, labels),
      summaryParts.length === 0 ? `${labels.used}: ${used}` : summaryParts.join(HUD_DETAIL_SEPARATOR),
      item.resetAt === null ? null : `${labels.resetAt}: ${formatDateTime(item.resetAt, locale)}`,
    ].filter((part): part is string => part !== null).join(HUD_DETAIL_SEPARATOR);
  }

  if (item.kind === "widget") {
    return [
      item.label,
      item.value,
      item.providerKey,
    ].filter((part): part is string => part !== null).join(HUD_DETAIL_SEPARATOR);
  }

  const count = item.availableCount === null ? labels.unknown : new Intl.NumberFormat(locale).format(item.availableCount);
  const expiry = item.nearestExpiryAt === null
    ? labels.noExpiry
    : formatRelative(item.nearestExpiryAt, modelGeneratedAt, locale);

  return [
    providerLabel(item.providerKey),
    item.variant === "count" ? labels.resetCredits : labels.resetCreditExpiry,
    `${labels.resetCredits}: ${count}`,
    expiry,
    accuracyLabel(item.accuracy, labels),
  ].join(HUD_DETAIL_SEPARATOR);
}

function quotaWindowLabel(window: QuotaItemView["window"], labels: HudDashboardLabels): string {
  if (window === "five_hour") {
    return labels.fiveHour;
  }

  if (window === "weekly") {
    return labels.weekly;
  }

  return labels.context;
}

function accuracyLabel(value: CreditAccuracy, labels: HudDashboardLabels): string {
  if (value === "exact") {
    return labels.exact;
  }

  if (value === "estimated") {
    return labels.estimated;
  }

  if (value === "bounded") {
    return labels.bounded;
  }

  return labels.unknown;
}

function creditLabel(value: "active" | "expiring_soon" | "expired" | "unknown", labels: HudDashboardLabels): string {
  if (value === "active") {
    return labels.active;
  }

  if (value === "expiring_soon") {
    return labels.expiringSoon;
  }

  if (value === "expired") {
    return labels.expired;
  }

  return labels.unknown;
}

function creditTimeLabel(
  credit: Extract<HudItemView, { kind: "credit_pool" }>["credits"][number],
  labels: HudDashboardLabels,
  locale: Locale,
): string {
  if (credit.expiresAt !== null) {
    return `${labels.expiresAt}: ${formatDateTime(credit.expiresAt, locale)}`;
  }

  if (credit.estimatedEarliestAt !== null && credit.estimatedLatestAt !== null) {
    return `${labels.estimatedExpiry}: ${formatDateTime(credit.estimatedEarliestAt, locale)} - ${formatDateTime(credit.estimatedLatestAt, locale)}`;
  }

  if (credit.estimatedEarliestAt !== null) {
    return `${labels.estimatedExpiry}: ${formatDateTime(credit.estimatedEarliestAt, locale)}`;
  }

  return labels.noExpiry;
}

function syncStatusLabel(status: HudViewModel["sync"]["status"], labels: HudDashboardLabels): string {
  if (status === "ok") {
    return labels.ok;
  }

  if (status === "partial") {
    return labels.partial;
  }

  if (status === "stale") {
    return labels.stale;
  }

  if (status === "error") {
    return labels.error;
  }

  return labels.empty;
}

function syncStatusBadgeClass(status: HudViewModel["sync"]["status"]): string {
  if (status === "ok") {
    return "badge-ok";
  }

  if (status === "error") {
    return "badge-critical";
  }

  if (status === "partial" || status === "stale") {
    return "badge-warn";
  }

  return "badge-neutral";
}

function formatPercent(value: number, locale: Locale): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)}%`;
}

function formatDateTime(value: string, locale: Locale): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: HUD_TIME_ZONE,
  }).format(date);
}

function formatRelative(value: string, base: string, locale: Locale): string {
  const target = Date.parse(value);
  const now = Date.parse(base);

  if (!Number.isFinite(target) || !Number.isFinite(now)) {
    return value;
  }

  const seconds = Math.round((target - now) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds >= 86_400) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(Math.round(seconds / 86_400), "day");
  }

  if (absSeconds >= 3_600) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(Math.round(seconds / 3_600), "hour");
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(Math.round(seconds / 60), "minute");
}
