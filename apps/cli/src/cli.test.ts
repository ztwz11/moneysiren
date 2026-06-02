import { execFileSync } from "node:child_process";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const AWS_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json",
);

describe("StackSpend CLI", () => {
  it("ignores a leading pnpm argument separator", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(["--", "doctor"], testContext(cwd));

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("StackSpend doctor");
  });

  it("initializes local storage without creating .env or credentials", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(["init"], testContext(cwd));

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Initialized StackSpend local storage");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);

    const dbPath = join(cwd, ".stackspend", "stackspend.sqlite");
    const migrations = querySqlite<{ id: string }>(dbPath, "SELECT id FROM schema_migrations ORDER BY id;");
    const persistedText = dumpSqlite(dbPath);

    expect(await fileExists(dbPath)).toBe(true);
    expect(migrations).toEqual([{ id: "0001_init" }]);
    expect(persistedText).not.toContain("sqlite-placeholder-v1");
    expect(persistedText).not.toMatch(/sk-|hooks\.slack|@/i);
  });

  it("reports local readiness with doctor without exposing secret values", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(["doctor"], testContext(cwd, {
      OPENAI_ADMIN_KEY: "sk-fake-openai-admin-key",
    }));
    const stdout = result.stdout.join("\n");

    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("StackSpend doctor");
    expect(stdout).toContain("DB path: .stackspend/stackspend.sqlite");
    expect(stdout).toContain("telemetry: disabled");
    expect(stdout).toContain("mock provider: available");
    expect(stdout).toContain("openai: configured");
    expect(stdout).not.toContain("sk-fake-openai-admin-key");
  });

  it("syncs the mock provider and renders a Korean daily report from persisted normalized data", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));

    const syncResult = await runCli(["sync", "--provider", "mock"], testContext(cwd));
    expect(syncResult.exitCode).toBe(0);
    expect(syncResult.stdout.join("\n")).toContain("Synced mock provider snapshots");

    const reportResult = await runCli(["report", "daily", "--lang", "ko"], testContext(cwd));
    const reportText = reportResult.stdout.join("\n");

    expect(reportResult.exitCode).toBe(0);
    expect(reportText).toContain("StackSpend 일일 리포트");
    expect(reportText).toContain("Mock Provider");
    expect(reportText).toContain("예상 비용: USD 15.00");

    const dbPath = join(cwd, ".stackspend", "stackspend.sqlite");
    const counts = querySqlite<{
      providers: number;
      usage_snapshots: number;
      billing_snapshots: number;
      service_health_snapshots: number;
      cost_estimates: number;
      alerts: number;
      report_runs: number;
    }>(
      dbPath,
      `
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts,
        (SELECT count(*) FROM report_runs) AS report_runs;
      `,
    )[0];
    const persistedText = dumpSqlite(dbPath);

    expect(counts).toEqual({
      providers: 1,
      usage_snapshots: 1,
      billing_snapshots: 1,
      service_health_snapshots: 1,
      cost_estimates: 1,
      alerts: 0,
      report_runs: 1,
    });
    expect(persistedText).not.toContain("sqlite-placeholder-v1");
    expect(persistedText).not.toMatch(/rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i);
  });

  it("fails AWS sync gracefully without credentials or fixture mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(["sync", "--provider", "aws"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("AWS_PROFILE");
    expect(result.stderr.join("\n")).toContain("STACKSPEND_AWS_COST_EXPLORER_FIXTURE");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);
    expect(await fileExists(join(cwd, ".stackspend", "stackspend.sqlite"))).toBe(false);
  });

  it("syncs AWS Cost Explorer from fixture mode without credentials or raw AWS persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(
      ["sync", "--provider", "aws"],
      testContext(cwd, {
        STACKSPEND_AWS_COST_EXPLORER_FIXTURE: AWS_FIXTURE_PATH,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Synced AWS Cost Explorer snapshots");

    const dbPath = join(cwd, ".stackspend", "stackspend.sqlite");
    const counts = querySqlite<{
      providers: number;
      usage_snapshots: number;
      billing_snapshots: number;
      service_health_snapshots: number;
      cost_estimates: number;
      alerts: number;
    }>(
      dbPath,
      `
      SELECT
        (SELECT count(*) FROM providers) AS providers,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts;
      `,
    )[0];
    const serviceCosts = querySqlite<{ service: string; metric: string; unit: string; value: number }>(
      dbPath,
      `
      SELECT service, metric, unit, value
      FROM usage_snapshots
      ORDER BY value DESC, service;
      `,
    );
    const persistedText = dumpSqlite(dbPath);

    expect(counts).toEqual({
      providers: 1,
      usage_snapshots: 4,
      billing_snapshots: 1,
      service_health_snapshots: 0,
      cost_estimates: 1,
      alerts: 0,
    });
    expect(serviceCosts).toEqual([
      {
        service: "Amazon Elastic Compute Cloud - Compute",
        metric: "unblended_cost",
        unit: "USD",
        value: 7.12,
      },
      {
        service: "Amazon Simple Storage Service",
        metric: "unblended_cost",
        unit: "USD",
        value: 3.34,
      },
      {
        service: "AWS Lambda",
        metric: "unblended_cost",
        unit: "USD",
        value: 1,
      },
      {
        service: "Amazon CloudWatch",
        metric: "unblended_cost",
        unit: "USD",
        value: 0.88,
      },
    ]);
    expect(persistedText).not.toMatch(
      /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b/i,
    );
  });
});

function querySqlite<T>(dbPath: string, sql: string): T[] {
  const output = execFileSync("/usr/bin/sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
  }).trim();

  if (output.length === 0) {
    return [];
  }

  return JSON.parse(output) as T[];
}

function dumpSqlite(dbPath: string): string {
  return execFileSync("/usr/bin/sqlite3", [dbPath, ".dump"], {
    encoding: "utf8",
  });
}

function testContext(cwd: string, env: Record<string, string | undefined> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    cwd,
    env,
    now: () => new Date(FIXED_NOW),
    stdout: (line: string) => stdout.push(line),
    stderr: (line: string) => stderr.push(line),
    stdoutBuffer: stdout,
    stderrBuffer: stderr,
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
