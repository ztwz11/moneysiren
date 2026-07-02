import { spawn } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

const spawnMock = vi.mocked(spawn);

beforeEach(() => {
  spawnMock.mockClear();
});

describe("POST /api/local/desktop-runtime", () => {
  it("starts the HUD-only desktop runtime for local HUD paths", async () => {
    const response = await POST(localRequest({
      body: JSON.stringify({ path: "/hud?locale=ko" }),
      method: "POST",
    }));

    expect(response.status).toBe(202);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([
        expect.stringContaining("run-web-with-tray.mjs"),
        "--skip-web",
        "--desktop-mode",
        "hud",
        "--tray-mode",
        "dev",
        "--dashboard-url",
        "http://127.0.0.1:3000/hud?locale=ko",
      ]),
      expect.objectContaining({
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: expect.objectContaining({
          MONEYSIREN_DESKTOP_MODE: "hud",
          MONEYSIREN_WEB_URL: "http://127.0.0.1:3000",
        }),
      }),
    );
  });

  it("rejects non-HUD and unsafe paths", async () => {
    for (const path of ["https://example.com", "//example.com", "/ko/settings/notifications", "/hud\n"]) {
      const response = await POST(localRequest({
        body: JSON.stringify({ path }),
        method: "POST",
      }));

      expect(response.status).toBe(400);
    }

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("rejects requests from non-local origins", async () => {
    const response = await POST(new Request("http://127.0.0.1:3000/api/local/desktop-runtime", {
      body: JSON.stringify({ path: "/hud?locale=ko" }),
      headers: {
        host: "127.0.0.1:3000",
        origin: "https://example.com",
      },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

function localRequest(init: RequestInit): Request {
  return new Request("http://127.0.0.1:3000/api/local/desktop-runtime", {
    ...init,
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
      ...init.headers,
    },
  });
}
