import {
  evaluateNormalizedNotification,
  type NormalizedNotificationAlert,
  type NotificationEvaluation,
  type NotificationHistoryRecord,
} from "./evaluator.js";

export interface NotificationProviderResult {
  providerKey: string;
  alerts: readonly NormalizedNotificationAlert[];
}

export interface NotificationProviderCollector {
  providerKey: string;
  minimumIntervalMinutes?: number;
  collect(): Promise<NotificationProviderResult>;
}

export interface NotificationSchedulerCycleInput {
  enabled: boolean;
  now: Date;
  quietStart: string;
  quietEnd: string;
  cooldownMinutes: number;
  recent: readonly NotificationHistoryRecord[];
  providers: readonly NotificationProviderCollector[];
}

export interface NotificationSchedulerCycleResult {
  skipped: boolean;
  evaluation: NotificationEvaluation;
  providerFailures: readonly {
    providerKey: string;
    errorCode: "PROVIDER_COLLECTION_FAILED";
  }[];
}

export async function runNotificationSchedulerCycle(
  input: NotificationSchedulerCycleInput,
): Promise<NotificationSchedulerCycleResult> {
  if (!input.enabled) {
    return {
      skipped: true,
      providerFailures: [],
      evaluation: evaluateNormalizedNotification([], {
        enabled: false,
        now: input.now,
        quietStart: input.quietStart,
        quietEnd: input.quietEnd,
        cooldownMinutes: input.cooldownMinutes,
        recent: input.recent,
      }),
    };
  }

  const alerts: NormalizedNotificationAlert[] = [];
  const providerFailures: Array<{ providerKey: string; errorCode: "PROVIDER_COLLECTION_FAILED" }> = [];

  for (const provider of input.providers) {
    validateProviderKey(provider.providerKey);

    try {
      const result = await provider.collect();

      if (result.providerKey !== provider.providerKey) {
        throw new Error("Provider result key mismatch.");
      }

      alerts.push(...result.alerts);
    } catch {
      providerFailures.push({
        providerKey: provider.providerKey,
        errorCode: "PROVIDER_COLLECTION_FAILED",
      });
    }
  }

  return {
    skipped: false,
    providerFailures,
    evaluation: evaluateNormalizedNotification(alerts, {
      enabled: true,
      now: input.now,
      quietStart: input.quietStart,
      quietEnd: input.quietEnd,
      cooldownMinutes: input.cooldownMinutes,
      recent: input.recent,
    }),
  };
}

export function computeNextNotificationRun(input: {
  now: Date;
  intervalMinutes?: number;
  providerMinimumMinutes?: readonly number[];
  jitterSeconds?: number;
  random?: () => number;
}): string {
  const requested = normalizeInterval(input.intervalMinutes ?? 15);
  const providerMinimum = Math.max(15, ...(input.providerMinimumMinutes ?? []).map(normalizeInterval));
  const intervalMinutes = Math.max(requested, providerMinimum);
  const jitterBound = normalizeJitter(input.jitterSeconds ?? 90);
  const random = input.random ?? Math.random;
  const rawSample = random();
  const sample = Number.isFinite(rawSample) ? Math.min(1, Math.max(0, rawSample)) : 0;
  const jitter = Math.round(sample * jitterBound);

  return new Date(input.now.getTime() + intervalMinutes * 60_000 + jitter * 1000).toISOString();
}

export function computeBackoffMinutes(consecutiveFailures: number): number {
  if (!Number.isSafeInteger(consecutiveFailures) || consecutiveFailures < 0) {
    throw new Error("Notification failure count must be a non-negative safe integer.");
  }

  return Math.min(360, 15 * 2 ** Math.min(consecutiveFailures, 5));
}

function normalizeInterval(value: number): number {
  if (!Number.isSafeInteger(value) || value < 15 || value > 1440) {
    throw new Error("Notification interval must be between 15 and 1440 minutes.");
  }

  return value;
}

function normalizeJitter(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 300) {
    throw new Error("Notification jitter must be between 0 and 300 seconds.");
  }

  return value;
}

function validateProviderKey(value: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) {
    throw new Error("Notification provider key is invalid.");
  }
}
