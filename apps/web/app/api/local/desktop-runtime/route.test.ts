import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, win32 } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLocalSecurityState,
  createLocalSession,
  localSessionCookie,
} from "../../../../lib/local-security";
import { POST, resolveDesktopHudLaunch } from "./route";

const spawnControl = vi.hoisted(() => ({
  mode: "spawn" as "spawn" | "error",
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const child: {
      exitCode: number | null;
      kill: ReturnType<typeof vi.fn>;
      killed: boolean;
      once: ReturnType<typeof vi.fn>;
      unref: ReturnType<typeof vi.fn>;
    } = {
      exitCode: null,
      kill: vi.fn(),
      killed: false,
      once: vi.fn(),
      unref: vi.fn(),
    };
    child.kill.mockImplementation(() => {
      child.exitCode = 0;
      child.killed = true;
      return true;
    });
    child.once.mockImplementation((event: string, listener: (error?: Error) => void) => {
      if (event === spawnControl.mode) {
        queueMicrotask(() => {
          if (event === "error") {
            listener(new Error("fake spawn failure"));
          } else {
            listener();
          }
        });
      }
      return child;
    });
    return child;
  }),
}));

const spawnMock = vi.mocked(spawn);
const temporaryDirectories: string[] = [];

beforeEach(() => {
  spawnMock.mockClear();
  spawnControl.mode = "spawn";
  clearLocalSecurityState();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MONEYSIREN_DESKTOP_APP", undefined);
  vi.stubEnv("MONEYSIREN_DESKTOP_TRAY_MODE", undefined);
  vi.stubEnv("LOCALAPPDATA", undefined);
  vi.stubEnv("ProgramFiles", undefined);
  vi.stubEnv("ProgramFiles(x86)", undefined);
});

afterEach(async () => {
  clearLocalSecurityState();
  vi.unstubAllEnvs();

  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => {
    await rm(directory, { force: true, recursive: true });
  }));
});

describe("desktop HUD launch resolution", () => {
  it("resolves a standard Windows installation without a repository root", () => {
    const executable = "C:\\Users\\tester\\AppData\\Local\\MoneySiren Tray\\moneysiren-tray.exe";
    const launch = resolveDesktopHudLaunch({
      cwd: "C:\\Users\\tester\\AppData\\Roaming\\MoneySiren\\web-runtime\\apps\\web",
      env: {
        LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local",
        NODE_ENV: "production",
      },
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      platform: "win32",
      resolveRegularFile: existingFiles(executable),
    });

    expect(launch).toEqual({
      command: executable,
      args: [],
      cwd: dirnameFor("win32", executable),
      kind: "desktop",
    });
  });

  it("gives an explicit configured executable precedence over standard installs", () => {
    const configured = "D:\\MoneySiren\\moneysiren-tray.exe";
    const installed = "C:\\Users\\tester\\AppData\\Local\\MoneySiren Tray\\moneysiren-tray.exe";
    const launch = resolveDesktopHudLaunch({
      cwd: "C:\\runtime",
      env: {
        LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local",
        MONEYSIREN_DESKTOP_APP: configured,
        NODE_ENV: "production",
      },
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      platform: "win32",
      resolveRegularFile: existingFiles(configured, installed),
    });

    expect(launch.command).toBe(configured);
    expect(launch.cwd).toBe("D:\\MoneySiren");
  });

  it("accepts the verified portable Windows artifact name propagated by the CLI", () => {
    const portable = "D:\\MoneySiren\\MoneySiren.Tray_0.1.7-beta.3_x64-portable.exe";
    const launch = resolveDesktopHudLaunch({
      cwd: "C:\\runtime",
      env: {
        MONEYSIREN_DESKTOP_APP: portable,
        NODE_ENV: "production",
      },
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      platform: "win32",
      resolveRegularFile: existingFiles(portable),
    });

    expect(launch.command).toBe(portable);
    expect(launch.kind).toBe("desktop");
  });

  it("fails closed for invalid configured paths instead of using an installed fallback", () => {
    const installed = "C:\\Users\\tester\\AppData\\Local\\MoneySiren Tray\\moneysiren-tray.exe";

    for (const configured of [
      ".\\moneysiren-tray.exe",
      "\\\\server\\share\\moneysiren-tray.exe",
      "D:\\MoneySiren\\launch.cmd",
    ]) {
      expect(() => resolveDesktopHudLaunch({
        cwd: "C:\\runtime",
        env: {
          LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local",
          MONEYSIREN_DESKTOP_APP: configured,
          NODE_ENV: "production",
        },
        execPath: "C:\\Program Files\\nodejs\\node.exe",
        platform: "win32",
        resolveRegularFile: existingFiles(configured, installed),
      })).toThrow();
    }
  });

  it("keeps a repository-built executable as the final production fallback", () => {
    const marker = "C:\\work\\stackspend\\tools\\scripts\\run-web-with-tray.mjs";
    const executable = "C:\\work\\stackspend\\apps\\tray\\src-tauri\\target\\release\\moneysiren-tray.exe";
    const launch = resolveDesktopHudLaunch({
      cwd: "C:\\work\\stackspend\\apps\\web",
      env: {
        NODE_ENV: "production",
      },
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      platform: "win32",
      resolveRegularFile: existingFiles(marker, executable),
    });

    expect(launch.command).toBe(executable);
    expect(launch.args).toEqual([]);
    expect(launch.kind).toBe("desktop");
  });

  it("does not require native execute permission for the Node launcher", () => {
    const marker = "/work/stackspend/tools/scripts/run-web-with-tray.mjs";
    const launch = resolveDesktopHudLaunch({
      cwd: "/work/stackspend/apps/web",
      env: {
        NODE_ENV: "test",
      },
      execPath: "/usr/bin/node",
      platform: "linux",
      resolveExecutableFile: () => null,
      resolveRegularFile: existingFiles(marker),
    });

    expect(launch.command).toBe("/usr/bin/node");
    expect(launch.args[0]).toBe(marker);
    expect(launch.kind).toBe("dev-launcher");
  });

  it("fails when production has no configured, installed, or repository executable", () => {
    expect(() => resolveDesktopHudLaunch({
      cwd: "/opt/moneysiren/web-runtime/apps/web",
      env: {
        NODE_ENV: "production",
      },
      execPath: "/usr/bin/node",
      platform: "linux",
      resolveRegularFile: () => null,
    })).toThrow("not found");
  });
});

describe("POST /api/local/desktop-runtime", () => {
  it("starts the HUD-only dev runtime for an authenticated local HUD request", async () => {
    const response = await POST(authenticatedLocalRequest({
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
        shell: false,
        stdio: "ignore",
        windowsHide: true,
        env: expect.objectContaining({
          MONEYSIREN_DESKTOP_MODE: "hud",
          MONEYSIREN_LOCALE: "ko",
          MONEYSIREN_WEB_URL: "http://127.0.0.1:3000",
        }),
      }),
    );
  });

  it("starts an explicitly configured production executable with no shell", async () => {
    const executable = await createFakeDesktopExecutable();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONEYSIREN_DESKTOP_APP", executable);
    vi.stubEnv("OPENAI_ADMIN_KEY", "fake-provider-secret-value");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "fake-cloud-secret-value");
    vi.stubEnv("SLACK_WEBHOOK_URL", "fake-webhook-secret-value");

    const response = await POST(authenticatedLocalRequest({
      body: JSON.stringify({
        path: "/hud?locale=fr",
        executablePath: "C:\\untrusted\\other.exe",
      }),
      method: "POST",
    }));

    expect(response.status).toBe(202);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringMatching(/MoneySiren Tray|moneysiren-tray/),
      [],
      expect.objectContaining({
        cwd: dirnameFor(process.platform, executableForConfiguredPath(executable)),
        detached: true,
        shell: false,
        stdio: "ignore",
        windowsHide: true,
        env: expect.objectContaining({
          MONEYSIREN_DESKTOP_MODE: "hud",
          MONEYSIREN_LOCALE: "fr",
          MONEYSIREN_WEB_URL: "http://127.0.0.1:3000",
        }),
      }),
    );
    expect(JSON.stringify(spawnMock.mock.calls)).not.toContain("untrusted");
    const spawnEnvironment = spawnMock.mock.calls[0]?.[2]?.env;
    expect(spawnEnvironment).not.toHaveProperty("OPENAI_ADMIN_KEY");
    expect(spawnEnvironment).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
    expect(spawnEnvironment).not.toHaveProperty("SLACK_WEBHOOK_URL");
  });

  it("accepts a matching loopback Host when the standalone framework normalizes request.url", async () => {
    const executable = await createFakeDesktopExecutable();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONEYSIREN_DESKTOP_APP", executable);

    const response = await POST(authenticatedLocalRequest({
      body: JSON.stringify({ path: "/hud?locale=ko" }),
      method: "POST",
    }, "http://localhost:3000/api/local/desktop-runtime"));

    expect(response.status).toBe(202);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          MONEYSIREN_WEB_URL: "http://127.0.0.1:3000",
        }),
      }),
    );
  });

  it("rejects missing CSRF, another localhost origin, and non-JSON requests", async () => {
    const session = createLocalSession();
    const cookie = localSessionCookie(session).split(";", 1)[0] ?? "";
    const requests = [
      new Request("http://127.0.0.1:3000/api/local/desktop-runtime", {
        body: JSON.stringify({ path: "/hud" }),
        headers: localHeaders(),
        method: "POST",
      }),
      new Request("http://127.0.0.1:3000/api/local/desktop-runtime", {
        body: JSON.stringify({ path: "/hud" }),
        headers: localHeaders({
          cookie,
          origin: "http://127.0.0.1:4000",
          "x-moneysiren-csrf": session.csrfToken,
        }),
        method: "POST",
      }),
      authenticatedLocalRequest({
        body: JSON.stringify({ path: "/hud" }),
        headers: {
          "content-type": "text/plain",
        },
        method: "POST",
      }),
    ];

    for (const request of requests) {
      const response = await POST(request);
      expect(response.status).toBeGreaterThanOrEqual(400);
    }

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe, extra-query, and oversized HUD requests", async () => {
    for (const body of [
      { path: "https://example.com" },
      { path: "//example.com" },
      { path: "/ko/settings/notifications" },
      { path: "/hud?locale=ko&executablePath=C%3A%5Cother.exe" },
      { path: "/hud\n" },
      { path: "/hud", padding: "x".repeat(5_000) },
    ]) {
      const response = await POST(authenticatedLocalRequest({
        body: JSON.stringify(body),
        method: "POST",
      }));

      expect(response.status).toBe(400);
    }

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("returns a fixed secret-free error when the configured executable is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONEYSIREN_DESKTOP_APP", missingConfiguredExecutable());

    const response = await POST(authenticatedLocalRequest({
      body: JSON.stringify({ path: "/hud" }),
      method: "POST",
    }));
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(payload).toEqual({
      error: "Failed to start the local desktop HUD runtime.",
      localOnly: true,
      secretsReturned: false,
    });
    expect(JSON.stringify(payload)).not.toContain(missingConfiguredExecutable());
  });

  it("returns a fixed 500 response when the desktop process emits an asynchronous spawn error", async () => {
    const executable = await createFakeDesktopExecutable();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONEYSIREN_DESKTOP_APP", executable);
    spawnControl.mode = "error";

    const response = await POST(authenticatedLocalRequest({
      body: JSON.stringify({ path: "/hud" }),
      method: "POST",
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to start the local desktop HUD runtime.",
      localOnly: true,
      secretsReturned: false,
    });
  });

  it("replaces its previously managed HUD child instead of accumulating processes", async () => {
    const executable = await createFakeDesktopExecutable();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONEYSIREN_DESKTOP_APP", executable);

    const firstResponse = await POST(authenticatedLocalRequest({
      body: JSON.stringify({ path: "/hud" }),
      method: "POST",
    }));
    const firstChild = spawnMock.mock.results[0]?.value as { kill: ReturnType<typeof vi.fn> } | undefined;
    const secondResponse = await POST(authenticatedLocalRequest({
      body: JSON.stringify({ path: "/hud" }),
      method: "POST",
    }));

    expect(firstResponse.status).toBe(202);
    expect(secondResponse.status).toBe(202);
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(firstChild?.kill).toHaveBeenCalledTimes(1);
  });
});

function authenticatedLocalRequest(
  init: RequestInit,
  url = "http://127.0.0.1:3000/api/local/desktop-runtime",
): Request {
  const session = createLocalSession();
  const cookie = localSessionCookie(session).split(";", 1)[0] ?? "";

  return new Request(url, {
    ...init,
    headers: localHeaders({
      cookie,
      "x-moneysiren-csrf": session.csrfToken,
      ...Object.fromEntries(new Headers(init.headers).entries()),
    }),
  });
}

function localHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    host: "127.0.0.1:3000",
    origin: "http://127.0.0.1:3000",
    "content-type": "application/json",
    ...overrides,
  };
}

function existingFiles(...paths: string[]): (path: string) => string | null {
  const existing = new Set(paths.map((path) => path.toLowerCase()));

  return (path) => existing.has(path.toLowerCase()) ? path : null;
}

async function createFakeDesktopExecutable(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "moneysiren-hud-route-"));
  temporaryDirectories.push(root);

  if (process.platform === "darwin") {
    const appPath = join(root, "MoneySiren Tray.app");
    const executable = join(appPath, "Contents", "MacOS", "MoneySiren Tray");
    await mkdir(dirname(executable), { recursive: true });
    await writeFile(executable, "fake desktop executable", { mode: 0o755 });
    return appPath;
  }

  const executable = join(root, process.platform === "win32" ? "moneysiren-tray.exe" : "moneysiren-tray");
  await writeFile(executable, "fake desktop executable", { mode: 0o755 });
  return executable;
}

function executableForConfiguredPath(path: string): string {
  return process.platform === "darwin"
    ? join(path, "Contents", "MacOS", "MoneySiren Tray")
    : path;
}

function missingConfiguredExecutable(): string {
  if (process.platform === "win32") {
    return "C:\\missing\\moneysiren-tray.exe";
  }

  if (process.platform === "darwin") {
    return "/missing/MoneySiren Tray.app";
  }

  return "/missing/moneysiren-tray";
}

function dirnameFor(platform: NodeJS.Platform, path: string): string {
  return platform === "win32" ? win32.dirname(path) : posix.dirname(path);
}
