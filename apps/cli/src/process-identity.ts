import { basename, win32 } from "node:path";

export interface ManagedProcessIdentity {
  pid: number;
  startedAt: string;
  executablePath: string;
  nonce: string;
}

export interface ObservedProcessIdentity {
  pid: number;
  startedAt: string;
  executablePath: string;
}

export type ProcessIdentityVerification =
  | { status: "verified" }
  | { status: "stale"; reasonCode: "pid-mismatch" | "start-time-mismatch" | "executable-mismatch" }
  | { status: "unverifiable"; reasonCode: "legacy-record" | "invalid-record" | "invalid-observation" };

const NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_START_TIME_TOLERANCE_MS = 2_500;

export function observedIdentityFromElapsedSeconds(input: {
  pid: number;
  elapsedSeconds: number;
  executablePath: string;
  observedAtMs?: number;
}): ObservedProcessIdentity | null {
  if (!isPositiveSafeInteger(input.pid) || !Number.isFinite(input.elapsedSeconds) || input.elapsedSeconds < 0 || input.executablePath.trim().length === 0) {
    return null;
  }

  const observedAtMs = input.observedAtMs ?? Date.now();
  if (!Number.isFinite(observedAtMs)) {
    return null;
  }

  return {
    pid: input.pid,
    startedAt: new Date(observedAtMs - Math.floor(input.elapsedSeconds) * 1_000).toISOString(),
    executablePath: input.executablePath.trim(),
  };
}

export function verifyManagedProcessIdentity(
  expected: Partial<ManagedProcessIdentity>,
  observed: ObservedProcessIdentity,
  options: { platform?: NodeJS.Platform; startTimeToleranceMs?: number } = {},
): ProcessIdentityVerification {
  if (
    !isPositiveSafeInteger(expected.pid) ||
    typeof expected.startedAt !== "string" ||
    typeof expected.executablePath !== "string" ||
    typeof expected.nonce !== "string"
  ) {
    return { status: "unverifiable", reasonCode: "legacy-record" };
  }

  const expectedStartedAt = Date.parse(expected.startedAt);
  if (
    !Number.isFinite(expectedStartedAt) ||
    expected.executablePath.trim().length === 0 ||
    !NONCE_PATTERN.test(expected.nonce)
  ) {
    return { status: "unverifiable", reasonCode: "invalid-record" };
  }

  const observedStartedAt = Date.parse(observed.startedAt);
  if (
    !isPositiveSafeInteger(observed.pid) ||
    !Number.isFinite(observedStartedAt) ||
    observed.executablePath.trim().length === 0
  ) {
    return { status: "unverifiable", reasonCode: "invalid-observation" };
  }

  if (expected.pid !== observed.pid) {
    return { status: "stale", reasonCode: "pid-mismatch" };
  }

  const tolerance = options.startTimeToleranceMs ?? DEFAULT_START_TIME_TOLERANCE_MS;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return { status: "unverifiable", reasonCode: "invalid-record" };
  }

  if (Math.abs(expectedStartedAt - observedStartedAt) > tolerance) {
    return { status: "stale", reasonCode: "start-time-mismatch" };
  }

  if (!sameExecutable(expected.executablePath, observed.executablePath, options.platform ?? process.platform)) {
    return { status: "stale", reasonCode: "executable-mismatch" };
  }

  return { status: "verified" };
}

function sameExecutable(expected: string, observed: string, platform: NodeJS.Platform): boolean {
  const expectedNormalized = normalizeExecutable(expected, platform);
  const observedNormalized = normalizeExecutable(observed, platform);

  if (expectedNormalized === observedNormalized) {
    return true;
  }

  // Some POSIX ps implementations expose only the command basename. A basename
  // match is accepted only after PID and process start time have already matched.
  return platform !== "win32" &&
    basename(expectedNormalized) === basename(observedNormalized) &&
    !observedNormalized.includes("/");
}

function normalizeExecutable(value: string, platform: NodeJS.Platform): string {
  const trimmed = value.trim();

  if (platform === "win32") {
    return win32.normalize(trimmed).toLowerCase();
  }

  return trimmed.replaceAll("\\", "/");
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
