import { createHash } from "node:crypto";

export type NotificationAlertSeverity = "info" | "warning" | "critical";

export interface NormalizedNotificationAlert {
  providerKey: string;
  category: string;
  severity: NotificationAlertSeverity;
  occurredAt: string;
}

export interface NotificationHistoryRecord {
  fingerprint: string;
  outcome: "delivered" | "suppressed" | "error" | "attempted";
  attemptedAt: string;
}

export interface NotificationEvaluationPolicy {
  enabled: boolean;
  now: Date;
  quietStart: string;
  quietEnd: string;
  cooldownMinutes: number;
  recent: readonly NotificationHistoryRecord[];
}

export interface NotificationEvaluation {
  outcome: "deliver" | "suppressed";
  reason: "deliver" | "notifications_disabled" | "no_alerts" | "quiet_hours" | "cooldown";
  fingerprint: string;
  title: string;
  body: string;
  severity: NotificationAlertSeverity;
}

export function evaluateNormalizedNotification(
  alerts: readonly NormalizedNotificationAlert[],
  policy: NotificationEvaluationPolicy,
): NotificationEvaluation {
  const normalized = alerts.map(validateAlert).sort(compareAlerts);
  const fingerprint = notificationFingerprint(normalized);
  const severity = highestSeverity(normalized);
  const title = severity === "critical" ? "MoneySiren critical alert" : "MoneySiren alert";
  const providerCount = new Set(normalized.map((alert) => alert.providerKey)).size;
  const criticalCount = normalized.filter((alert) => alert.severity === "critical").length;
  const body = normalized.length === 0
    ? "No new alerts."
    : `${normalized.length} alert${normalized.length === 1 ? "" : "s"} across ${providerCount} provider${providerCount === 1 ? "" : "s"}${criticalCount === 0 ? "." : ` (${criticalCount} critical).`}`;
  const base = { fingerprint, title, body, severity };

  if (!policy.enabled) {
    return { ...base, outcome: "suppressed", reason: "notifications_disabled" };
  }

  if (normalized.length === 0) {
    return { ...base, outcome: "suppressed", reason: "no_alerts" };
  }

  if (isWithinQuietHours(policy.now, policy.quietStart, policy.quietEnd)) {
    return { ...base, outcome: "suppressed", reason: "quiet_hours" };
  }

  const cooldownMs = normalizeCooldown(policy.cooldownMinutes) * 60_000;
  const nowMs = policy.now.getTime();
  const duplicate = policy.recent.some((record) =>
    record.fingerprint === fingerprint &&
    record.outcome === "delivered" &&
    Number.isFinite(Date.parse(record.attemptedAt)) &&
    nowMs - Date.parse(record.attemptedAt) >= 0 &&
    nowMs - Date.parse(record.attemptedAt) < cooldownMs
  );

  if (duplicate) {
    return { ...base, outcome: "suppressed", reason: "cooldown" };
  }

  return { ...base, outcome: "deliver", reason: "deliver" };
}

export function notificationFingerprint(alerts: readonly NormalizedNotificationAlert[]): string {
  const stable = alerts.map(validateAlert).sort(compareAlerts).map((alert) =>
    [alert.providerKey, alert.category, alert.severity].join(":")
  ).join("|");

  return createHash("sha256").update(stable.length === 0 ? "no-alerts" : stable).digest("hex");
}

function validateAlert(alert: NormalizedNotificationAlert): NormalizedNotificationAlert {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(alert.providerKey)) {
    throw new Error("Notification provider key is invalid.");
  }

  if (!/^[a-z0-9][a-z0-9_.-]{0,63}$/i.test(alert.category)) {
    throw new Error("Notification category is invalid.");
  }

  if (!["info", "warning", "critical"].includes(alert.severity)) {
    throw new Error("Notification severity is invalid.");
  }

  if (!Number.isFinite(Date.parse(alert.occurredAt))) {
    throw new Error("Notification timestamp is invalid.");
  }

  return alert;
}

function compareAlerts(left: NormalizedNotificationAlert, right: NormalizedNotificationAlert): number {
  return [
    left.providerKey,
    left.category,
    left.severity,
  ].join(":").localeCompare([
    right.providerKey,
    right.category,
    right.severity,
  ].join(":"));
}

function highestSeverity(alerts: readonly NormalizedNotificationAlert[]): NotificationAlertSeverity {
  if (alerts.some((alert) => alert.severity === "critical")) return "critical";
  if (alerts.some((alert) => alert.severity === "warning")) return "warning";
  return "info";
}

function isWithinQuietHours(now: Date, startValue: string, endValue: string): boolean {
  const start = parseClock(startValue);
  const end = parseClock(endValue);

  if (start === null || end === null || start === end) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

function normalizeCooldown(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Notification cooldown must be non-negative.");
  }

  return Math.min(1440, Math.round(value));
}
