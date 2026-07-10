import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

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

const DEFAULT_PLUGIN: TauriNotificationPlugin = {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  onAction,
};

export function createTauriDesktopNotificationTransport(
  plugin: TauriNotificationPlugin = DEFAULT_PLUGIN,
) {
  return {
    async permission() {
      return await plugin.isPermissionGranted() ? "granted" as const : "prompt" as const;
    },
    async requestPermission() {
      const permission = await plugin.requestPermission();
      return permission === "prompt-with-rationale" ? "prompt" as const : permission;
    },
    async send(request: { title: string; body: string; clickPath: string }) {
      if (!isSafeLocalNotificationPath(request.clickPath)) {
        throw new Error("NOTIFICATION_CLICK_PATH_REJECTED");
      }

      plugin.sendNotification({
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
  plugin: TauriNotificationPlugin = DEFAULT_PLUGIN,
): Promise<() => Promise<void>> {
  const listener = await plugin.onAction((notification) => {
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
