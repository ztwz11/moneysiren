import { describe, expect, it, vi } from "vitest";
import {
  parseDemoArgs,
  runGuidedDemo,
  type GuidedDemoActions,
} from "./demo.js";

function actions(overrides: Partial<GuidedDemoActions> = {}): GuidedDemoActions {
  return {
    runtimeStatus: vi.fn(async (): Promise<"needs-install"> => "needs-install"),
    installWeb: vi.fn(async () => 0),
    initialize: vi.fn(async () => 0),
    syncMock: vi.fn(async () => 0),
    start: vi.fn(async () => 0),
    ...overrides,
  };
}

describe("guided credential-free demo", () => {
  it("installs missing web runtime, seeds mock data, and starts the dashboard in order", async () => {
    const order: string[] = [];
    const demoActions = actions({
      runtimeStatus: vi.fn(async (): Promise<"needs-install"> => "needs-install"),
      installWeb: vi.fn(async () => { order.push("install"); return 0; }),
      initialize: vi.fn(async () => { order.push("init"); return 0; }),
      syncMock: vi.fn(async () => { order.push("sync"); return 0; }),
      start: vi.fn(async () => { order.push("start"); return 0; }),
    });
    const output: string[] = [];

    const exitCode = await runGuidedDemo(
      { openBrowser: false, port: 4310 },
      (line) => output.push(line),
      demoActions,
    );

    expect(exitCode).toBe(0);
    expect(order).toEqual(["install", "init", "sync", "start"]);
    expect(demoActions.start).toHaveBeenCalledWith({
      openBrowser: false,
      port: 4310,
    });
    expect(output.join("\n")).toContain("fake local snapshots only");
    expect(output.join("\n")).toContain("no provider credential was read");
  });

  it("is resumable and reuses an already verified runtime", async () => {
    const demoActions = actions({
      runtimeStatus: vi.fn(async (): Promise<"ready"> => "ready"),
    });

    expect(await runGuidedDemo(
      { openBrowser: true },
      () => undefined,
      demoActions,
    )).toBe(0);

    expect(demoActions.installWeb).not.toHaveBeenCalled();
    expect(demoActions.initialize).toHaveBeenCalledOnce();
    expect(demoActions.syncMock).toHaveBeenCalledOnce();
    expect(demoActions.start).toHaveBeenCalledOnce();
  });

  it("stops immediately when a preparation step fails", async () => {
    const demoActions = actions({
      installWeb: vi.fn(async () => 1),
    });

    expect(await runGuidedDemo(
      { openBrowser: true },
      () => undefined,
      demoActions,
    )).toBe(1);
    expect(demoActions.initialize).not.toHaveBeenCalled();
    expect(demoActions.syncMock).not.toHaveBeenCalled();
    expect(demoActions.start).not.toHaveBeenCalled();
  });

  it("accepts bounded ports and rejects ambiguous arguments", () => {
    expect(parseDemoArgs([])).toEqual({ openBrowser: true });
    expect(parseDemoArgs(["--no-open", "--port", "4310"])).toEqual({
      openBrowser: false,
      port: 4310,
    });
    expect(parseDemoArgs(["--port=65535"])).toEqual({
      openBrowser: true,
      port: 65535,
    });

    for (const args of [
      ["--port"],
      ["--port", "0"],
      ["--port=65536"],
      ["--port=12x"],
      ["--unknown"],
    ]) {
      expect(parseDemoArgs(args)).toBeUndefined();
    }
  });
});
