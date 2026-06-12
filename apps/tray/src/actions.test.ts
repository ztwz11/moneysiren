import { describe, expect, it } from "vitest";
import { buildTrayActions, DEFAULT_TRAY_ACTIONS, isTrayActionId, TRAY_ACTION_IDS } from "./actions.js";

describe("tray action model", () => {
  it("keeps the EPIC-08 action ids in the expected order", () => {
    expect(TRAY_ACTION_IDS).toEqual([
      "show-hud",
      "open-dashboard",
      "open-today-live",
      "open-connections",
      "open-notification-settings",
      "refresh-now",
      "pause-30m",
      "pause-1h",
      "pause-until-tomorrow",
      "start-at-login-toggle",
      "run-doctor",
      "quit",
    ]);
    expect(DEFAULT_TRAY_ACTIONS.map((action) => action.id)).toEqual(TRAY_ACTION_IDS);
  });

  it("localizes navigation paths without changing action ids", () => {
    const actions = buildTrayActions({
      locale: "en",
      startAtLoginEnabled: true,
    });

    expect(actions.map((action) => action.id)).toEqual(TRAY_ACTION_IDS);
    expect(actions.find((action) => action.id === "show-hud")?.urlPath).toBe("/hud?locale=en");
    expect(actions.find((action) => action.id === "open-dashboard")?.urlPath).toBe("/en/dashboard/overview");
    expect(actions.find((action) => action.id === "open-today-live")?.urlPath).toBe("/en/dashboard/today");
    expect(actions.find((action) => action.id === "start-at-login-toggle")?.label).toBe("Start at Login: On");
  });

  it("detects known action ids", () => {
    expect(isTrayActionId("pause-1h")).toBe(true);
    expect(isTrayActionId("show-provider-credentials")).toBe(false);
  });
});
