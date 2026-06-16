import { stat } from "node:fs/promises";
import type { CliExecutionContext } from "../cli.js";
import { loadCliConfig, resolveDbPath } from "./shared.js";

const DEFAULT_DASHBOARD_URL = "http://localhost:3000";
const DASHBOARD_CHECK_TIMEOUT_MS = 2_000;
const DASHBOARD_CHECK_USAGE = "Usage: moneysiren dashboard check [--url <local-dashboard-url>]";

interface ParsedDashboardCheckArgs {
  dashboardUrl: string;
}

interface SanitizedDashboardUrl {
  dashboardUrl: string;
  apiUrl: string;
  ignoredUnsafeParts: boolean;
}

interface DashboardPayloadSummary {
  source: "sqlite" | "empty";
  generatedAt: string;
  providerCount: number;
  databaseAvailable: boolean;
  databaseReason: "ok" | "missing";
}

class DashboardCheckTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Dashboard API request timed out after ${timeoutMs}ms.`);
  }
}

export async function runDashboardCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
    context.stdout(DASHBOARD_CHECK_USAGE);
    return 0;
  }

  if (subcommand !== "check") {
    context.stderr(DASHBOARD_CHECK_USAGE);
    return 1;
  }

  if (rest.includes("--help") || rest.includes("-h")) {
    context.stdout(DASHBOARD_CHECK_USAGE);
    return 0;
  }

  const parsedArgs = parseDashboardCheckArgs(rest);

  if (parsedArgs === undefined) {
    context.stderr(DASHBOARD_CHECK_USAGE);
    return 1;
  }

  const sanitizedUrl = sanitizeDashboardUrl(parsedArgs.dashboardUrl);

  if (sanitizedUrl instanceof Error) {
    context.stderr(sanitizedUrl.message);
    context.stderr(DASHBOARD_CHECK_USAGE);
    return 1;
  }

  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);
  const dbExists = await pathExists(dbPath);

  context.stdout("MoneySiren dashboard check");
  context.stdout(`Dashboard URL: ${sanitizedUrl.dashboardUrl}`);
  context.stdout(`API endpoint: ${sanitizedUrl.apiUrl}`);

  if (sanitizedUrl.ignoredUnsafeParts) {
    context.stdout("URL note: path, query, and hash were ignored for safety.");
  }

  context.stdout(`DB path: ${config.dbPath}`);
  context.stdout(`DB exists locally: ${dbExists}`);

  try {
    const response = await fetchDashboardApi(context, sanitizedUrl.apiUrl, DASHBOARD_CHECK_TIMEOUT_MS);
    context.stdout(`API status: ${response.status}${response.ok ? " OK" : ""}`);

    if (!response.ok) {
      writeDashboardDevGuidance(context);
      return 1;
    }

    const payload = parseDashboardPayload(await response.json());

    if (payload === undefined) {
      context.stderr("Dashboard API returned an unexpected payload shape.");
      writeDashboardDevGuidance(context);
      return 1;
    }

    const dashboardState = isSafeEmptyDashboardState(payload) ? "safe empty state" : "data available";

    context.stdout(`Payload source: ${payload.source}`);
    context.stdout(`Provider count: ${payload.providerCount}`);
    context.stdout(`Generated at: ${payload.generatedAt}`);
    context.stdout(`Payload database: ${payload.databaseAvailable ? "available" : "missing"} (${payload.databaseReason})`);
    context.stdout(`Dashboard state: ${dashboardState}`);
    writeDashboardSuccessGuidance(context, payload);
    return 0;
  } catch (error) {
    context.stdout(
      error instanceof DashboardCheckTimeoutError
        ? `API status: timeout after ${DASHBOARD_CHECK_TIMEOUT_MS}ms`
        : "API status: unreachable",
    );
    writeDashboardDevGuidance(context);
    return 1;
  }
}

function parseDashboardCheckArgs(args: readonly string[]): ParsedDashboardCheckArgs | undefined {
  let dashboardUrl = DEFAULT_DASHBOARD_URL;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--url") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return undefined;
      }

      dashboardUrl = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--url=")) {
      const value = arg.slice("--url=".length);

      if (value.trim().length === 0) {
        return undefined;
      }

      dashboardUrl = value;
      continue;
    }

    return undefined;
  }

  return {
    dashboardUrl,
  };
}

function sanitizeDashboardUrl(rawUrl: string): SanitizedDashboardUrl | Error {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    return new Error("Dashboard URL must be a valid http:// or https:// URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return new Error("Dashboard URL must use http:// or https://.");
  }

  if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
    return new Error("Dashboard URL must not include credentials.");
  }

  if (!isLocalDashboardHost(parsedUrl.hostname)) {
    return new Error("Dashboard URL must point to localhost, 127.0.0.1, ::1, or 0.0.0.0.");
  }

  const dashboardUrl = parsedUrl.origin;
  const apiUrl = new URL("/api/dashboard", dashboardUrl).toString();
  const ignoredUnsafeParts = parsedUrl.pathname !== "/" || parsedUrl.search.length > 0 || parsedUrl.hash.length > 0;

  return {
    dashboardUrl,
    apiUrl,
    ignoredUnsafeParts,
  };
}

function isLocalDashboardHost(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]";
}

async function pathExists(path: string): Promise<"yes" | "no" | "unknown"> {
  try {
    await stat(path);
    return "yes";
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "no";
    }

    return "unknown";
  }
}

async function fetchDashboardApi(
  context: CliExecutionContext,
  apiUrl: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const fetchPromise = context.fetch(apiUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: controller.signal,
  });
  fetchPromise.catch(() => undefined);

  const timeoutPromise = new Promise<Response>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new DashboardCheckTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function parseDashboardPayload(payload: unknown): DashboardPayloadSummary | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const source = payload.source;
  const generatedAt = payload.generatedAt;
  const database = payload.database;
  const summary = payload.summary;

  if ((source !== "sqlite" && source !== "empty") || !isSafeIsoTimestamp(generatedAt)) {
    return undefined;
  }

  if (!isRecord(database) || !isRecord(summary)) {
    return undefined;
  }

  const databaseAvailable = database.available;
  const databaseReason = database.reason;
  const providerCount = summary.providerCount;

  if (
    typeof databaseAvailable !== "boolean" ||
    (databaseReason !== "ok" && databaseReason !== "missing") ||
    typeof providerCount !== "number" ||
    !Number.isSafeInteger(providerCount) ||
    providerCount < 0
  ) {
    return undefined;
  }

  return {
    source,
    generatedAt,
    providerCount,
    databaseAvailable,
    databaseReason,
  };
}

function isSafeEmptyDashboardState(payload: DashboardPayloadSummary): boolean {
  return payload.source === "empty" &&
    payload.providerCount === 0 &&
    !payload.databaseAvailable &&
    payload.databaseReason === "missing";
}

function isSafeIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function writeDashboardDevGuidance(context: CliExecutionContext): void {
  context.stderr("Next step: start the local dashboard from the repo root:");
  context.stderr("  pnpm --filter @moneysiren/web dev");
  context.stderr("Then re-run:");
  context.stderr("  pnpm --filter moneysiren dev -- dashboard check");
}

function writeDashboardSuccessGuidance(context: CliExecutionContext, payload: DashboardPayloadSummary): void {
  if (isSafeEmptyDashboardState(payload)) {
    context.stdout("Next step: sync mock data if you want a populated dashboard review:");
    context.stdout("  pnpm --filter moneysiren dev -- sync --provider mock");
    return;
  }

  context.stdout("Next step: open the dashboard URL above in your browser.");
}
