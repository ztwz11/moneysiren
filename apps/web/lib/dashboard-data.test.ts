import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initializeLocalStore, saveLocalProviderCollection } from "../../../packages/db/src/index";
import {
  buildDashboardSnapshot,
  readDashboardSnapshot,
  type DashboardSnapshot,
} from "./dashboard-data";

const FIXED_NOW = new Date("2026-06-02T09:00:00.000Z");
const GENERATED_AT = FIXED_NOW.toISOString();

describe("dashboard data adapter", () => {
  it("returns a safe empty dashboard snapshot when SQLite is missing", async () => {
    let attemptedRead = false;

    const snapshot = await readDashboardSnapshot({
      cwd: "/tmp/moneysiren-dashboard-empty",
      env: {},
      now: () => FIXED_NOW,
      fileExists: async () => false,
      readStore: async () => {
        attemptedRead = true;
        throw new Error("readStore should not be called for a missing database");
      },
    });

    expect(snapshot).toEqual({
      generatedAt: GENERATED_AT,
      source: "empty",
      database: {
        available: false,
        reason: "missing",
      },
      summary: {
        providerCount: 0,
        totalEstimatedAmountMinor: 0,
        totalBillingAmountMinor: 0,
        currency: "USD",
        usageSnapshotCount: 0,
        costEstimateCount: 0,
        alertCount: 0,
        criticalAlertCount: 0,
        healthStatus: "unknown",
      },
      providers: [],
      usage: {
        snapshotCount: 0,
        topMetrics: [],
        latestServiceMetrics: [],
        dailyMetrics: [],
      },
      risks: [],
      health: [],
      alerts: [],
    });
    expect(attemptedRead).toBe(false);
    expectDashboardPayloadIsRedacted(snapshot);
  });

  it("builds dashboard summaries from normalized store data without account refs or metadata", () => {
    const snapshot = buildDashboardSnapshot(
      {
        appliedMigrationIds: ["0001_init"],
        providers: [
          {
            id: "provider:aws",
            key: "aws",
            displayName: "AWS Cost Explorer",
            connectorVersion: "0.1.0",
            createdAt: "2026-06-02T08:00:00.000Z",
            updatedAt: "2026-06-02T08:00:00.000Z",
          },
        ],
        usageSnapshots: [
          {
            id: "usage-1",
            providerKey: "aws",
            providerAccountRef: "redacted-digest-should-not-render",
            collectedAt: "2026-06-02T08:30:00.000Z",
            service: "ec2",
            metric: "usage-hours",
            unit: "hours",
            value: 12,
            metadataJson: {},
          },
        ],
        billingSnapshots: [
          {
            id: "billing-1",
            providerKey: "aws",
            providerAccountRef: "redacted-digest-should-not-render",
            collectedAt: "2026-06-02T08:30:00.000Z",
            periodStart: "2026-06-01",
            periodEnd: "2026-06-30",
            amountMinor: 1299,
            currency: "USD",
            status: "current",
            metadataJson: {},
          },
        ],
        serviceHealthSnapshots: [
          {
            id: "health-1",
            providerKey: "aws",
            collectedAt: "2026-06-02T08:31:00.000Z",
            service: "ec2",
            region: "us-east-1",
            status: "degraded",
            message: "Elevated API errors",
            metadataJson: {},
          },
        ],
        costEstimates: [
          {
            id: "estimate-1",
            providerKey: "aws",
            providerAccountRef: "redacted-digest-should-not-render",
            collectedAt: "2026-06-02T08:32:00.000Z",
            periodStart: "2026-06-01",
            periodEnd: "2026-06-30",
            estimatedAmountMinor: 2500,
            currency: "USD",
            confidence: "medium",
            metadataJson: {},
          },
        ],
        alerts: [
          {
            id: "alert-1",
            providerKey: "aws",
            createdAt: "2026-06-02T08:33:00.000Z",
            severity: "warning",
            category: "cost",
            title: "Spend increased",
            message: "Expected monthly cost moved above the local threshold.",
            metadataJson: {},
          },
        ],
        reportRuns: [],
        emergencyActionRuns: [],
      },
      {
        generatedAt: GENERATED_AT,
      },
    );

    expect(snapshot.source).toBe("sqlite");
    expect(snapshot.summary).toMatchObject({
      providerCount: 1,
      totalEstimatedAmountMinor: 2500,
      totalBillingAmountMinor: 1299,
      currency: "USD",
      usageSnapshotCount: 1,
      costEstimateCount: 1,
      alertCount: 1,
      criticalAlertCount: 0,
      healthStatus: "degraded",
    });
    expect(snapshot.providers).toEqual([
      {
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        estimatedAmountMinor: 2500,
        billingAmountMinor: 1299,
        currency: "USD",
        usageSnapshotCount: 1,
        billingSnapshotCount: 1,
        costEstimateCount: 1,
        healthStatus: "degraded",
        alertCount: 1,
        riskLevel: "warning",
        latestCollectedAt: "2026-06-02T08:32:00.000Z",
      },
    ]);
    expect(snapshot.usage.topMetrics).toEqual([
      {
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        service: "ec2",
        metric: "usage-hours",
        unit: "hours",
        value: 12,
        collectedAt: "2026-06-02T08:30:00.000Z",
      },
    ]);
    expect(snapshot.usage.latestServiceMetrics).toEqual([
      {
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        service: "ec2",
        metric: "usage-hours",
        unit: "hours",
        value: 12,
        collectedAt: "2026-06-02T08:30:00.000Z",
      },
    ]);
    expect(snapshot.usage.dailyMetrics).toEqual([
      {
        date: "2026-06-02",
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        metric: "usage-hours",
        unit: "hours",
        value: 12,
        sampleCount: 1,
        latestCollectedAt: "2026-06-02T08:30:00.000Z",
      },
    ]);
    expect(snapshot.risks).toEqual(
      expect.arrayContaining([
        {
          providerKey: "aws",
          displayName: "AWS Cost Explorer",
          severity: "warning",
          title: "Spend increased",
          message: "Expected monthly cost moved above the local threshold.",
          createdAt: "2026-06-02T08:33:00.000Z",
        },
        {
          providerKey: "aws",
          displayName: "AWS Cost Explorer",
          severity: "warning",
          title: "Health degraded",
          message: "ec2 in us-east-1 reported degraded.",
          createdAt: "2026-06-02T08:31:00.000Z",
        },
      ]),
    );
    expectDashboardPayloadIsRedacted(snapshot);
  });

  it("uses the latest collected snapshot per day for daily usage trends", () => {
    const snapshot = buildDashboardSnapshot(
      {
        appliedMigrationIds: ["0001_init"],
        providers: [
          {
            id: "provider:aws",
            key: "aws",
            displayName: "AWS Cost Explorer",
            connectorVersion: "0.1.0",
            createdAt: "2026-06-14T08:00:00.000Z",
            updatedAt: "2026-06-15T08:00:00.000Z",
          },
        ],
        usageSnapshots: [
          {
            id: "usage-1",
            providerKey: "aws",
            collectedAt: "2026-06-14T08:00:00.000Z",
            service: "Amazon EC2",
            metric: "unblended_cost",
            unit: "USD",
            value: 3,
            metadataJson: {},
          },
          {
            id: "usage-2",
            providerKey: "aws",
            collectedAt: "2026-06-15T06:09:00.000Z",
            service: "Amazon EC2",
            metric: "unblended_cost",
            unit: "USD",
            value: 7,
            metadataJson: {},
          },
          {
            id: "usage-3",
            providerKey: "aws",
            collectedAt: "2026-06-15T06:09:00.000Z",
            service: "Amazon S3",
            metric: "unblended_cost",
            unit: "USD",
            value: 2,
            metadataJson: {},
          },
          {
            id: "usage-4",
            providerKey: "aws",
            collectedAt: "2026-06-15T06:13:00.000Z",
            service: "Amazon EC2",
            metric: "unblended_cost",
            unit: "USD",
            value: 5,
            metadataJson: {},
          },
          {
            id: "usage-5",
            providerKey: "aws",
            collectedAt: "2026-06-15T06:13:00.000Z",
            service: "Amazon S3",
            metric: "unblended_cost",
            unit: "USD",
            value: 2.61,
            metadataJson: {},
          },
        ],
        billingSnapshots: [],
        serviceHealthSnapshots: [],
        costEstimates: [],
        alerts: [],
        reportRuns: [],
        emergencyActionRuns: [],
      },
      {
        generatedAt: GENERATED_AT,
      },
    );

    expect(snapshot.usage.dailyMetrics).toMatchObject([
      {
        date: "2026-06-14",
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        metric: "unblended_cost",
        unit: "USD",
        value: 3,
        sampleCount: 1,
        latestCollectedAt: "2026-06-14T08:00:00.000Z",
      },
      {
        date: "2026-06-15",
        providerKey: "aws",
        displayName: "AWS Cost Explorer",
        metric: "unblended_cost",
        unit: "USD",
        sampleCount: 2,
        latestCollectedAt: "2026-06-15T06:13:00.000Z",
      },
    ]);
    expect(snapshot.usage.dailyMetrics[1]?.value).toBeCloseTo(7.61, 2);
  });

  it("reads a temp SQLite database through the adapter", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "moneysiren-web-db-"));
    const dbPath = join(rootDir, ".moneysiren", "moneysiren.sqlite");

    await initializeLocalStore({ dbPath });
    await saveLocalProviderCollection({
      dbPath,
      provider: {
        key: "mock",
        displayName: "Mock Provider",
        connectorVersion: "0.1.0",
      },
      collectedAt: "2026-06-02T08:00:00.000Z",
      status: "ok",
      snapshots: {
        usage: [
          {
            provider: "mock",
            collectedAt: "2026-06-02T08:00:00.000Z",
            service: "mock-api",
            metric: "requests",
            unit: "count",
            value: 42,
            providerAccountRef: "fake-local-account",
          },
        ],
        billing: [],
        serviceHealth: [
          {
            provider: "mock",
            collectedAt: "2026-06-02T08:01:00.000Z",
            service: "mock-api",
            status: "ok",
          },
        ],
        costEstimates: [
          {
            provider: "mock",
            collectedAt: "2026-06-02T08:02:00.000Z",
            periodStart: "2026-06-01",
            periodEnd: "2026-06-30",
            estimatedAmountMinor: 1234,
            currency: "USD",
            confidence: "high",
            providerAccountRef: "fake-local-account",
          },
        ],
      },
      alerts: [],
    });

    const snapshot = await readDashboardSnapshot({
      cwd: rootDir,
      env: {
        MONEYSIREN_DB_PATH: dbPath,
      },
      now: () => FIXED_NOW,
    });

    expect(snapshot.source).toBe("sqlite");
    expect(snapshot.database.available).toBe(true);
    expect(snapshot.providers).toHaveLength(1);
    expect(snapshot.providers[0]).toMatchObject({
      providerKey: "mock",
      displayName: "Mock Provider",
      estimatedAmountMinor: 1234,
      healthStatus: "ok",
      riskLevel: "low",
    });
    expectDashboardPayloadIsRedacted(snapshot);
  }, 15000);
});

function expectDashboardPayloadIsRedacted(snapshot: DashboardSnapshot): void {
  const payload = JSON.stringify(snapshot);

  expect(payload).not.toMatch(
    /providerAccountRef|metadataJson|rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i,
  );
}
