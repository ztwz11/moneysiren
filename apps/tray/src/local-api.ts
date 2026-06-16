export const LOCAL_API_ENDPOINTS = {
  health: "/api/local/health",
  trayMenu: "/api/local/tray-menu",
  notificationDigest: "/api/local/notification-digest",
} as const;

export type LocalApiEndpointName = keyof typeof LOCAL_API_ENDPOINTS;
export type LocalApiEndpointPath = typeof LOCAL_API_ENDPOINTS[LocalApiEndpointName];

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface LocalSafeEnvelope {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
}

export interface LocalApiHealth extends LocalSafeEnvelope {
  status: "ok" | "degraded" | "down" | string;
  loopbackOnly?: boolean;
  runtime?: unknown;
}

export type TrayMenuStatus = "ok" | "attention" | "critical" | "warning" | "stale" | string;

export interface LocalTrayMenuItem {
  id: string;
  label: string;
  enabled?: boolean;
  kind?: string;
  action?: string;
  urlPath?: string;
  durationMinutes?: number;
}

export interface LocalTrayMenuModel extends LocalSafeEnvelope {
  title?: string;
  subtitle?: string;
  tooltip?: string;
  status: TrayMenuStatus;
  items: readonly LocalTrayMenuItem[];
}

export type NotificationSeverity = "info" | "low" | "medium" | "high" | "critical" | "warning";

export interface LocalNotificationDigestItem {
  key?: string;
  widgetKey?: string;
  kind?: string;
  label: string;
  value: string;
  severity?: NotificationSeverity;
  freshness?: string;
  confidence?: string;
  clickPath?: string;
}

export interface LocalNotificationDigest extends LocalSafeEnvelope {
  title: string;
  body?: string;
  status?: "ok" | "attention" | "critical";
  severity?: NotificationSeverity;
  clickUrl?: string;
  suppressedReason?: string | null;
  fingerprint?: string;
  items: readonly LocalNotificationDigestItem[];
}

export interface LocalApiClientOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
}

export interface LocalApiClient {
  getHealth: () => Promise<LocalApiHealth>;
  getTrayMenu: () => Promise<LocalTrayMenuModel>;
  getNotificationDigest: () => Promise<LocalNotificationDigest>;
}

export function createLocalApiClient(options: LocalApiClientOptions): LocalApiClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for the MoneySiren tray local API client.");
  }

  return {
    getHealth: () => getLocalJson<LocalApiHealth>(options.baseUrl, LOCAL_API_ENDPOINTS.health, fetchImpl),
    getTrayMenu: () => getLocalJson<LocalTrayMenuModel>(options.baseUrl, LOCAL_API_ENDPOINTS.trayMenu, fetchImpl),
    getNotificationDigest: () =>
      getLocalJson<LocalNotificationDigest>(options.baseUrl, LOCAL_API_ENDPOINTS.notificationDigest, fetchImpl),
  };
}

export async function getLocalJson<T extends LocalSafeEnvelope>(
  baseUrl: string,
  endpoint: LocalApiEndpointPath,
  fetchImpl: FetchLike,
): Promise<T> {
  const url = buildLocalApiUrl(baseUrl, endpoint);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`MoneySiren local API request failed: GET ${endpoint} returned ${response.status}.`);
  }

  const payload = await response.json() as unknown;

  assertLocalSafeEnvelope(payload, endpoint);

  return payload as T;
}

export function buildLocalApiUrl(baseUrl: string, endpoint: LocalApiEndpointPath): URL {
  assertAllowedEndpoint(endpoint);

  const parsed = new URL(baseUrl);

  assertLoopbackUrl(parsed);
  parsed.pathname = endpoint;
  parsed.search = "";
  parsed.hash = "";

  return parsed;
}

export function assertAllowedEndpoint(endpoint: string): asserts endpoint is LocalApiEndpointPath {
  const allowedEndpoints = Object.values(LOCAL_API_ENDPOINTS) as readonly string[];

  if (!allowedEndpoints.includes(endpoint)) {
    throw new Error(`Endpoint is not allowed for the MoneySiren tray client: ${endpoint}`);
  }
}

export function assertLoopbackUrl(url: URL): void {
  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error("MoneySiren tray local API URLs must not contain credentials.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MoneySiren tray local API URLs must use http or https.");
  }

  if (!isLoopbackHost(url.hostname)) {
    throw new Error(`MoneySiren tray can only call loopback local API hosts, received: ${url.hostname}`);
  }
}

export function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function assertLocalSafeEnvelope(value: unknown, endpoint: LocalApiEndpointPath): asserts value is LocalSafeEnvelope {
  if (typeof value !== "object" || value === null) {
    throw new Error(`MoneySiren local API ${endpoint} returned a non-object payload.`);
  }

  const envelope = value as Partial<LocalSafeEnvelope>;

  if (envelope.localOnly !== true || envelope.secretsReturned !== false) {
    throw new Error(`MoneySiren local API ${endpoint} did not return a local-safe envelope.`);
  }
}
