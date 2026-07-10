import "server-only";

import {
  unavailableCodexAccountUsage,
  unavailableCodexRateLimits,
} from "./app-server-normalize";
import {
  readCodexAppServerOfficialMeasurements,
  type CodexOfficialAccountMeasurements,
} from "./app-server-transport";

const DEFAULT_CACHE_TTL_MS = 15_000;
const MAX_CACHE_TTL_MS = 60_000;

export interface ReadCodexAppServerClientOptions {
  cacheTtlMs?: number;
  clock?: () => number;
  read?: () => Promise<CodexOfficialAccountMeasurements>;
}

let cached: {
  expiresAt: number;
  value: CodexOfficialAccountMeasurements;
} | null = null;
let inFlight: Promise<CodexOfficialAccountMeasurements> | null = null;

/**
 * Deduplicates concurrent dashboard reads and briefly caches only the normalized
 * allowlisted result. Raw JSON-RPC messages never enter this cache.
 */
export async function readCodexAppServerMeasurements(
  options: ReadCodexAppServerClientOptions = {},
): Promise<CodexOfficialAccountMeasurements> {
  const clock = options.clock ?? Date.now;
  const cacheTtlMs = boundedCacheTtl(options.cacheTtlMs);
  const now = clock();

  if (cached !== null && cached.expiresAt > now) {
    return cached.value;
  }

  if (inFlight !== null) {
    return await inFlight;
  }

  const read = options.read ?? readCodexAppServerOfficialMeasurements;

  const pending = read()
    .catch(() => unavailableMeasurements(safeClockIso(clock)))
    .then((value) => {
      if (cacheTtlMs > 0) {
        cached = {
          expiresAt: clock() + cacheTtlMs,
          value,
        };
      }

      return value;
    })
    .finally(() => {
      if (inFlight === pending) {
        inFlight = null;
      }
    });

  inFlight = pending;
  return await pending;
}

export function clearCodexAppServerClientCacheForTests(): void {
  cached = null;
  inFlight = null;
}

function safeClockIso(clock: () => number): string {
  try {
    const date = new Date(clock());
    return Number.isFinite(date.getTime())
      ? date.toISOString()
      : new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function unavailableMeasurements(fetchedAt: string): CodexOfficialAccountMeasurements {
  return {
    rateLimits: unavailableCodexRateLimits(fetchedAt, "unknown"),
    accountUsage: unavailableCodexAccountUsage(fetchedAt, "unknown"),
  };
}

function boundedCacheTtl(value: number | undefined): number {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? Math.min(MAX_CACHE_TTL_MS, Math.max(0, value))
    : DEFAULT_CACHE_TTL_MS;
}
