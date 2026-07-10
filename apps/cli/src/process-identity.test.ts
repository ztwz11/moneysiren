import { describe, expect, it } from "vitest";
import { verifyManagedProcessIdentity } from "./process-identity.js";

const expected = {
  pid: 4242,
  startedAt: "2026-07-10T04:00:00.000Z",
  executablePath: "/opt/moneysiren/node",
  nonce: "4a65bc26-46f0-4f07-8cbf-cffb04965b76",
};

describe("managed process identity", () => {
  it("verifies the same PID, start time, and executable", () => {
    expect(verifyManagedProcessIdentity(expected, {
      pid: 4242,
      startedAt: "2026-07-10T04:00:01.000Z",
      executablePath: "/opt/moneysiren/node",
    }, { platform: "linux" })).toEqual({ status: "verified" });
  });

  it("refuses a reused PID with a different process start time", () => {
    expect(verifyManagedProcessIdentity(expected, {
      pid: 4242,
      startedAt: "2026-07-10T05:00:00.000Z",
      executablePath: "/opt/moneysiren/node",
    }, { platform: "linux" })).toEqual({
      status: "stale",
      reasonCode: "start-time-mismatch",
    });
  });

  it("refuses an executable mismatch", () => {
    expect(verifyManagedProcessIdentity(expected, {
      pid: 4242,
      startedAt: expected.startedAt,
      executablePath: "/usr/bin/unrelated",
    }, { platform: "linux" })).toEqual({
      status: "stale",
      reasonCode: "executable-mismatch",
    });
  });

  it("normalizes Windows executable paths case-insensitively", () => {
    expect(verifyManagedProcessIdentity({
      ...expected,
      executablePath: "C:\\Program Files\\MoneySiren\\node.exe",
    }, {
      pid: 4242,
      startedAt: expected.startedAt,
      executablePath: "c:/program files/moneysiren/node.exe",
    }, { platform: "win32" })).toEqual({ status: "verified" });
  });

  it("accepts a POSIX command basename only after PID and start time match", () => {
    expect(verifyManagedProcessIdentity(expected, {
      pid: 4242,
      startedAt: expected.startedAt,
      executablePath: "node",
    }, { platform: "darwin" })).toEqual({ status: "verified" });
  });

  it("treats legacy records without a nonce or executable as unverifiable", () => {
    expect(verifyManagedProcessIdentity({
      pid: 4242,
      startedAt: expected.startedAt,
    }, {
      pid: 4242,
      startedAt: expected.startedAt,
      executablePath: "node",
    })).toEqual({
      status: "unverifiable",
      reasonCode: "legacy-record",
    });
  });

  it("rejects malformed nonce state without exposing stored values", () => {
    const result = verifyManagedProcessIdentity({
      ...expected,
      nonce: "not-a-runtime-nonce",
    }, {
      pid: 4242,
      startedAt: expected.startedAt,
      executablePath: expected.executablePath,
    });

    expect(result).toEqual({
      status: "unverifiable",
      reasonCode: "invalid-record",
    });
    expect(JSON.stringify(result)).not.toContain(expected.executablePath);
  });
});
