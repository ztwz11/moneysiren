import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  parseNotificationPreferences,
  readNotificationDigest,
  readNotificationPreferencesFile,
  readOperationsOverview,
  readTodayLiveView,
  readTrayMenuModel,
  writeNotificationPreferencesFile,
  type NotificationPreferences,
  type ReadTrayMenuModelOptions,
} from "../../view-model/src/index.js";
import {
  assertLoopbackHost,
  isLoopbackHost,
  removeRuntimeLock,
  writeRuntimeLock,
  type LocalRuntime,
  type RuntimeLockOptions,
} from "../../runtime/src/index.js";

export interface LocalApiReaders {
  readSummary: () => Promise<unknown>;
  readTodayLiveView: () => Promise<unknown>;
  readNotificationDigest: () => Promise<unknown>;
  readTrayMenuModel: () => Promise<unknown>;
  readNotificationPreferences: () => Promise<NotificationPreferences>;
  writeNotificationPreferences: (preferences: NotificationPreferences) => Promise<NotificationPreferences>;
}

export interface LocalApiServerOptions {
  host?: string;
  port?: number;
  now?: () => Date;
  version?: string;
  viewModel?: ReadTrayMenuModelOptions;
  readers?: Partial<LocalApiReaders>;
  runtimeLock?: false | RuntimeLockOptions;
  preferences?: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    path?: string;
  };
  localSessionToken?: string;
}

export interface LocalApiServer {
  server: Server;
  host: string;
  port: number;
  baseUrl: string;
  runtime: LocalRuntime;
  close: () => Promise<void>;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 47831;
const DEFAULT_VERSION = "0.1.0-alpha.39";

export async function startLocalApiServer(options: LocalApiServerOptions = {}): Promise<LocalApiServer> {
  const host = options.host ?? DEFAULT_HOST;
  const requestedPort = options.port ?? DEFAULT_PORT;
  const version = options.version ?? DEFAULT_VERSION;
  const now = options.now ?? (() => new Date());

  assertLoopbackHost(host);

  let runtime: LocalRuntime = {
    pid: process.pid,
    port: requestedPort,
    baseUrl: `http://${host}:${requestedPort}`,
    startedAt: now().toISOString(),
    version,
  };
  const readers = createReaders(options, now);
  const server = createServer((request, response) => {
    void handleRequest(request, response, {
      readers,
      runtime: () => runtime,
      localSessionToken: options.localSessionToken,
    });
  });

  const port = await listenWithPortFallback(server, requestedPort, host);
  const baseUrl = `http://${host}:${port}`;
  runtime = {
    ...runtime,
    port,
    baseUrl,
  };

  if (options.runtimeLock !== false) {
    try {
      await writeRuntimeLock(runtime, options.runtimeLock ?? {});
    } catch (error) {
      await closeServer(server);
      throw error;
    }
  }

  return {
    server,
    host,
    port,
    baseUrl,
    runtime,
    close: async () => {
      await closeServer(server);

      if (options.runtimeLock !== false) {
        await removeRuntimeLock(options.runtimeLock ?? {});
      }
    },
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: {
    readers: LocalApiReaders;
    runtime: () => LocalRuntime;
    localSessionToken: string | undefined;
  },
): Promise<void> {
  if (!applyLocalCors(request, response) || !assertLocalHostRequest(request, response)) {
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = requestUrl(request);

  if (request.method === "PUT" && url.pathname === "/api/local/notification-preferences") {
    if (!hasValidLocalSessionToken(request, context.localSessionToken)) {
      sendJson(response, 401, localError("local_session_required", "A local session token is required for write endpoints."));
      return;
    }

    try {
      const preferences = parseNotificationPreferences(await readJsonBody(request));
      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        localOnly: true,
        secretsReturned: false,
        preferences: await context.readers.writeNotificationPreferences(preferences),
      });
    } catch (error) {
      sendJson(response, 400, localError("invalid_preferences", error instanceof Error ? error.message : "Invalid notification preferences."));
    }

    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, localError("method_not_allowed", "Only GET requests are supported for this endpoint."));
    return;
  }

  if (url.pathname === "/api/local/health") {
    sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      localOnly: true,
      secretsReturned: false,
      status: "ok",
      loopbackOnly: true,
      runtime: context.runtime(),
    });
    return;
  }

  if (url.pathname === "/api/local/runtime") {
    sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      localOnly: true,
      secretsReturned: false,
      runtime: context.runtime(),
    });
    return;
  }

  if (url.pathname === "/api/local/summary") {
    sendJson(response, 200, await context.readers.readSummary());
    return;
  }

  if (url.pathname === "/api/local/today-live") {
    sendJson(response, 200, await context.readers.readTodayLiveView());
    return;
  }

  if (url.pathname === "/api/local/notification-digest") {
    sendJson(response, 200, await context.readers.readNotificationDigest());
    return;
  }

  if (url.pathname === "/api/local/tray-menu") {
    sendJson(response, 200, await context.readers.readTrayMenuModel());
    return;
  }

  if (url.pathname === "/api/local/notification-preferences") {
    sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      localOnly: true,
      secretsReturned: false,
      preferences: await context.readers.readNotificationPreferences(),
    });
    return;
  }

  sendJson(response, 404, localError("not_found", "Endpoint not found."));
}

function createReaders(options: LocalApiServerOptions, now: () => Date): LocalApiReaders {
  const viewModel = options.now === undefined
    ? options.viewModel ?? {}
    : {
        ...(options.viewModel ?? {}),
        now,
      };

  const preferenceOptions = notificationPreferenceFileOptions(options);
  const readNotificationPreferences = options.readers?.readNotificationPreferences ??
    (() => readNotificationPreferencesFile(preferenceOptions));

  return {
    readSummary: options.readers?.readSummary ?? (() => readOperationsOverview(viewModel)),
    readTodayLiveView: options.readers?.readTodayLiveView ?? (() => readTodayLiveView(viewModel)),
    readNotificationDigest: options.readers?.readNotificationDigest ?? (async () =>
      readNotificationDigest({
        ...viewModel,
        notificationPreferences: await readNotificationPreferences(),
      })),
    readTrayMenuModel: options.readers?.readTrayMenuModel ?? (async () =>
      readTrayMenuModel({
        ...viewModel,
        notificationPreferences: await readNotificationPreferences(),
      })),
    readNotificationPreferences,
    writeNotificationPreferences: options.readers?.writeNotificationPreferences ??
      ((preferences) => writeNotificationPreferencesFile(preferences, preferenceOptions)),
  };
}

function notificationPreferenceFileOptions(options: LocalApiServerOptions): {
  cwd?: string;
  env?: Record<string, string | undefined>;
  path?: string;
} {
  const runtimeLock = options.runtimeLock === false ? undefined : options.runtimeLock;
  const fileOptions: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    path?: string;
  } = {};
  const cwd = options.preferences?.cwd ?? runtimeLock?.cwd;
  const env = options.preferences?.env ?? runtimeLock?.env;
  const path = options.preferences?.path;

  if (cwd !== undefined) {
    fileOptions.cwd = cwd;
  }

  if (env !== undefined) {
    fileOptions.env = env;
  }

  if (path !== undefined) {
    fileOptions.path = path;
  }

  return fileOptions;
}

function applyLocalCors(request: IncomingMessage, response: ServerResponse): boolean {
  const origin = request.headers.origin;

  if (origin === undefined) {
    return true;
  }

  if (!isLoopbackOrigin(origin)) {
    sendJson(response, 403, localError("forbidden_origin", "Only loopback browser origins are allowed."));
    return false;
  }

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-MoneySiren-Local-Session");
  response.setHeader("Vary", "Origin");

  return true;
}

function hasValidLocalSessionToken(request: IncomingMessage, expectedToken: string | undefined): boolean {
  if (expectedToken === undefined || expectedToken.trim().length === 0) {
    return false;
  }

  return request.headers["x-moneysiren-local-session"] === expectedToken;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let body = "";

  for await (const chunk of request) {
    body += String(chunk);

    if (body.length > 64_000) {
      throw new Error("Local API request body is too large.");
    }
  }

  return body.trim().length === 0 ? {} : JSON.parse(body) as unknown;
}

function assertLocalHostRequest(request: IncomingMessage, response: ServerResponse): boolean {
  const host = request.headers.host;

  if (host === undefined || isLoopbackHost(hostnameFromHeader(host))) {
    return true;
  }

  sendJson(response, 403, localError("forbidden_host", "Only loopback host headers are allowed."));
  return false;
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? "/", `http://${request.headers.host ?? DEFAULT_HOST}`);
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(`${JSON.stringify(payload)}\n`);
}

function localError(code: string, message: string): {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  error: {
    code: string;
    message: string;
  };
} {
  return {
    generatedAt: new Date().toISOString(),
    localOnly: true,
    secretsReturned: false,
    error: {
      code,
      message,
    },
  };
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);

    return (parsed.protocol === "http:" || parsed.protocol === "https:") && isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

function hostnameFromHeader(host: string): string {
  if (host.startsWith("[")) {
    return host.slice(1, host.indexOf("]"));
  }

  return host.split(":")[0] ?? host;
}

async function listenWithPortFallback(server: Server, port: number, host: string): Promise<number> {
  if (port === 0) {
    await listen(server, port, host);
    return listenedPort(server, port);
  }

  const maxAttempts = 20;
  let nextPort = port;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await listen(server, nextPort, host);
      return listenedPort(server, nextPort);
    } catch (error) {
      if (!isAddressInUseError(error)) {
        throw error;
      }

      nextPort += 1;
    }
  }

  throw new Error(`No available MoneySiren local API port near ${port}.`);
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function listenedPort(server: Server, fallbackPort: number): number {
  const address = server.address();

  return typeof address === "object" && address !== null ? address.port : fallbackPort;
}

function isAddressInUseError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EADDRINUSE";
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
