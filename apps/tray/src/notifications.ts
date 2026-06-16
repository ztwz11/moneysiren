import type {
  LocalApiClient,
  LocalNotificationDigest,
  LocalNotificationDigestItem,
  NotificationSeverity,
} from "./local-api.js";

export type NotificationSuppressionReason =
  | "suppressed_by_api"
  | "notifications_disabled"
  | "permission_denied"
  | "quiet_hours"
  | "paused"
  | "no_change"
  | "empty_digest"
  | "health_unavailable";

export type NotificationPermissionState = "granted" | "denied" | "prompt" | "unknown";

export interface QuietHoursWindow {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NotificationDeliveryRecord {
  fingerprint: string;
  deliveredAt: string;
  severity: NotificationSeverity | "unknown";
  title: string;
  bodyPreview: string;
  clickUrl?: string;
}

export interface NotificationEvaluationOptions {
  now?: Date;
  notificationPermission?: NotificationPermissionState;
  notificationsEnabled?: boolean;
  quietHours?: QuietHoursWindow;
  pausedUntil?: string | null;
  recentDeliveries?: readonly NotificationDeliveryRecord[];
  fingerprintTtlMinutes?: number;
}

export interface NotificationDecision {
  shouldNotify: boolean;
  reason: "deliver" | NotificationSuppressionReason;
  fingerprint: string;
  title: string;
  body: string;
  clickUrl?: string;
  deliveryRecord?: NotificationDeliveryRecord;
}

export interface NotificationPollResult extends NotificationDecision {
  healthChecked: boolean;
  digest?: LocalNotificationDigest;
}

const DEFAULT_FINGERPRINT_TTL_MINUTES = 180;

export async function pollNotificationDigestOnce(
  client: Pick<LocalApiClient, "getHealth" | "getNotificationDigest">,
  options: NotificationEvaluationOptions = {},
): Promise<NotificationPollResult> {
  const health = await client.getHealth();

  if (health.status !== "ok") {
    return {
      healthChecked: true,
      shouldNotify: false,
      reason: "health_unavailable",
      fingerprint: "health_unavailable",
      title: "MoneySiren",
      body: "Local API health is unavailable.",
    };
  }

  const digest = await client.getNotificationDigest();

  return {
    ...evaluateNotificationDigest(digest, options),
    healthChecked: true,
    digest,
  };
}

export function evaluateNotificationDigest(
  digest: LocalNotificationDigest,
  options: NotificationEvaluationOptions = {},
): NotificationDecision {
  const now = options.now ?? new Date();
  const fingerprint = computeDigestFingerprint(digest);
  const title = digest.title.trim().length > 0 ? digest.title : "MoneySiren";
  const body = digest.body ?? summarizeDigestItems(digest.items);
  const baseDecision = {
    fingerprint,
    title,
    body,
    ...(digest.clickUrl === undefined ? {} : { clickUrl: digest.clickUrl }),
  };

  if (options.notificationsEnabled === false) {
    return {
      ...baseDecision,
      shouldNotify: false,
      reason: "notifications_disabled",
    };
  }

  if (options.notificationPermission === "denied") {
    return {
      ...baseDecision,
      shouldNotify: false,
      reason: "permission_denied",
    };
  }

  if (digest.suppressedReason !== undefined && digest.suppressedReason !== null && digest.suppressedReason.length > 0) {
    return {
      ...baseDecision,
      shouldNotify: false,
      reason: "suppressed_by_api",
    };
  }

  if (isPaused(now, options.pausedUntil)) {
    return {
      ...baseDecision,
      shouldNotify: false,
      reason: "paused",
    };
  }

  if (isWithinQuietHours(now, options.quietHours)) {
    return {
      ...baseDecision,
      shouldNotify: false,
      reason: "quiet_hours",
    };
  }

  if (body.trim().length === 0 && digest.items.length === 0) {
    return {
      ...baseDecision,
      shouldNotify: false,
      reason: "empty_digest",
    };
  }

  if (wasRecentlyDelivered(fingerprint, now, options)) {
    return {
      ...baseDecision,
      shouldNotify: false,
      reason: "no_change",
    };
  }

  const deliveryRecord = buildDeliveryRecord(digest, {
    fingerprint,
    title,
    body,
    deliveredAt: now.toISOString(),
  });

  return {
    ...baseDecision,
    shouldNotify: true,
    reason: "deliver",
    deliveryRecord,
  };
}

export function computeDigestFingerprint(digest: LocalNotificationDigest): string {
  if (digest.fingerprint !== undefined && digest.fingerprint.trim().length > 0) {
    return digest.fingerprint.trim();
  }

  return stableJoin([
    digest.title,
    digest.body ?? "",
    digest.status ?? "",
    digest.severity ?? "",
    ...digest.items.map(fingerprintItem),
  ]);
}

export function isWithinQuietHours(now: Date, quietHours: QuietHoursWindow | undefined): boolean {
  if (quietHours === undefined || !quietHours.enabled) {
    return false;
  }

  const start = parseClockMinutes(quietHours.start);
  const end = parseClockMinutes(quietHours.end);

  if (start === null || end === null || start === end) {
    return false;
  }

  const minutes = now.getHours() * 60 + now.getMinutes();

  if (start < end) {
    return minutes >= start && minutes < end;
  }

  return minutes >= start || minutes < end;
}

function isPaused(now: Date, pausedUntil: string | null | undefined): boolean {
  if (pausedUntil === null || pausedUntil === undefined || pausedUntil.trim().length === 0) {
    return false;
  }

  const until = Date.parse(pausedUntil);

  return Number.isFinite(until) && now.getTime() < until;
}

function wasRecentlyDelivered(
  fingerprint: string,
  now: Date,
  options: NotificationEvaluationOptions,
): boolean {
  const recentDeliveries = options.recentDeliveries ?? [];
  const ttlMs = (options.fingerprintTtlMinutes ?? DEFAULT_FINGERPRINT_TTL_MINUTES) * 60 * 1000;

  return recentDeliveries.some((delivery) => {
    if (delivery.fingerprint !== fingerprint) {
      return false;
    }

    const deliveredAt = Date.parse(delivery.deliveredAt);

    return Number.isFinite(deliveredAt) && now.getTime() - deliveredAt <= ttlMs;
  });
}

function buildDeliveryRecord(
  digest: LocalNotificationDigest,
  values: {
    fingerprint: string;
    title: string;
    body: string;
    deliveredAt: string;
  },
): NotificationDeliveryRecord {
  return {
    fingerprint: values.fingerprint,
    deliveredAt: values.deliveredAt,
    severity: digest.severity ?? statusToSeverity(digest.status),
    title: values.title,
    bodyPreview: values.body.slice(0, 160),
    ...(digest.clickUrl === undefined ? {} : { clickUrl: digest.clickUrl }),
  };
}

function summarizeDigestItems(items: readonly LocalNotificationDigestItem[]): string {
  return items.map((item) => `${item.label}: ${item.value}`).join(" | ");
}

function fingerprintItem(item: LocalNotificationDigestItem): string {
  return stableJoin([
    item.key ?? "",
    item.widgetKey ?? "",
    item.kind ?? "",
    item.label,
    item.value,
    item.severity ?? "",
    item.clickPath ?? "",
  ]);
}

function stableJoin(parts: readonly string[]): string {
  return parts.map((part) => part.trim().replace(/\s+/g, " ")).join("::");
}

function parseClockMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (match === null) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function statusToSeverity(status: LocalNotificationDigest["status"]): NotificationSeverity | "unknown" {
  if (status === "critical") {
    return "critical";
  }

  if (status === "attention") {
    return "warning";
  }

  if (status === "ok") {
    return "info";
  }

  return "unknown";
}
