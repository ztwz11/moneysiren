import { describe, expect, it } from "vitest";
import {
  installedDesktopAppCandidates,
  resolveConfiguredDesktopAppPath,
} from "./desktop-app.js";

describe("desktop app path candidates", () => {
  it("resolves an explicit Windows app path relative to the caller cwd", () => {
    expect(resolveConfiguredDesktopAppPath({
      cwd: "C:\\work\\moneysiren",
      env: {
        MONEYSIREN_DESKTOP_APP: ".\\desktop\\moneysiren-tray.exe",
      },
      platform: "win32",
    })).toBe("C:\\work\\moneysiren\\desktop\\moneysiren-tray.exe");
  });

  it("returns fixed Windows installation candidates in deterministic order", () => {
    expect(installedDesktopAppCandidates({
      env: {
        LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local",
        ProgramFiles: "C:\\Program Files",
      },
      platform: "win32",
    })).toEqual([
      "C:\\Users\\tester\\AppData\\Local\\Programs\\MoneySiren Tray\\MoneySiren Tray.exe",
      "C:\\Users\\tester\\AppData\\Local\\Programs\\MoneySiren Tray\\moneysiren-tray.exe",
      "C:\\Users\\tester\\AppData\\Local\\MoneySiren Tray\\MoneySiren Tray.exe",
      "C:\\Users\\tester\\AppData\\Local\\MoneySiren Tray\\moneysiren-tray.exe",
      "C:\\Program Files\\Programs\\MoneySiren Tray\\MoneySiren Tray.exe",
      "C:\\Program Files\\Programs\\MoneySiren Tray\\moneysiren-tray.exe",
      "C:\\Program Files\\MoneySiren Tray\\MoneySiren Tray.exe",
      "C:\\Program Files\\MoneySiren Tray\\moneysiren-tray.exe",
    ]);
  });

  it("returns the conventional macOS bundle and no guessed Linux PATH entry", () => {
    expect(installedDesktopAppCandidates({ env: {}, platform: "darwin" })).toEqual([
      "/Applications/MoneySiren Tray.app",
    ]);
    expect(installedDesktopAppCandidates({ env: {}, platform: "linux" })).toEqual([]);
  });
});
