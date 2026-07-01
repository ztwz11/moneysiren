import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  assertRuntimeHealthy,
  findRuntime,
  isLoopbackHost,
  readRuntimeLock,
  resolveRuntimeLockPath,
  writeRuntimeLock,
  type LocalRuntime,
} from "./index.js";

const RUNTIME: LocalRuntime = {
  pid: process.pid,
  port: 47831,
  baseUrl: "http://127.0.0.1:47831",
  startedAt: "2026-06-09T00:00:00.000Z",
  version: "0.1.0-alpha.44",
};

describe("runtime helpers", () => {
  it("accepts loopback hosts and rejects external hosts", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("192.168.0.10")).toBe(false);
  });

  it("writes and discovers a local-safe runtime lock", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-runtime-"));
    const lockOptions = {
      cwd,
      lockPath: ".moneysiren/runtime.json",
    };
    const lockPath = await writeRuntimeLock(RUNTIME, lockOptions);
    const found = await findRuntime(lockOptions);
    const serialized = JSON.stringify(await readRuntimeLock(lockOptions));

    expect(lockPath.endsWith(join(".moneysiren", "runtime.json"))).toBe(true);
    expect(found).toEqual(RUNTIME);
    expect(serialized).not.toContain("sk-");
    expect(serialized).not.toContain("hooks.slack.com");
  });

  it("uses platform-native runtime lock paths on macOS and Windows", async () => {
    const macLockPath = resolveRuntimeLockPath({
      env: {
        HOME: "/Users/tester",
      },
      platform: "darwin",
    });
    const windowsLockPath = resolveRuntimeLockPath({
      env: {
        APPDATA: "C:\\Users\\tester\\AppData\\Roaming",
        USERPROFILE: "C:\\Users\\tester",
      },
      platform: "win32",
    });

    expect(macLockPath).toBe("/Users/tester/Library/Application Support/MoneySiren/runtime.json");
    expect(windowsLockPath).toContain("MoneySiren");
    expect(windowsLockPath).toContain("runtime.json");
    expect(windowsLockPath).toContain("AppData");
  });

  it("does not accept non-loopback lock URLs", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-runtime-"));

    await expect(writeRuntimeLock({
      ...RUNTIME,
      baseUrl: "http://0.0.0.0:47831",
    }, { cwd })).rejects.toThrow(/loopback/i);
  });

  it("requires health responses to keep secretsReturned false", async () => {
    const ok = await assertRuntimeHealthy(RUNTIME, {
      fetchImpl: async () => new Response(JSON.stringify({ secretsReturned: false }), {
        status: 200,
      }),
    });
    const unsafe = await assertRuntimeHealthy(RUNTIME, {
      fetchImpl: async () => new Response(JSON.stringify({ secretsReturned: true }), {
        status: 200,
      }),
    });

    expect(ok).toBe(true);
    expect(unsafe).toBe(false);
  });
});
