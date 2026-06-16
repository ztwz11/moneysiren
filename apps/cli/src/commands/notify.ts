import { stat } from "node:fs/promises";
import { sendSlackReport } from "../../../../packages/report/src/index.js";
import {
  NOTIFICATION_WIDGET_KEYS,
  readNotificationPreferencesFile,
  resolveNotificationPreferencesPath,
  writeNotificationPreferencesFile,
  type NotificationPreferences,
  type NotificationThresholdRule,
  type NotificationWidgetKey,
  type ThresholdOperator,
} from "../../../../packages/view-model/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { readSanitizedNotificationDigest } from "../summary-model.js";
import { loadCliConfig } from "./shared.js";

const NOTIFY_USAGE = [
  "Usage:",
  "  moneysiren notify once --dry-run",
  "  moneysiren notify prefs list",
  "  moneysiren notify prefs enable <widget>",
  "  moneysiren notify prefs disable <widget>",
  "  moneysiren notify prefs hud-enable <widget>",
  "  moneysiren notify prefs hud-disable <widget>",
  "  moneysiren notify prefs threshold <widget> --gte|--lte|--eq <value> --cooldown <minutes>",
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
  if (args.length !== 1 || args[0] !== "--dry-run") {
    context.stderr("Usage: moneysiren notify once --dry-run");
    return 1;
  }

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

  if (preferences.thresholdRules.length === 0) {
    context.stdout("Thresholds: none configured");
    return 0;
  }

  context.stdout("Thresholds:");

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
    widgetKey,
    operator,
    value,
    cooldownMinutes,
  };
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

function isValidClockTime(value: string | undefined): value is string {
  if (value === undefined || !/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
