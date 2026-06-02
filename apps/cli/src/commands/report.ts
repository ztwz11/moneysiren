import {
  initializeLocalStore,
  readLocalStore,
  recordLocalReportRun,
  type LocalStore,
} from "../../../../packages/db/src/index.js";
import {
  renderDailyReport,
  sendSlackReport,
  type DailyProviderSummary,
  type DailyReportInput,
} from "../../../../packages/report/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { loadCliConfig, resolveDbPath } from "./shared.js";

type ReportDeliveryTarget = "stdout" | "slack";

interface ParsedDailyReportArgs {
  deliveryTarget: ReportDeliveryTarget;
}

export async function runReportCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const parsedArgs = parseDailyReportArgs(args);

  if (parsedArgs === undefined) {
    context.stderr("Usage: stackspend report daily --lang ko [--send slack]");
    return 1;
  }

  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);
  await initializeLocalStore({ dbPath });

  const now = context.now();
  const generatedAt = now.toISOString();
  const reportDate = generatedAt.slice(0, 10);
  const store = await readLocalStore({ dbPath });

  const reportInput: DailyReportInput = {
    reportDate,
    generatedAt,
    providerSummaries: buildProviderSummaries(store),
    reportRunStatus: parsedArgs.deliveryTarget === "slack" ? "sent" : "rendered",
  };

  if (parsedArgs.deliveryTarget === "slack") {
    return sendDailyReportToSlack({
      context,
      dbPath,
      reportDate,
      generatedAt,
      reportInput,
      webhookEnvKey: config.slack.requiredEnvKey,
    });
  }

  await recordLocalReportRun({
    dbPath,
    createdAt: generatedAt,
    reportDate,
    language: "ko",
    deliveryTarget: "stdout",
    status: "rendered",
  });

  context.stdout(renderDailyReport(reportInput, { lang: "ko" }));
  context.stdout("Report run recorded: stdout");
  return 0;
}

function parseDailyReportArgs(args: readonly string[]): ParsedDailyReportArgs | undefined {
  const [reportKind, ...rest] = args;

  if (reportKind !== "daily") {
    return undefined;
  }

  let lang: string | undefined;
  let deliveryTarget: ReportDeliveryTarget = "stdout";

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--lang") {
      const value = rest[index + 1];

      if (value === undefined) {
        return undefined;
      }

      lang = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--lang=")) {
      lang = arg.slice("--lang=".length);
      continue;
    }

    if (arg === "--send") {
      const value = rest[index + 1];

      if (value !== "slack") {
        return undefined;
      }

      deliveryTarget = "slack";
      index += 1;
      continue;
    }

    if (arg?.startsWith("--send=")) {
      const value = arg.slice("--send=".length);

      if (value !== "slack") {
        return undefined;
      }

      deliveryTarget = "slack";
      continue;
    }

    return undefined;
  }

  if (lang !== "ko") {
    return undefined;
  }

  return {
    deliveryTarget,
  };
}

async function sendDailyReportToSlack(input: {
  context: CliExecutionContext;
  dbPath: string;
  reportDate: string;
  generatedAt: string;
  reportInput: DailyReportInput;
  webhookEnvKey: "SLACK_WEBHOOK_URL";
}): Promise<number> {
  const webhookUrl = input.context.env[input.webhookEnvKey]?.trim();

  if (webhookUrl === undefined || webhookUrl.length === 0) {
    await recordSlackReportRun(input, "error");
    input.context.stderr(`${input.webhookEnvKey} is required for Slack delivery.`);
    return 1;
  }

  const text = renderDailyReport(input.reportInput, { lang: "ko" });

  try {
    const options = input.context.slackTransport === undefined
      ? {
          webhookUrl,
          text,
        }
      : {
          webhookUrl,
          text,
          transport: input.context.slackTransport,
        };

    await sendSlackReport(options);
    await recordSlackReportRun(input, "sent");
    input.context.stdout("Slack report sent: slack");
    return 0;
  } catch (error) {
    await recordSlackReportRun(input, "error");
    input.context.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function recordSlackReportRun(
  input: {
    dbPath: string;
    reportDate: string;
    generatedAt: string;
  },
  status: "sent" | "error",
): Promise<void> {
  await recordLocalReportRun({
    dbPath: input.dbPath,
    createdAt: input.generatedAt,
    reportDate: input.reportDate,
    language: "ko",
    deliveryTarget: "slack",
    status,
  });
}

function buildProviderSummaries(store: LocalStore): DailyProviderSummary[] {
  return store.providers.map((provider) => {
    const usageSnapshots = store.usageSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const billingSnapshots = store.billingSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const serviceHealthSnapshots = store.serviceHealthSnapshots.filter(
      (snapshot) => snapshot.providerKey === provider.key,
    );
    const costEstimates = store.costEstimates.filter((snapshot) => snapshot.providerKey === provider.key);
    const alerts = store.alerts.filter((alert) => alert.providerKey === provider.key);
    const currency = costEstimates[0]?.currency ?? billingSnapshots[0]?.currency ?? "USD";

    return {
      provider: provider.key,
      displayName: provider.displayName,
      syncStatus: summarizeSyncStatus([
        usageSnapshots.length,
        billingSnapshots.length,
        serviceHealthSnapshots.length,
        costEstimates.length,
      ]),
      usageSnapshotCount: usageSnapshots.length,
      billingSnapshotCount: billingSnapshots.length,
      healthStatus: summarizeHealth(serviceHealthSnapshots.map((snapshot) => snapshot.status)),
      estimatedAmountMinor: costEstimates.reduce((total, snapshot) => total + snapshot.estimatedAmountMinor, 0),
      currency,
      alertCount: alerts.length,
    };
  });
}

function summarizeSyncStatus(snapshotCounts: readonly number[]): DailyProviderSummary["syncStatus"] {
  return snapshotCounts.some((count) => count > 0) ? "ok" : "error";
}

function summarizeHealth(statuses: readonly DailyProviderSummary["healthStatus"][]): DailyProviderSummary["healthStatus"] {
  if (statuses.includes("down")) {
    return "down";
  }

  if (statuses.includes("degraded")) {
    return "degraded";
  }

  if (statuses.includes("unknown") || statuses.length === 0) {
    return "unknown";
  }

  return "ok";
}
