import { stat } from "node:fs/promises";
import {
  readNotificationSchedulerState,
  readRecentNotificationDeliveries,
  recordNotificationDelivery,
  writeNotificationSchedulerState,
  type NotificationDeliveryReasonCode,
  type NotificationDeliveryTarget,
  type NotificationSchedulerErrorCode,
  type NotificationSchedulerState,
} from "../../../../packages/db/src/index.js";
import {
  computeNextNotificationRun,
  evaluateNormalizedNotification,
  type NormalizedNotificationAlert,
} from "../../../../packages/notifier/src/index.js";
import { readNotificationSchedulerLock } from "../../../../packages/runtime/src/index.js";
import { sendSlackReport } from "../../../../packages/report/src/index.js";
import {
  NOTIFICATION_WIDGET_KEYS,
  readNotificationPreferencesFile,
  resolveNotificationPreferencesPath,
  writeNotificationPreferencesFile,
  NOTIFICATION_THRESHOLD_MODES,
  type NotificationPreferences,
  type NotificationAggregateThresholdRule,
  type NotificationThresholdMode,
  type NotificationThresholdRule,
  type NotificationThresholdSettings,
  type NotificationWidgetKey,
  type ThresholdOperator,
} from "../../../../packages/view-model/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { readSanitizedNotificationDigest } from "../summary-model.js";
import { loadCliConfig, resolveDbPath } from "./shared.js";

const NOTIFY_USAGE = [
  "Usage:",
  "  moneysiren notify once --dry-run",
  "  moneysiren notify once --send <desktop|slack|all>",
  "  moneysiren notify scheduler enable [--interval <minutes>]",
  "  moneysiren notify scheduler disable",
  "  moneysiren notify scheduler status",
  "  moneysiren notify prefs list",
  "  moneysiren notify prefs enable <widget>",
  "  moneysiren notify prefs disable <widget>",
  "  moneysiren notify prefs hud-enable <widget>",
  "  moneysiren notify prefs hud-disable <widget>",
  "  moneysiren notify prefs threshold <widget> --gte|--lte|--eq <value> --cooldown <minutes>",
  "  moneysiren notify prefs threshold-mode <cost|usage> <aggregate|individual|all>",
  "  moneysiren notify prefs threshold-aggregate <cost|usage> --gte|--lte|--eq <value> --cooldown <minutes>",
  "  moneysiren notify prefs quiet-hours <start> <end>",
  "  moneysiren notify test",
].join("\n");

const NOTIFY_PREFS_USAGE = [
  "Usage:",
  "  moneysiren notify prefs list",
  "  moneysiren notify prefs enable <widget>",
  "  moneysiren notify prefs disable <widget>",
  "  moneysiren notify prefs hud-enable <widget>",
  "  moneysiren notify prefs hud-disable <widget>",
  "  moneysiren notify prefs threshold <widget> --gte|--lte|--eq <value> --cooldown <minutes>",
  "  moneysiren notify prefs threshold-mode <cost|usage> <aggregate|individual|all>",
  "  moneysiren notify prefs threshold-aggregate <cost|usage> --gte|--lte|--eq <value> --cooldown <minutes>",
  "  moneysiren notify prefs quiet-hours <start> <end>",
].join("\n");

export async function runNotifyCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
    context.stdout(NOTIFY_USAGE);
    return 0;
  }

  if (subcommand === "once") {
    return runNotifyOnce(rest, context);
  }

  if (subcommand === "scheduler") {
    return runNotifyScheduler(rest, context);
  }

  if (subcommand === "prefs") {
    return runNotifyPrefs(rest, context);
  }

  if (subcommand === "test") {
    return runNotifyTest(rest, context);
  }

  context.stderr(NOTIFY_USAGE);
  return 1;
}

async function runNotifyOnce(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.length === 1 && args[0] === "--dry-run") {
    return printNotificationDryRun(context);
  }

  const sendTarget = parseSendTarget(args);

  if (sendTarget === undefined) {
    context.stderr("Usage: moneysiren notify once --dry-run | --send <desktop|slack|all>");
    return 1;
  }

  const now = context.now();
  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);
  const schedulerState = await readNotificationSchedulerState(dbPath);
  const preferences = await readPreferences(context);
  const digest = await readSanitizedNotificationDigest(context);
  const recent = await readRecentNotificationDeliveries(dbPath, { limit: 200 });
  const alert = notificationAlertFromDigest(digest);
  const evaluation = evaluateNormalizedNotification(alert === undefined ? [] : [alert], {
    enabled: preferences.enabled,
    now,
    quietStart: preferences.quietHours.start,
    quietEnd: preferences.quietHours.end,
    cooldownMinutes: Math.max(60, ...preferences.thresholdRules.map((rule) => rule.cooldownMinutes)),
    recent,
  });
  const targets: NotificationDeliveryTarget[] = sendTarget === "all"
    ? ["desktop", "slack"]
    : [sendTarget];

  if (evaluation.outcome === "suppressed") {
    for (const target of targets) {
      await recordNotificationDelivery({
        dbPath,
        fingerprint: evaluation.fingerprint,
        target,
        outcome: "suppressed",
        reasonCode: evaluation.reason,
        attemptedAt: now.toISOString(),
      });
    }

    await writeSchedulerOutcome(dbPath, schedulerState, now, undefined);
    context.stdout(`Notification suppressed: ${evaluation.reason}`);
    context.stdout("Secrets returned: false");
    return 0;
  }

  let lastErrorCode: NotificationSchedulerErrorCode | undefined;

  for (const target of targets) {
    await recordNotificationDelivery({
      dbPath,
      fingerprint: evaluation.fingerprint,
      target,
      outcome: "attempted",
      reasonCode: "delivery_requested",
      attemptedAt: now.toISOString(),
    });

    try {
      if (target === "desktop") {
        await deliverDesktopNotification(evaluation.title, evaluation.body, context);
      } else {
        await deliverSlackNotification(evaluation.title, evaluation.body, context);
      }

      await recordNotificationDelivery({
        dbPath,
        fingerprint: evaluation.fingerprint,
        target,
        outcome: "delivered",
        reasonCode: "delivered",
        attemptedAt: now.toISOString(),
      });
      context.stdout(`Notification delivered: ${target}`);
    } catch (error) {
      const failure = deliveryFailure(error, target);
      lastErrorCode = failure.schedulerErrorCode;
      await recordNotificationDelivery({
        dbPath,
        fingerprint: evaluation.fingerprint,
        target,
        outcome: "error",
        reasonCode: failure.reasonCode,
        attemptedAt: now.toISOString(),
      });
      context.stderr(`Notification delivery failed: ${target} (${failure.reasonCode})`);
    }
  }

  await writeSchedulerOutcome(dbPath, schedulerState, now, lastErrorCode);
  context.stdout("Secrets returned: false");
  return lastErrorCode === undefined ? 0 : 1;
}

async function printNotificationDryRun(context: CliExecutionContext): Promise<number> {
  const digest = await readSanitizedNotificationDigest(context);

  context.stdout("MoneySiren notification dry run");
  context.stdout(`Generated at: ${digest.generatedAt}`);
  context.stdout(`Secrets returned: ${digest.secretsReturned}`);
  context.stdout(`Providers: ${digest.providerCount}`);
  context.stdout(`Health: ${digest.health}`);
  context.stdout(`Alerts: ${digest.alertCount}`);
  context.stdout(`Critical alerts: ${digest.criticalAlertCount}`);

  if (digest.estimatedAmountMinorByCurrency.length === 0) {
    context.stdout("Estimated totals: none");
    return 0;
  }

  for (const total of digest.estimatedAmountMinorByCurrency) {
    context.stdout(`Estimated total ${total.currency}: ${formatMinorAmount(total.amountMinor)}`);
  }

  return 0;
}

async function runNotifyScheduler(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [subcommand, ...rest] = args;
  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);
  const state = await readNotificationSchedulerState(dbPath);
  const now = context.now();

  if (subcommand === "status" && rest.length === 0) {
    const owner = await readNotificationSchedulerLock({ cwd: context.cwd, env: context.env });
    context.stdout("MoneySiren notification scheduler");
    context.stdout(`Enabled: ${state.enabled}`);
    context.stdout(`Interval minutes: ${state.intervalMinutes}`);
    context.stdout(`Last run: ${state.lastRunAt ?? "never"}`);
    context.stdout(`Next run: ${state.nextRunAt ?? "not scheduled"}`);
    context.stdout(`Last error: ${state.lastErrorCode ?? "none"}`);
    context.stdout(`Runtime owner: ${owner === null ? "idle" : "locked"}`);
    context.stdout("Secrets returned: false");
    return 0;
  }

  if (subcommand === "enable") {
    const intervalMinutes = parseSchedulerInterval(rest);

    if (intervalMinutes === undefined) {
      context.stderr("Usage: moneysiren notify scheduler enable [--interval <15-1440>]");
      return 1;
    }

    await writeNotificationSchedulerState({
      dbPath,
      ...state,
      enabled: true,
      intervalMinutes,
      nextRunAt: computeNextNotificationRun({
        now,
        intervalMinutes,
        jitterSeconds: state.jitterSeconds,
      }),
      consecutiveFailures: 0,
      updatedAt: now.toISOString(),
    });
    context.stdout("Notification scheduler enabled");
    context.stdout("Scheduled provider collection remains local and read-only.");
    context.stdout("Secrets returned: false");
    return 0;
  }

  if (subcommand === "disable" && rest.length === 0) {
    const {
      nextRunAt: _nextRunAt,
      lastErrorCode: _lastErrorCode,
      ...disabledState
    } = state;
    await writeNotificationSchedulerState({
      dbPath,
      ...disabledState,
      enabled: false,
      consecutiveFailures: 0,
      updatedAt: now.toISOString(),
    });
    context.stdout("Notification scheduler disabled");
    context.stdout("Secrets returned: false");
    return 0;
  }

  context.stderr("Usage: moneysiren notify scheduler <enable|disable|status>");
  return 1;
}

function parseSchedulerInterval(args: readonly string[]): number | undefined {
  if (args.length === 0) return 15;

  let value: string | undefined;
  if (args.length === 2 && args[0] === "--interval") value = args[1];
  if (args.length === 1 && args[0]?.startsWith("--interval=")) value = args[0].slice("--interval=".length);
  const parsed = value === undefined ? Number.NaN : Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 15 && parsed <= 1440 ? parsed : undefined;
}

function parseSendTarget(args: readonly string[]): NotificationDeliveryTarget | "all" | undefined {
  let value: string | undefined;

  if (args.length === 2 && args[0] === "--send") value = args[1];
  if (args.length === 1 && args[0]?.startsWith("--send=")) value = args[0].slice("--send=".length);

  return value === "desktop" || value === "slack" || value === "all" ? value : undefined;
}

function notificationAlertFromDigest(
  digest: Awaited<ReturnType<typeof readSanitizedNotificationDigest>>,
): NormalizedNotificationAlert | undefined {
  if (digest.criticalAlertCount > 0) {
    return {
      providerKey: "summary",
      category: "critical-alerts",
      severity: "critical",
      occurredAt: digest.generatedAt,
    };
  }

  if (digest.health === "down" || digest.health === "degraded") {
    return {
      providerKey: "summary",
      category: "service-health",
      severity: "warning",
      occurredAt: digest.generatedAt,
    };
  }

  if (digest.alertCount > 0) {
    return {
      providerKey: "summary",
      category: "alerts",
      severity: "info",
      occurredAt: digest.generatedAt,
    };
  }

  return undefined;
}

async function deliverDesktopNotification(
  title: string,
  body: string,
  context: CliExecutionContext,
): Promise<void> {
  const transport = context.desktopNotification;

  if (transport === undefined) {
    throw new DeliveryError("desktop_unavailable", "DESKTOP_UNAVAILABLE");
  }

  let permission = await transport.permission();

  if ((permission === "prompt" || permission === "unknown") && transport.requestPermission !== undefined) {
    permission = await transport.requestPermission();
  }

  if (permission !== "granted") {
    throw new DeliveryError("permission_denied", "DESKTOP_PERMISSION_DENIED");
  }

  await transport.send({
    title: title.slice(0, 80),
    body: body.slice(0, 240),
    clickPath: "/dashboard/risks",
  });
}

async function deliverSlackNotification(
  title: string,
  body: string,
  context: CliExecutionContext,
): Promise<void> {
  const config = loadCliConfig(context.env);
  const webhookUrl = context.env[config.slack.requiredEnvKey]?.trim();

  if (webhookUrl === undefined || webhookUrl.length === 0) {
    throw new DeliveryError("slack_unavailable", "SLACK_DELIVERY_FAILED");
  }

  try {
    await sendSlackReport({
      webhookUrl,
      text: `*${title}*\n${body}`,
      ...(context.slackTransport === undefined ? {} : { transport: context.slackTransport }),
    });
  } catch {
    throw new DeliveryError("delivery_failed", "SLACK_DELIVERY_FAILED");
  }
}

async function writeSchedulerOutcome(
  dbPath: string,
  state: NotificationSchedulerState,
  now: Date,
  errorCode: NotificationSchedulerErrorCode | undefined,
): Promise<void> {
  const base = {
    dbPath,
    ...state,
    lastRunAt: now.toISOString(),
    consecutiveFailures: errorCode === undefined ? 0 : state.consecutiveFailures + 1,
    updatedAt: now.toISOString(),
  };

  if (errorCode === undefined) {
    const { lastErrorCode: _lastErrorCode, ...successState } = base;
    await writeNotificationSchedulerState(successState);
    return;
  }

  await writeNotificationSchedulerState({
    ...base,
    lastErrorCode: errorCode,
  });
}

class DeliveryError extends Error {
  constructor(
    readonly reasonCode: NotificationDeliveryReasonCode,
    readonly schedulerErrorCode: NotificationSchedulerErrorCode,
  ) {
    super(reasonCode);
    this.name = "DeliveryError";
  }
}

function deliveryFailure(error: unknown, target: NotificationDeliveryTarget): DeliveryError {
  if (error instanceof DeliveryError) return error;
  return target === "slack"
    ? new DeliveryError("delivery_failed", "SLACK_DELIVERY_FAILED")
    : new DeliveryError("delivery_failed", "DELIVERY_FAILED");
}

async function runNotifyPrefs(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === "list" && rest.length === 0) {
    return listNotificationPreferences(context);
  }

  if (subcommand === "enable" && rest.length === 1) {
    return enableNotificationWidget(rest[0], context);
  }

  if (subcommand === "disable" && rest.length === 1) {
    return disableNotificationWidget(rest[0], context);
  }

  if (subcommand === "hud-enable" && rest.length === 1) {
    return enableHudWidget(rest[0], context);
  }

  if (subcommand === "hud-disable" && rest.length === 1) {
    return disableHudWidget(rest[0], context);
  }

  if (subcommand === "threshold") {
    return setNotificationThreshold(rest, context);
  }

  if (subcommand === "threshold-mode" && rest.length === 2) {
    return setNotificationThresholdMode(rest[0], rest[1], context);
  }

  if (subcommand === "threshold-aggregate") {
    return setNotificationAggregateThreshold(rest, context);
  }

  if (subcommand === "quiet-hours" && rest.length === 2) {
    return setNotificationQuietHours(rest[0], rest[1], context);
  }

  context.stderr(NOTIFY_PREFS_USAGE);
  return 1;
}

async function listNotificationPreferences(context: CliExecutionContext): Promise<number> {
  const source = await notificationPreferencesSource(context);
  const preferences = await readPreferences(context);
  const selectedWidgets = new Set(preferences.selectedWidgets);
  const hudWidgets = new Set(preferences.hud.selectedWidgets);

  context.stdout("MoneySiren notification preferences");
  context.stdout(`Source: ${source}`);
  context.stdout("Secrets returned: false");
  context.stdout(`Notifications: ${enabledLabel(preferences.enabled)}`);
  context.stdout(`Digest: ${enabledLabel(preferences.digestEnabled)} (${preferences.digestInterval})`);
  context.stdout(`Desktop notifications: ${enabledLabel(preferences.desktopEnabled)}`);
  context.stdout(`HUD font size: ${Math.round(preferences.hud.fontScale * 100)}%`);
  context.stdout(`HUD opacity: ${Math.round(preferences.hud.opacity * 100)}%`);
  context.stdout(`Quiet hours: ${preferences.quietHours.start}-${preferences.quietHours.end}`);
  context.stdout("Widgets:");

  for (const widgetKey of NOTIFICATION_WIDGET_KEYS) {
    context.stdout(`- ${widgetKey}: ${selectedWidgets.has(widgetKey) ? "enabled" : "disabled"}`);
  }

  context.stdout("HUD widgets:");

  for (const widgetKey of NOTIFICATION_WIDGET_KEYS) {
    context.stdout(`- ${widgetKey}: ${hudWidgets.has(widgetKey) ? "enabled" : "disabled"}`);
  }

  context.stdout("Thresholds:");
  context.stdout(`- cost mode: ${preferences.thresholdSettings.cost.mode}`);
  context.stdout(`- cost aggregate: ${formatAggregateThreshold(preferences.thresholdSettings.cost.aggregateRule)}`);
  context.stdout(`- usage mode: ${preferences.thresholdSettings.usage.mode}`);
  context.stdout(`- usage aggregate: ${formatAggregateThreshold(preferences.thresholdSettings.usage.aggregateRule)}`);

  if (preferences.thresholdRules.length === 0) {
    context.stdout("- widget rules: none configured");
    return 0;
  }

  for (const rule of orderThresholdRules(preferences.thresholdRules)) {
    context.stdout(`- ${rule.widgetKey}: ${rule.operator} ${formatRuleValue(rule.value)} cooldown ${rule.cooldownMinutes}m`);
  }

  return 0;
}

async function enableNotificationWidget(widget: string | undefined, context: CliExecutionContext): Promise<number> {
  const widgetKey = parseWidgetKey(widget);

  if (widgetKey === undefined) {
    context.stderr("Unknown notification widget.");
    return 1;
  }

  const preferences = await readPreferences(context);
  const selectedWidgets = new Set(preferences.selectedWidgets);
  selectedWidgets.add(widgetKey);
  await writePreferences({
    ...preferences,
    selectedWidgets: orderWidgetKeys([...selectedWidgets]),
  }, context);

  context.stdout(`Notification widget enabled: ${widgetKey}`);
  context.stdout("Secrets returned: false");
  return 0;
}

async function disableNotificationWidget(widget: string | undefined, context: CliExecutionContext): Promise<number> {
  const widgetKey = parseWidgetKey(widget);

  if (widgetKey === undefined) {
    context.stderr("Unknown notification widget.");
    return 1;
  }

  const preferences = await readPreferences(context);
  const selectedWidgets = new Set(preferences.selectedWidgets);

  if (!selectedWidgets.has(widgetKey)) {
    context.stdout(`Notification widget already disabled: ${widgetKey}`);
    context.stdout("Secrets returned: false");
    return 0;
  }

  selectedWidgets.delete(widgetKey);

  if (selectedWidgets.size === 0) {
    context.stderr("At least one notification widget must remain enabled.");
    return 1;
  }

  await writePreferences({
    ...preferences,
    selectedWidgets: orderWidgetKeys([...selectedWidgets]),
  }, context);

  context.stdout(`Notification widget disabled: ${widgetKey}`);
  context.stdout("Secrets returned: false");
  return 0;
}

async function enableHudWidget(widget: string | undefined, context: CliExecutionContext): Promise<number> {
  const widgetKey = parseWidgetKey(widget);

  if (widgetKey === undefined) {
    context.stderr("Unknown notification widget.");
    return 1;
  }

  const preferences = await readPreferences(context);
  const selectedWidgets = new Set(preferences.hud.selectedWidgets);
  selectedWidgets.add(widgetKey);
  await writePreferences({
    ...preferences,
    hud: {
      ...preferences.hud,
      selectedWidgets: orderWidgetKeys([...selectedWidgets]),
    },
  }, context);

  context.stdout(`HUD widget enabled: ${widgetKey}`);
  context.stdout("Secrets returned: false");
  return 0;
}

async function disableHudWidget(widget: string | undefined, context: CliExecutionContext): Promise<number> {
  const widgetKey = parseWidgetKey(widget);

  if (widgetKey === undefined) {
    context.stderr("Unknown notification widget.");
    return 1;
  }

  const preferences = await readPreferences(context);
  const selectedWidgets = new Set(preferences.hud.selectedWidgets);

  if (!selectedWidgets.has(widgetKey)) {
    context.stdout(`HUD widget already disabled: ${widgetKey}`);
    context.stdout("Secrets returned: false");
    return 0;
  }

  selectedWidgets.delete(widgetKey);

  if (selectedWidgets.size === 0) {
    context.stderr("At least one HUD widget must remain enabled.");
    return 1;
  }

  await writePreferences({
    ...preferences,
    hud: {
      ...preferences.hud,
      selectedWidgets: orderWidgetKeys([...selectedWidgets]),
    },
  }, context);

  context.stdout(`HUD widget disabled: ${widgetKey}`);
  context.stdout("Secrets returned: false");
  return 0;
}

async function setNotificationThreshold(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [widget, ...flagArgs] = args;
  const widgetKey = parseWidgetKey(widget);
  const parsedRule = parseThresholdRuleArgs(widgetKey, flagArgs);

  if (widgetKey === undefined) {
    context.stderr("Unknown notification widget.");
    return 1;
  }

  if (parsedRule === undefined) {
    context.stderr("Usage: moneysiren notify prefs threshold <widget> --gte|--lte|--eq <value> --cooldown <minutes>");
    return 1;
  }

  const preferences = await readPreferences(context);
  await writePreferences({
    ...preferences,
    thresholdRules: orderThresholdRules([
      ...preferences.thresholdRules.filter((rule) => rule.widgetKey !== widgetKey),
      parsedRule,
    ]),
  }, context);

  context.stdout(
    `Notification threshold set: ${parsedRule.widgetKey} ${parsedRule.operator} ${formatRuleValue(parsedRule.value)} cooldown ${parsedRule.cooldownMinutes}m`,
  );
  context.stdout("Secrets returned: false");
  return 0;
}

async function setNotificationThresholdMode(
  categoryValue: string | undefined,
  modeValue: string | undefined,
  context: CliExecutionContext,
): Promise<number> {
  const category = parseThresholdCategory(categoryValue);
  const mode = parseThresholdMode(modeValue);

  if (category === undefined || mode === undefined) {
    context.stderr("Usage: moneysiren notify prefs threshold-mode <cost|usage> <aggregate|individual|all>");
    return 1;
  }

  const preferences = await readPreferences(context);
  await writePreferences({
    ...preferences,
    thresholdSettings: {
      ...preferences.thresholdSettings,
      [category]: {
        ...preferences.thresholdSettings[category],
        mode,
      },
    },
  }, context);

  context.stdout(`Notification threshold mode set: ${category} ${mode}`);
  context.stdout("Secrets returned: false");
  return 0;
}

async function setNotificationAggregateThreshold(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [categoryValue, ...flagArgs] = args;
  const category = parseThresholdCategory(categoryValue);
  const aggregateRule = parseAggregateThresholdRuleArgs(flagArgs);

  if (category === undefined || aggregateRule === undefined) {
    context.stderr("Usage: moneysiren notify prefs threshold-aggregate <cost|usage> --gte|--lte|--eq <value> --cooldown <minutes>");
    return 1;
  }

  const preferences = await readPreferences(context);
  await writePreferences({
    ...preferences,
    thresholdSettings: {
      ...preferences.thresholdSettings,
      [category]: {
        ...preferences.thresholdSettings[category],
        aggregateRule,
      },
    },
  }, context);

  context.stdout(
    `Notification aggregate threshold set: ${category} ${aggregateRule.operator} ${formatRuleValue(aggregateRule.value)} cooldown ${aggregateRule.cooldownMinutes}m`,
  );
  context.stdout("Secrets returned: false");
  return 0;
}

async function setNotificationQuietHours(
  start: string | undefined,
  end: string | undefined,
  context: CliExecutionContext,
): Promise<number> {
  if (!isValidClockTime(start) || !isValidClockTime(end)) {
    context.stderr("Usage: moneysiren notify prefs quiet-hours <HH:MM> <HH:MM>");
    return 1;
  }

  const preferences = await readPreferences(context);
  await writePreferences({
    ...preferences,
    quietHours: {
      start,
      end,
    },
  }, context);

  context.stdout(`Notification quiet hours set: ${start}-${end}`);
  context.stdout("Secrets returned: false");
  return 0;
}

async function runNotifyTest(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.length !== 0) {
    context.stderr("Usage: moneysiren notify test");
    return 1;
  }

  const config = loadCliConfig(context.env);
  const webhookEnvKey = config.slack.requiredEnvKey;
  const webhookUrl = context.env[webhookEnvKey]?.trim();

  if (webhookUrl === undefined || webhookUrl.length === 0) {
    context.stderr(`${webhookEnvKey} is required for test notification.`);
    return 1;
  }

  const text = [
    "MoneySiren test notification",
    `Generated at: ${context.now().toISOString()}`,
    "Secrets returned: false",
  ].join("\n");

  try {
    const options = context.slackTransport === undefined
      ? {
          webhookUrl,
          text,
        }
      : {
          webhookUrl,
          text,
          transport: context.slackTransport,
        };

    await sendSlackReport(options);
    context.stdout("MoneySiren test notification sent");
    context.stdout("Secrets returned: false");
    return 0;
  } catch (error) {
    context.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function formatMinorAmount(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

async function readPreferences(context: CliExecutionContext): Promise<NotificationPreferences> {
  return readNotificationPreferencesFile({
    cwd: context.cwd,
    env: context.env,
  });
}

async function writePreferences(
  preferences: NotificationPreferences,
  context: CliExecutionContext,
): Promise<NotificationPreferences> {
  return writeNotificationPreferencesFile(preferences, {
    cwd: context.cwd,
    env: context.env,
  });
}

async function notificationPreferencesSource(context: CliExecutionContext): Promise<string> {
  const path = resolveNotificationPreferencesPath({
    cwd: context.cwd,
    env: context.env,
  });

  try {
    await stat(path);
    return "local preference file";
  } catch {
    return "default preference template";
  }
}

function parseWidgetKey(value: string | undefined): NotificationWidgetKey | undefined {
  return value !== undefined && NOTIFICATION_WIDGET_KEYS.includes(value as NotificationWidgetKey)
    ? value as NotificationWidgetKey
    : undefined;
}

function parseThresholdRuleArgs(
  widgetKey: NotificationWidgetKey | undefined,
  args: readonly string[],
): NotificationThresholdRule | undefined {
  if (widgetKey === undefined) {
    return undefined;
  }

  const parsedRule = parseThresholdValueArgs(args);

  return parsedRule === undefined
    ? undefined
    : {
        widgetKey,
        ...parsedRule,
      };
}

function parseAggregateThresholdRuleArgs(args: readonly string[]): NotificationAggregateThresholdRule | undefined {
  return parseThresholdValueArgs(args);
}

function parseThresholdValueArgs(args: readonly string[]): NotificationAggregateThresholdRule | undefined {
  let operator: ThresholdOperator | undefined;
  let value: number | undefined;
  let cooldownMinutes: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      return undefined;
    }

    const operatorName = parseOperatorFlag(arg);

    if (operatorName !== undefined) {
      if (operator !== undefined) {
        return undefined;
      }

      const inlineValue = inlineFlagValue(arg);
      const rawValue = inlineValue ?? args[index + 1];
      value = parseNonNegativeNumber(rawValue);
      operator = operatorName;

      if (inlineValue === undefined) {
        index += 1;
      }

      continue;
    }

    if (arg === "--cooldown" || arg.startsWith("--cooldown=")) {
      const inlineValue = inlineFlagValue(arg);
      const rawValue = inlineValue ?? args[index + 1];
      cooldownMinutes = parseNonNegativeInteger(rawValue);

      if (inlineValue === undefined) {
        index += 1;
      }

      continue;
    }

    return undefined;
  }

  if (operator === undefined || value === undefined || cooldownMinutes === undefined) {
    return undefined;
  }

  return {
    operator,
    value,
    cooldownMinutes,
  };
}

function parseThresholdCategory(value: string | undefined): keyof NotificationThresholdSettings | undefined {
  return value === "cost" || value === "usage" ? value : undefined;
}

function parseThresholdMode(value: string | undefined): NotificationThresholdMode | undefined {
  return value !== undefined && NOTIFICATION_THRESHOLD_MODES.includes(value as NotificationThresholdMode)
    ? value as NotificationThresholdMode
    : undefined;
}

function parseOperatorFlag(value: string): ThresholdOperator | undefined {
  if (value === "--gte" || value.startsWith("--gte=")) {
    return "gte";
  }

  if (value === "--lte" || value.startsWith("--lte=")) {
    return "lte";
  }

  if (value === "--eq" || value.startsWith("--eq=")) {
    return "eq";
  }

  return undefined;
}

function inlineFlagValue(value: string): string | undefined {
  const separatorIndex = value.indexOf("=");

  return separatorIndex === -1 ? undefined : value.slice(separatorIndex + 1);
}

function parseNonNegativeNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  const parsed = parseNonNegativeNumber(value);

  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}

function orderWidgetKeys(widgetKeys: readonly NotificationWidgetKey[]): NotificationWidgetKey[] {
  const selected = new Set(widgetKeys);

  return NOTIFICATION_WIDGET_KEYS.filter((widgetKey) => selected.has(widgetKey));
}

function orderThresholdRules(rules: readonly NotificationThresholdRule[]): NotificationThresholdRule[] {
  const byWidgetKey = new Map(rules.map((rule) => [rule.widgetKey, rule]));

  return NOTIFICATION_WIDGET_KEYS.flatMap((widgetKey) => {
    const rule = byWidgetKey.get(widgetKey);

    return rule === undefined ? [] : [rule];
  });
}

function enabledLabel(value: boolean): string {
  return value ? "enabled" : "disabled";
}

function formatRuleValue(value: number): string {
  return String(value);
}

function formatAggregateThreshold(rule: NotificationAggregateThresholdRule): string {
  return `${rule.operator} ${formatRuleValue(rule.value)} cooldown ${rule.cooldownMinutes}m`;
}

function isValidClockTime(value: string | undefined): value is string {
  if (value === undefined || !/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
