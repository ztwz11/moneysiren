export interface TauriNotificationPlugin {
  isPermissionGranted(): Promise<boolean>;
  requestPermission(): Promise<"granted" | "denied" | "prompt" | "prompt-with-rationale">;
  sendNotification(options: {
    title: string;
    body: string;
    extra: Record<string, string>;
  }): void;
  onAction(callback: (notification: {
    extra?: Record<string, unknown>;
  }) => void): Promise<{ unregister(): Promise<void> }>;
}

function defaultPlugin(): TauriNotificationPlugin {
  const tauri = (globalThis as {
    window?: {
      __TAURI__?: {
        notification?: TauriNotificationPlugin;
      };
    };
  }).window?.__TAURI__?.notification;

  if (tauri === undefined) {
    throw new Error("TAURI_NOTIFICATION_PLUGIN_UNAVAILABLE");
  }

  return tauri;
}

export function createTauriDesktopNotificationTransport(
  plugin?: TauriNotificationPlugin,
) {
  return {
    async permission() {
      return await (plugin ?? defaultPlugin()).isPermissionGranted() ? "granted" as const : "prompt" as const;
    },
    async requestPermission() {
      const permission = await (plugin ?? defaultPlugin()).requestPermission();
      return permission === "prompt-with-rationale" ? "prompt" as const : permission;
    },
    async send(request: { title: string; body: string; clickPath: string }) {
      if (!isSafeLocalNotificationPath(request.clickPath)) {
        throw new Error("NOTIFICATION_CLICK_PATH_REJECTED");
      }

      (plugin ?? defaultPlugin()).sendNotification({
        title: boundedText(request.title, 80),
        body: boundedText(request.body, 240),
        extra: {
          clickPath: request.clickPath,
        },
      });
    },
  };
}

export async function installTauriNotificationClickHandler(
  openLocalPath: (path: string) => Promise<void> | void,
  plugin?: TauriNotificationPlugin,
): Promise<() => Promise<void>> {
  const listener = await (plugin ?? defaultPlugin()).onAction((notification) => {
    const clickPath = notification.extra?.clickPath;

    if (typeof clickPath === "string" && isSafeLocalNotificationPath(clickPath)) {
      void openLocalPath(clickPath);
    }
  });

  return () => listener.unregister();
}

export function isSafeLocalNotificationPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return false;
  }

  if (value.includes("://") || value.includes("..") || value.includes("?") || value.includes("#")) {
    return false;
  }

  return ![...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function boundedText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    throw new Error("NOTIFICATION_TEXT_EMPTY");
  }

  return normalized.slice(0, maxLength);
}
