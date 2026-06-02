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
const OPENAI_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/providers/openai/usage-costs.json",
);
const SUPABASE_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/providers/supabase/usage-health.json",
);
const CLOUDFLARE_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/providers/cloudflare/billing-usage.json",
);
const FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN =
  /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b|FAKE_CLOUDFLARE|fake-zone\.invalid|card_|payment_/i;

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

  it("fails OpenAI sync gracefully without admin key or fixture mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(["sync", "--provider", "openai"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("OPENAI_ADMIN_KEY");
    expect(result.stderr.join("\n")).toContain("STACKSPEND_OPENAI_USAGE_FIXTURE");
    expect(result.stderr.join("\n")).toContain("STACKSPEND_OPENAI_COSTS_FIXTURE");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);
    expect(await fileExists(join(cwd, ".stackspend", "stackspend.sqlite"))).toBe(false);
  });

  it("fails Supabase sync gracefully without access token or fixture mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(["sync", "--provider", "supabase"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("SUPABASE_ACCESS_TOKEN");
    expect(result.stderr.join("\n")).toContain("STACKSPEND_SUPABASE_FIXTURE");
    expect(await fileExists(join(cwd, ".env"))).toBe(false);
    expect(await fileExists(join(cwd, ".stackspend", "stackspend.sqlite"))).toBe(false);
  });

  it("fails Cloudflare sync gracefully without API token or fixture mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(["sync", "--provider", "cloudflare"], testContext(cwd));

    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain("CLOUDFLARE_API_TOKEN");
    expect(result.stderr.join("\n")).toContain("STACKSPEND_CLOUDFLARE_FIXTURE");
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
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

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
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
  });

  it("syncs OpenAI usage and costs from fixture mode without credentials or raw OpenAI persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(
      ["sync", "--provider", "openai"],
      testContext(cwd, {
        STACKSPEND_OPENAI_USAGE_FIXTURE: OPENAI_FIXTURE_PATH,
        STACKSPEND_OPENAI_COSTS_FIXTURE: OPENAI_FIXTURE_PATH,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Synced OpenAI usage and costs snapshots");

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
    const usage = querySqlite<{ service: string; metric: string; unit: string; value: number }>(
      dbPath,
      `
      SELECT service, metric, unit, value
      FROM usage_snapshots
      ORDER BY service, metric;
      `,
    );
    const billing = querySqlite<{ amount_minor: number; currency: string; status: string }>(
      dbPath,
      `
      SELECT amount_minor, currency, status
      FROM billing_snapshots;
      `,
    );
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

    expect(counts).toEqual({
      providers: 1,
      usage_snapshots: 5,
      billing_snapshots: 1,
      service_health_snapshots: 0,
      cost_estimates: 1,
      alerts: 0,
    });
    expect(usage).toEqual([
      {
        service: "completions:gpt-4.1-mini",
        metric: "input_tokens",
        unit: "tokens",
        value: 2000000,
      },
      {
        service: "completions:gpt-4.1-mini",
        metric: "model_requests",
        unit: "requests",
        value: 420,
      },
      {
        service: "completions:gpt-4.1-mini",
        metric: "output_tokens",
        unit: "tokens",
        value: 150000,
      },
      {
        service: "embeddings:text-embedding-3-small",
        metric: "input_tokens",
        unit: "tokens",
        value: 500000,
      },
      {
        service: "embeddings:text-embedding-3-small",
        metric: "model_requests",
        unit: "requests",
        value: 80,
      },
    ]);
    expect(billing).toEqual([
      {
        amount_minor: 1300,
        currency: "USD",
        status: "estimated",
      },
    ]);
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
  });

  it("syncs Supabase usage and health from fixture mode without credentials or raw Supabase persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(
      ["sync", "--provider", "supabase"],
      testContext(cwd, {
        STACKSPEND_SUPABASE_FIXTURE: SUPABASE_FIXTURE_PATH,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Synced Supabase usage and health snapshots");

    const dbPath = join(cwd, ".stackspend", "stackspend.sqlite");
    const counts = querySqlite<{
      providers: number;
      provider_accounts: number;
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
        (SELECT count(*) FROM provider_accounts) AS provider_accounts,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts;
      `,
    )[0];
    const usage = querySqlite<{ service: string; metric: string; unit: string; value: number }>(
      dbPath,
      `
      SELECT service, metric, unit, value
      FROM usage_snapshots
      ORDER BY value DESC, metric;
      `,
    );
    const health = querySqlite<{ service: string; region: string | null; status: string; message: string | null }>(
      dbPath,
      `
      SELECT service, region, status, message
      FROM service_health_snapshots
      ORDER BY service, status;
      `,
    );
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

    expect(counts).toEqual({
      providers: 1,
      provider_accounts: 2,
      usage_snapshots: 8,
      billing_snapshots: 0,
      service_health_snapshots: 5,
      cost_estimates: 0,
      alerts: 1,
    });
    expect(usage.map(({ metric, unit, value }) => ({ metric, unit, value }))).toEqual([
      {
        metric: "api_requests",
        unit: "requests",
        value: 5082,
      },
      {
        metric: "rest_requests",
        unit: "requests",
        value: 3400,
      },
      {
        metric: "auth_requests",
        unit: "requests",
        value: 1200,
      },
      {
        metric: "storage_requests",
        unit: "requests",
        value: 450,
      },
      {
        metric: "realtime_requests",
        unit: "requests",
        value: 32,
      },
      {
        metric: "api_requests",
        unit: "requests",
        value: 11,
      },
      {
        metric: "rest_requests",
        unit: "requests",
        value: 10,
      },
      {
        metric: "storage_requests",
        unit: "requests",
        value: 1,
      },
    ]);
    expect(health.map(({ region, status, message }) => ({ region, status, message }))).toEqual(
      expect.arrayContaining([
        {
          region: "ap-northeast-2",
          status: "degraded",
          message: "FAKE degraded fixture message",
        },
        {
          region: "ap-northeast-2",
          status: "ok",
          message: null,
        },
        {
          region: "us-east-1",
          status: "degraded",
          message: "Project is paused.",
        },
      ]),
    );
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
    expect(persistedProviderDataText).not.toMatch(/fake-supabase-ref|fake-supabase-org|FAKE StackSpend/i);
  });

  it("syncs Cloudflare billing and usage from fixture mode without credentials or raw Cloudflare persistence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-cli-"));
    const result = await runCli(
      ["sync", "--provider", "cloudflare"],
      testContext(cwd, {
        STACKSPEND_CLOUDFLARE_FIXTURE: CLOUDFLARE_FIXTURE_PATH,
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("Synced Cloudflare billing and usage snapshots");

    const dbPath = join(cwd, ".stackspend", "stackspend.sqlite");
    const counts = querySqlite<{
      providers: number;
      provider_accounts: number;
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
        (SELECT count(*) FROM provider_accounts) AS provider_accounts,
        (SELECT count(*) FROM usage_snapshots) AS usage_snapshots,
        (SELECT count(*) FROM billing_snapshots) AS billing_snapshots,
        (SELECT count(*) FROM service_health_snapshots) AS service_health_snapshots,
        (SELECT count(*) FROM cost_estimates) AS cost_estimates,
        (SELECT count(*) FROM alerts) AS alerts;
      `,
    )[0];
    const usage = querySqlite<{ service: string; metric: string; unit: string; value: number }>(
      dbPath,
      `
      SELECT service, metric, unit, value
      FROM usage_snapshots
      ORDER BY service, metric;
      `,
    );
    const billing = querySqlite<{ amount_minor: number; currency: string; status: string }>(
      dbPath,
      `
      SELECT amount_minor, currency, status
      FROM billing_snapshots;
      `,
    );
    const health = querySqlite<{ service: string; status: string; message: string | null }>(
      dbPath,
      `
      SELECT service, status, message
      FROM service_health_snapshots
      ORDER BY service;
      `,
    );
    const alerts = querySqlite<{ severity: string; title: string; message: string }>(
      dbPath,
      `
      SELECT severity, title, message
      FROM alerts;
      `,
    );
    const persistedProviderDataText = dumpPersistedProviderDataText(dbPath);

    expect(counts).toEqual({
      providers: 1,
      provider_accounts: 1,
      usage_snapshots: 2,
      billing_snapshots: 1,
      service_health_snapshots: 2,
      cost_estimates: 1,
      alerts: 1,
    });
    expect(usage.map(({ metric, unit, value }) => ({ metric, unit, value }))).toEqual([
      {
        metric: "billable_quantity",
        unit: "GB",
        value: 128.5,
      },
      {
        metric: "billable_quantity",
        unit: "requests",
        value: 2500,
      },
    ]);
    expect(billing).toEqual([
      {
        amount_minor: 1236,
        currency: "USD",
        status: "estimated",
      },
    ]);
    expect(health.map(({ status, message }) => ({ status, message }))).toEqual([
      {
        status: "degraded",
        message: "Cloudflare billing usage API unavailable for this account.",
      },
      {
        status: "ok",
        message: "Cloudflare billing usage API available.",
      },
    ]);
    expect(alerts).toEqual([
      {
        severity: "warning",
        title: "Cloudflare billable usage surface unavailable",
        message: "Cloudflare billable usage API was restricted or unavailable; normalized sync continued with available data.",
      },
    ]);
    expect(persistedProviderDataText).not.toMatch(FORBIDDEN_PERSISTED_PROVIDER_DATA_PATTERN);
    expect(persistedProviderDataText).not.toMatch(/FAKE StackSpend|FAKE Restricted|FAKE Subscription/i);
  });
});

type SqliteValueRow = Record<string, string | number | null>;

function querySqlite<T>(dbPath: string, sql: string): T[] {
  const output = execFileSync("/usr/bin/sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
  }).trim();

  if (output.length === 0) {
    return [];
  }

  return JSON.parse(output) as T[];
}

function dumpPersistedProviderDataText(dbPath: string): string {
  const rows: SqliteValueRow[] = [
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT provider_key, display_name, connector_version FROM providers ORDER BY provider_key;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT account_label, account_ref FROM provider_accounts ORDER BY account_label, account_ref;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT service, metric, unit, metadata_json FROM usage_snapshots ORDER BY service, metric, unit;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT currency, status, metadata_json FROM billing_snapshots ORDER BY currency, status;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT service, region, status, message, metadata_json FROM service_health_snapshots ORDER BY service, status;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT currency, confidence, metadata_json FROM cost_estimates ORDER BY currency, confidence;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT severity, category, title, message, metadata_json FROM alerts ORDER BY severity, category, title;",
    ),
    ...querySqlite<SqliteValueRow>(
      dbPath,
      "SELECT language, delivery_target, status, metadata_json FROM report_runs ORDER BY language, delivery_target, status;",
    ),
  ];

  return rows
    .flatMap((row) => Object.values(row).filter((value): value is string => typeof value === "string"))
    .join("\n");
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
