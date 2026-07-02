export const DESKTOP_PREFERENCE_EVENT = "moneysiren:desktop-preference";

export interface DesktopPreferenceEventDetail {
  desktopEnabled: boolean;
}

export function dispatchDesktopPreferenceUpdate(desktopEnabled: boolean): void {
  window.dispatchEvent(new CustomEvent<DesktopPreferenceEventDetail>(DESKTOP_PREFERENCE_EVENT, {
    detail: { desktopEnabled },
  }));
}

export function desktopPreferenceFromEvent(event: Event): boolean | null {
  if (!(event instanceof CustomEvent)) {
    return null;
  }

  const detail = event.detail as Partial<DesktopPreferenceEventDetail> | undefined;

  return typeof detail?.desktopEnabled === "boolean" ? detail.desktopEnabled : null;
}
