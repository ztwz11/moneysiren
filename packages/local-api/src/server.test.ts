import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { startLocalApiServer, type LocalApiServer } from "./index.js";
import type { ViewModelStore } from "../../view-model/src/index.js";

const NOW = new Date("2026-06-09T03:00:00.000Z");

const STORE_WITH_SENSITIVE_VALUES: ViewModelStore = {
  providers: [
    {
      key: "openai",
      displayName: "OpenAI acct_sensitive",
    },
  ],
  usageSnapshots: [],
  billingSnapshots: [],
  serviceHealthSnapshots: [],
  costEstimates: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      estimatedAmountMinor: 1234,
      currency: "USD",
      confidence: "medium",
    },
  ],
  alerts: [
    {
      providerKey: "openai",
      createdAt: NOW.toISOString(),
      severity: "critical",
      category: "billing",
      title: "Token sk-fake-local-api-test_123",
      message: "Webhook https://hooks.slack.com/services/FAKE/T000/SECRET",
    },
  ],
};

describe("local API server", () => {
  it("serves loopback-only local-safe endpoints", async () => {
    const runtimeCwd = await mkdtemp(join(tmpdir(), "moneysiren-local-api-"));
    const api = await startLocalApiServer({
      port: 0,
      now: () => NOW,
      runtimeLock: {
        cwd: runtimeCwd,
        lockPath: ".moneysiren/runtime.json",
      },
      viewModel: {
        store: STORE_WITH_SENSITIVE_VALUES,
        timezone: "UTC",
      },
    });

    try {
      const health = await readJson(`${api.baseUrl}/api/local/health`);
      const summary = await readJson(`${api.baseUrl}/api/local/summary`);
      const digest = await readJson(`${api.baseUrl}/api/local/notification-digest`);
      const tray = await readJson(`${api.baseUrl}/api/local/tray-menu`);
      const serialized = JSON.stringify({ health, summary, digest, tray });

      expect(api.host).toBe("127.0.0.1");
      expect(health).toMatchObject({
        localOnly: true,
        secretsReturned: false,
        status: "ok",
        loopbackOnly: true,
      });
      expect(summary).toMatchObject({
        localOnly: true,
        secretsReturned: false,
        summary: {
          totalEstimatedAmountMinor: 1234,
        },
      });
      expect(digest).toMatchObject({
        localOnly: true,
        secretsReturned: false,
        status: "critical",
      });
      expect(tray).toMatchObject({
        localOnly: true,
        secretsReturned: false,
      });
      expect(serialized).not.toContain("acct_sensitive");
      expect(serialized).not.toContain("sk-fake-local-api-test_123");
      expect(serialized).not.toContain("hooks.slack.com");
    } finally {
      await api.close();
    }
  });

  it("rejects external bind hosts", async () => {
    await expect(startLocalApiServer({
      host: "0.0.0.0",
      port: 0,
      runtimeLock: false,
    })).rejects.toThrow(/loopback/i);
  });

  it("falls back to the next loopback port when the requested port is in use", async () => {
    const first = await startWithoutLock();
    const second = await startLocalApiServer({
      port: first.port,
      runtimeLock: false,
    });

    try {
      expect(second.host).toBe("127.0.0.1");
      expect(second.port).not.toBe(first.port);
      await expect(readJson(`${second.baseUrl}/api/local/health`)).resolves.toMatchObject({
        localOnly: true,
        secretsReturned: false,
        status: "ok",
      });
    } finally {
      await second.close();
      await first.close();
    }
  });

  it("rejects non-loopback browser origins", async () => {
    const api = await startWithoutLock();

    try {
      const response = await fetch(`${api.baseUrl}/api/local/health`, {
        headers: {
          Origin: "http://192.168.0.2:3000",
        },
      });
      const payload = await response.json() as { secretsReturned?: unknown; error?: { code?: string } };

      expect(response.status).toBe(403);
      expect(payload.secretsReturned).toBe(false);
      expect(payload.error?.code).toBe("forbidden_origin");
    } finally {
      await api.close();
    }
  });

  it("stores notification preferences through token-protected local writes and reflects them in digest", async () => {
    const runtimeCwd = await mkdtemp(join(tmpdir(), "moneysiren-local-api-prefs-"));
    const api = await startLocalApiServer({
      port: 0,
      localSessionToken: "fake-local-session-token",
      runtimeLock: {
        cwd: runtimeCwd,
        lockPath: ".moneysiren/runtime.json",
      },
      viewModel: {
        store: STORE_WITH_SENSITIVE_VALUES,
        timezone: "UTC",
      },
    });

    try {
      const rejected = await fetch(`${api.baseUrl}/api/local/notification-preferences`, {
        body: JSON.stringify({
          enabled: false,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      expect(rejected.status).toBe(401);

      const saved = await fetch(`${api.baseUrl}/api/local/notification-preferences`, {
        body: JSON.stringify({
          enabled: true,
          digestEnabled: true,
          digestInterval: "daily",
          quietHours: {
            start: "22:00",
            end: "08:00",
          },
          selectedWidgets: ["risk_high_count"],
          thresholdRules: [],
          desktopEnabled: true,
        }),
        headers: {
          "Content-Type": "application/json",
          "X-MoneySiren-Local-Session": "fake-local-session-token",
        },
        method: "PUT",
      });
      const savedPayload = await saved.json() as {
        localOnly?: boolean;
        secretsReturned?: boolean;
        preferences?: { selectedWidgets?: string[] };
      };
      const preferences = await readJson(`${api.baseUrl}/api/local/notification-preferences`) as {
        preferences?: { selectedWidgets?: string[] };
      };
      const digest = await readJson(`${api.baseUrl}/api/local/notification-digest`) as {
        items?: Array<{ widgetKey?: string }>;
      };

      expect(saved.status).toBe(200);
      expect(savedPayload.localOnly).toBe(true);
      expect(savedPayload.secretsReturned).toBe(false);
      expect(savedPayload.preferences?.selectedWidgets).toEqual(["risk_high_count"]);
      expect(preferences.preferences?.selectedWidgets).toEqual(["risk_high_count"]);
      expect(digest.items).toEqual([
        expect.objectContaining({
          widgetKey: "risk_high_count",
        }),
      ]);
    } finally {
      await api.close();
    }
  });
});

async function startWithoutLock(): Promise<LocalApiServer> {
  return startLocalApiServer({
    port: 0,
    runtimeLock: false,
  });
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url);

  expect(response.status).toBe(200);

  return response.json();
}
