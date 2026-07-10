import "server-only";

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import webPackage from "../../../package.json";
import {
  normalizeCodexAccountUsageResult,
  normalizeCodexRateLimitsResult,
  unavailableCodexAccountUsage,
  unavailableCodexRateLimits,
} from "./app-server-normalize";
import type {
  CodexAccountUsageMeasurement,
  CodexRateLimitsMeasurement,
  CodexUnavailableReason,
} from "./types";

const INITIALIZE_REQUEST_ID = 0;
const RATE_LIMITS_REQUEST_ID = 1;
const ACCOUNT_USAGE_REQUEST_ID = 2;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_LINE_BYTES = 512 * 1_024;

export interface CodexOfficialAccountMeasurements {
  rateLimits: CodexRateLimitsMeasurement;
  accountUsage: CodexAccountUsageMeasurement;
}

export type CodexAppServerSpawn = (
  command: string,
  args: readonly string[],
) => ChildProcessWithoutNullStreams;

export interface ReadCodexAppServerOptions {
  now?: () => Date;
  timeoutMs?: number;
  maxLineBytes?: number;
  spawnProcess?: CodexAppServerSpawn;
}

export interface CodexAppServerAdvance {
  outbound: readonly string[];
  result: CodexOfficialAccountMeasurements | null;
}

export interface CodexAppServerDecodedChunk {
  lines: readonly string[];
  oversized: boolean;
}

/**
 * Frames newline-delimited JSON without retaining completed protocol messages.
 */
export class CodexAppServerJsonlDecoder {
  private buffer = "";

  constructor(private readonly maxLineBytes: number) {}

  push(chunk: Buffer | string): CodexAppServerDecodedChunk {
    this.buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
    const lines: string[] = [];
    let newlineIndex = this.buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const rawLine = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (Buffer.byteLength(rawLine, "utf8") > this.maxLineBytes) {
        this.buffer = "";
        return { lines, oversized: true };
      }

      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

      if (line.trim().length > 0) {
        lines.push(line);
      }

      newlineIndex = this.buffer.indexOf("\n");
    }

    if (Buffer.byteLength(this.buffer, "utf8") > this.maxLineBytes) {
      this.buffer = "";
      return { lines, oversized: true };
    }

    return { lines, oversized: false };
  }
}

/**
 * A small JSONL/JSON-RPC state machine for the official Codex App Server.
 *
 * It never returns JSON-RPC envelopes. Relevant results are normalized into the
 * public allowlisted contract before they leave this class.
 */
export class CodexAppServerSession {
  private initialized = false;
  private rateLimits: CodexRateLimitsMeasurement | null = null;
  private accountUsage: CodexAccountUsageMeasurement | null = null;

  constructor(private readonly fetchedAt: string) {}

  initialRequestLine(): string {
    return serialize({
      method: "initialize",
      id: INITIALIZE_REQUEST_ID,
      params: {
        clientInfo: {
          name: "moneysiren",
          title: "MoneySiren",
          version: webPackage.version,
        },
      },
    });
  }

  acceptLine(line: string): CodexAppServerAdvance {
    let value: unknown;

    try {
      value = JSON.parse(line) as unknown;
    } catch {
      return {
        outbound: [],
        result: this.finishPending("malformed-response"),
      };
    }

    const message = asRecord(value);

    if (message === null) {
      return {
        outbound: [],
        result: this.finishPending("malformed-response"),
      };
    }

    if (!Object.hasOwn(message, "id")) {
      // App Server notifications are unrelated to this read-only extraction.
      return { outbound: [], result: this.resultIfComplete() };
    }

    const id = message.id;

    if (id === INITIALIZE_REQUEST_ID) {
      if (this.initialized) {
        return { outbound: [], result: this.resultIfComplete() };
      }

      if (Object.hasOwn(message, "error")) {
        return {
          outbound: [],
          result: this.finishPending(reasonFromRpcError(message.error)),
        };
      }

      if (!Object.hasOwn(message, "result")) {
        return {
          outbound: [],
          result: this.finishPending("malformed-response"),
        };
      }

      this.initialized = true;

      return {
        outbound: [
          serialize({ method: "initialized", params: {} }),
          serialize({ method: "account/rateLimits/read", id: RATE_LIMITS_REQUEST_ID }),
          serialize({ method: "account/usage/read", id: ACCOUNT_USAGE_REQUEST_ID }),
        ],
        result: this.resultIfComplete(),
      };
    }

    if (id !== RATE_LIMITS_REQUEST_ID && id !== ACCOUNT_USAGE_REQUEST_ID) {
      return { outbound: [], result: this.resultIfComplete() };
    }

    if (!this.initialized) {
      return {
        outbound: [],
        result: this.finishPending("malformed-response"),
      };
    }

    if (id === RATE_LIMITS_REQUEST_ID && this.rateLimits === null) {
      this.rateLimits = Object.hasOwn(message, "error")
        ? unavailableCodexRateLimits(
            this.fetchedAt,
            reasonFromRpcError(message.error),
          )
        : Object.hasOwn(message, "result")
          ? normalizeCodexRateLimitsResult(message.result, this.fetchedAt)
          : unavailableCodexRateLimits(this.fetchedAt, "malformed-response");
    }

    if (id === ACCOUNT_USAGE_REQUEST_ID && this.accountUsage === null) {
      this.accountUsage = Object.hasOwn(message, "error")
        ? unavailableCodexAccountUsage(
            this.fetchedAt,
            reasonFromRpcError(message.error),
          )
        : Object.hasOwn(message, "result")
          ? normalizeCodexAccountUsageResult(message.result, this.fetchedAt)
          : unavailableCodexAccountUsage(this.fetchedAt, "malformed-response");
    }

    return { outbound: [], result: this.resultIfComplete() };
  }

  finishPending(reason: CodexUnavailableReason): CodexOfficialAccountMeasurements {
    this.rateLimits ??= unavailableCodexRateLimits(this.fetchedAt, reason);
    this.accountUsage ??= unavailableCodexAccountUsage(this.fetchedAt, reason);

    return {
      rateLimits: this.rateLimits,
      accountUsage: this.accountUsage,
    };
  }

  private resultIfComplete(): CodexOfficialAccountMeasurements | null {
    if (this.rateLimits === null || this.accountUsage === null) {
      return null;
    }

    return {
      rateLimits: this.rateLimits,
      accountUsage: this.accountUsage,
    };
  }
}

/**
 * Starts the installed Codex CLI's official local App Server over stdio.
 *
 * The process owns its authentication. MoneySiren does not read auth files,
 * make undocumented HTTP requests, persist envelopes, or surface stdout/stderr.
 */
export async function readCodexAppServerOfficialMeasurements(
  options: ReadCodexAppServerOptions = {},
): Promise<CodexOfficialAccountMeasurements> {
  const now = options.now ?? (() => new Date());
  const fetchedAt = now().toISOString();
  const session = new CodexAppServerSession(fetchedAt);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 250, 30_000);
  const maxLineBytes = boundedInteger(
    options.maxLineBytes,
    DEFAULT_MAX_LINE_BYTES,
    1_024,
    2 * 1_024 * 1_024,
  );

  const spawnProcess = options.spawnProcess ?? spawnCodexAppServer;
  let child: ChildProcessWithoutNullStreams;

  try {
    child = spawnProcess("codex", ["app-server", "--stdio"]);
  } catch (error) {
    return session.finishPending(reasonFromProcessError(error));
  }

  const decoder = new CodexAppServerJsonlDecoder(maxLineBytes);

  return await new Promise<CodexOfficialAccountMeasurements>((resolve) => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: CodexOfficialAccountMeasurements) => {
      if (finished) {
        return;
      }

      finished = true;

      if (timer !== null) {
        clearTimeout(timer);
      }

      try {
        child.kill();
      } catch {
        // The child may already be closed.
      }

      resolve(result);
    };

    const send = (line: string) => {
      if (finished || child.stdin.destroyed) {
        return;
      }

      try {
        child.stdin.write(`${line}\n`, "utf8");
      } catch {
        finish(session.finishPending("unknown"));
      }
    };

    const processLine = (line: string) => {
      const advance = session.acceptLine(line);

      for (const outbound of advance.outbound) {
        send(outbound);
      }

      if (advance.result !== null) {
        finish(advance.result);
      }
    };

    child.stderr.resume();

    child.stdout.on("data", (chunk: Buffer | string) => {
      if (finished) {
        return;
      }

      const decoded = decoder.push(chunk);

      for (const line of decoded.lines) {
        if (finished) {
          return;
        }

        processLine(line);
      }

      if (!finished && decoded.oversized) {
        finish(session.finishPending("oversized-response"));
      }
    });

    child.once("error", (error) => {
      finish(session.finishPending(reasonFromProcessError(error)));
    });

    child.once("close", () => {
      finish(session.finishPending("no-data"));
    });

    child.stdin.once("error", () => {
      finish(session.finishPending("unknown"));
    });

    timer = setTimeout(() => {
      finish(session.finishPending("timeout"));
    }, timeoutMs);

    send(session.initialRequestLine());
  });
}

function spawnCodexAppServer(
  command: string,
  args: readonly string[],
): ChildProcessWithoutNullStreams {
  return spawn(command, [...args], {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
}

function reasonFromRpcError(value: unknown): CodexUnavailableReason {
  const error = asRecord(value);

  if (error?.code === -32601) {
    return "unsupported-method";
  }

  const message = typeof error?.message === "string"
    ? error.message.toLowerCase()
    : "";

  if (
    message.includes("api key") ||
    message.includes("apikey") ||
    message.includes("bedrock") ||
    message.includes("unsupported auth")
  ) {
    return "unsupported-auth-mode";
  }

  if (
    message.includes("not authenticated") ||
    message.includes("authentication required") ||
    message.includes("login required") ||
    message.includes("not logged in")
  ) {
    return "not-authenticated";
  }

  return "unknown";
}

function reasonFromProcessError(value: unknown): CodexUnavailableReason {
  const error = value as NodeJS.ErrnoException | null;

  return error?.code === "ENOENT" ? "not-installed" : "unknown";
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
