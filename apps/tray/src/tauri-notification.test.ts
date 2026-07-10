import { describe, expect, it } from "vitest";
import {
  createTauriDesktopNotificationTransport,
  installTauriNotificationClickHandler,
  isSafeLocalNotificationPath,
  type TauriNotificationPlugin,
} from "./tauri-notification.js";

function fakePlugin(overrides: Partial<TauriNotificationPlugin> = {}): TauriNotificationPlugin {
  return {
    async isPermissionGranted() {
      return true;
    },
    async requestPermission() {
      return "granted";
    },
    sendNotification() {},
    async onAction() {
      return {
        async unregister() {},
      };
    },
    ...overrides,
  };
}

describe("Tauri notification bridge", () => {
  it("checks permission and sends bounded text with a local-only click path", async () => {
    const sent: unknown[] = [];
    const transport = createTauriDesktopNotificationTransport(fakePlugin({
      sendNotification(options) {
        sent.push(options);
      },
    }));

    expect(await transport.permission()).toBe("granted");
    await transport.send({
      title: " MoneySiren ",
      body: " one   normalized alert ",
      clickPath: "/dashboard/risks",
    });

    expect(sent).toEqual([{
      title: "MoneySiren",
      body: "one normalized alert",
      extra: { clickPath: "/dashboard/risks" },
    }]);
  });

  it("rejects external and traversal click targets", async () => {
    expect(isSafeLocalNotificationPath("/dashboard/risks")).toBe(true);
    expect(isSafeLocalNotificationPath("https://example.invalid")).toBe(false);
    expect(isSafeLocalNotificationPath("//example.invalid/path")).toBe(false);
    expect(isSafeLocalNotificationPath("/dashboard/../secret")).toBe(false);

    const transport = createTauriDesktopNotificationTransport(fakePlugin());
    await expect(transport.send({
      title: "MoneySiren",
      body: "Alert",
      clickPath: "https://example.invalid",
    })).rejects.toThrow("NOTIFICATION_CLICK_PATH_REJECTED");
  });

  it("opens only the sanitized local path from notification actions", async () => {
    const opened: string[] = [];
    let action: ((notification: { extra?: Record<string, unknown> }) => void) | undefined;
    const plugin = fakePlugin({
      async onAction(callback) {
        action = callback;
        return { async unregister() {} };
      },
    });

    await installTauriNotificationClickHandler((path) => {
      opened.push(path);
    }, plugin);
    action?.({ extra: { clickPath: "https://example.invalid" } });
    action?.({ extra: { clickPath: "/dashboard/risks" } });

    expect(opened).toEqual(["/dashboard/risks"]);
  });
});
