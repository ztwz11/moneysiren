import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../cli.js";
import {
  readNotificationSchedulerState,
  readRecentNotificationDeliveries,
  saveLocalProviderCollection,
} from "../../../../packages/db/src/index.js";

const NOW = new Date(2026, 6, 10, 12, 0);
const NOW_ISO = NOW.toISOString();
const WEBHOOK = "fake-moneysiren-webhook-secret";

describe("notification scheduler CLI", () => {
  it("is disabled by default and enablement does not perform delivery", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "moneysiren-notify-cli-"));
    let deliveryCalls = 0;
    const runtime = {
      cwd,
      now: () => NOW,
      env: {
        MONEYSIREN_DB_PATH: ".moneysiren/test.sqlite",
      },
      desktopNotification: {
        async permission() {
          deliveryCalls += 1;
          return "granted" as const;
        },
        async send() {
          deliveryCalls += 1;
        },
      },
    };

    const initial = await runCli(["notify", "scheduler", "status"], runtime);
    const enabled = await runCli(["notify", "scheduler", "enable", "--interval", "30"], runtime);
    const status = await runCli(["notify", "scheduler", "status"], runtime);
    const state = await readNotificationSchedulerState(join(cwd, ".moneysiren", "test.sqlite"));

    expect(initial.stdout.join("\n")).toContain("Enabled: false");
    expect(enabled.exitCode).toBe(0);
    expect(status.stdout.join("\n")).toContain("Enabled: true");
    expect(state.intervalMinutes).toBe(30);
    expect(state.nextRunAt).toBeDefined();
    expect(deliveryCalls).toBe(0);
  });
});

describe("explicit notification delivery", () => {
  it("delivers a short Slack summary and persists attempted/delivered outcomes", async () => {
    const cwd = await seededAlertStore();
    const requests: string[] = [];
    const result = await runCli(["notify", "once", "--send", "slack"], {
      cwd,
      now: () => NOW,
      env: testEnv(),
      slackTransport: async ({ webhookUrl, payload }) => {
        requests.push(`${webhookUrl}|${payload.text}`);
        return { ok: true, status: 200 };
      },
    });
    const deliveries = await readRecentNotificationDeliveries(dbPath(cwd));

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Notification delivered: slack");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("1 alert across 1 provider");
    expect(deliveries.map((entry) => entry.outcome).sort()).toEqual(["attempted", "delivered"]);
    expect(JSON.stringify(deliveries)).not.toContain(WEBHOOK);
  });

  it("treats desktop permission denial as an error and never calls send", async () => {
    const cwd = await seededAlertStore();
    let sendCalls = 0;
    const result = await runCli(["notify", "once", "--send", "desktop"], {
      cwd,
      now: () => NOW,
      env: testEnv(),
      desktopNotification: {
        async permission() {
          return "denied";
        },
        async send() {
          sendCalls += 1;
        },
      },
    });
    const deliveries = await readRecentNotificationDeliveries(dbPath(cwd));

    expect(result.exitCode).toBe(1);
    expect(sendCalls).toBe(0);
    expect(deliveries.map((entry) => entry.outcome).sort()).toEqual(["attempted", "error"]);
    expect(deliveries.find((entry) => entry.outcome === "error")).toMatchObject({
      target: "desktop",
      outcome: "error",
      reasonCode: "permission_denied",
    });
  });

  it("returns non-zero and persists a sanitized Slack failure", async () => {
    const cwd = await seededAlertStore();
    const result = await runCli(["notify", "once", "--send", "slack"], {
      cwd,
      now: () => NOW,
      env: testEnv(),
      slackTransport: async () => ({
        ok: false,
        status: 500,
        body: `failed ${WEBHOOK}`,
      }),
    });
    const deliveries = await readRecentNotificationDeliveries(dbPath(cwd));
    const output = [...result.stdout, ...result.stderr].join("\n");

    expect(result.exitCode).toBe(1);
    expect(deliveries.map((entry) => entry.outcome).sort()).toEqual(["attempted", "error"]);
    expect(deliveries.find((entry) => entry.outcome === "error")).toMatchObject({
      target: "slack",
      outcome: "error",
      reasonCode: "delivery_failed",
    });
    expect(JSON.stringify(deliveries)).not.toContain(WEBHOOK);
    expect(output).not.toContain(WEBHOOK);
  });
});

async function seededAlertStore(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "moneysiren-notify-cli-"));

  await saveLocalProviderCollection({
    dbPath: dbPath(cwd),
    provider: {
      key: "mock",
      displayName: "Mock Provider",
      connectorVersion: "test",
    },
    collectedAt: NOW_ISO,
    status: "partial",
    snapshots: {
      usage: [],
      billing: [],
      serviceHealth: [],
      costEstimates: [],
    },
    alerts: [{
      provider: "mock",
      createdAt: NOW_ISO,
      severity: "critical",
      category: "budget",
      title: "Synthetic critical alert",
      message: "Synthetic normalized alert.",
    }],
  });

  return cwd;
}

function testEnv(): Record<string, string> {
  return {
    MONEYSIREN_DB_PATH: ".moneysiren/test.sqlite",
    SLACK_WEBHOOK_URL: WEBHOOK,
  };
}

function dbPath(cwd: string): string {
  return join(cwd, ".moneysiren", "test.sqlite");
}
