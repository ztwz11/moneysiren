import { describe, expect, it } from "vitest";
import { desktopBackgroundSpawnOptions } from "./desktop-runtime.js";

describe("desktop runtime launcher", () => {
  it("keeps Windows runtime processes attached to avoid a visible server console", () => {
    expect(desktopBackgroundSpawnOptions("win32")).toEqual({
      detached: false,
      stdio: "ignore",
      windowsHide: true,
    });
  });

  it("detaches runtime processes on POSIX platforms", () => {
    expect(desktopBackgroundSpawnOptions("darwin")).toEqual({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    expect(desktopBackgroundSpawnOptions("linux")).toEqual({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  });
});
