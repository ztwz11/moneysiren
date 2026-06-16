import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface LocalSession {
  sessionId: string;
  csrfToken: string;
  expiresAt: number;
}

export interface OAuthTransaction {
  provider: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  sessionId: string;
  expiresAt: number;
}

const SESSION_COOKIE = "moneysiren_session";
const SESSION_TTL_MS = 30 * 60 * 1000;
const OAUTH_TTL_MS = 10 * 60 * 1000;
const SESSION_COOKIE_VERSION = "v1";
const LOCAL_SESSION_SECRET_ENV = "MONEYSIREN_LOCAL_SESSION_SECRET";
const sessions = new Map<string, LocalSession>();
const oauthTransactions = new Map<string, OAuthTransaction>();

interface SignedLocalSessionPayload {
  sessionId: string;
  csrfHash: string;
  expiresAt: number;
}

export function createLocalSession(now: Date = new Date()): LocalSession {
  pruneExpired(now);
  const session: LocalSession = {
    sessionId: randomToken(32),
    csrfToken: randomToken(32),
    expiresAt: now.getTime() + SESSION_TTL_MS,
  };
  sessions.set(session.sessionId, session);

  return session;
}

export function localSessionCookie(session: LocalSession): string {
  const payload = encodeSignedSessionPayload({
    sessionId: session.sessionId,
    csrfHash: hashCsrfToken(session.csrfToken),
    expiresAt: session.expiresAt,
  });

  return [
    `${SESSION_COOKIE}=${payload}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=1800",
  ].join("; ");
}

export function requireLocalSession(request: Request, now: Date = new Date()): LocalSession {
  pruneExpired(now);

  if (!isLocalRequest(request)) {
    throw new Error("Request must originate from localhost.");
  }

  const sessionId = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  const csrfToken = request.headers.get("x-moneysiren-csrf")?.trim();

  if (sessionId === undefined || csrfToken === undefined || csrfToken.length === 0) {
    throw new Error("Local session and CSRF token are required.");
  }

  const signedSession = decodeSignedSessionPayload(sessionId, csrfToken, now);

  if (signedSession !== null) {
    return {
      sessionId: signedSession.sessionId,
      csrfToken,
      expiresAt: signedSession.expiresAt,
    };
  }

  const session = sessions.get(sessionId);

  if (session === undefined || session.expiresAt <= now.getTime() || session.csrfToken !== csrfToken) {
    throw new Error("Local session is invalid.");
  }

  return session;
}

export function isLocalRequest(request: Request): boolean {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  return isLocalHostHeader(host) &&
    (origin === null || isLocalUrl(origin)) &&
    (referer === null || isLocalUrl(referer));
}

export function createOAuthTransaction(options: {
  provider: string;
  request: Request;
  session: LocalSession;
  now?: Date;
}): OAuthTransaction {
  const now = options.now ?? new Date();
  const state = randomToken(32);
  const codeVerifier = randomToken(48);
  const transaction: OAuthTransaction = {
    provider: options.provider,
    state,
    nonce: randomToken(32),
    codeVerifier,
    codeChallenge: createPkceChallenge(codeVerifier),
    redirectUri: localCallbackUrl(options.request, options.provider),
    sessionId: options.session.sessionId,
    expiresAt: now.getTime() + OAUTH_TTL_MS,
  };
  oauthTransactions.set(state, transaction);

  return transaction;
}

export function consumeOAuthTransaction(
  provider: string,
  state: string,
  now: Date = new Date(),
): OAuthTransaction {
  pruneExpired(now);
  const transaction = oauthTransactions.get(state);

  if (transaction === undefined || transaction.provider !== provider || transaction.expiresAt <= now.getTime()) {
    throw new Error("OAuth transaction is invalid.");
  }

  oauthTransactions.delete(state);

  return transaction;
}

export function clearLocalSecurityState(): void {
  sessions.clear();
  oauthTransactions.clear();
}

function pruneExpired(now: Date): void {
  const nowMs = now.getTime();

  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= nowMs) {
      sessions.delete(sessionId);
    }
  }

  for (const [state, transaction] of oauthTransactions.entries()) {
    if (transaction.expiresAt <= nowMs) {
      oauthTransactions.delete(state);
    }
  }
}

function localCallbackUrl(request: Request, provider: string): string {
  const host = request.headers.get("host") ?? "127.0.0.1:3000";

  if (!isLocalHostHeader(host)) {
    throw new Error("OAuth callback host must be localhost.");
  }

  return `http://${host}/api/auth/callback/${provider}`;
}

function isLocalHostHeader(host: string | null): boolean {
  if (host === null || host.trim().length === 0) {
    return false;
  }

  const normalized = host.trim().toLowerCase();
  const hostname = normalized.startsWith("[")
    ? normalized.slice(1, normalized.indexOf("]"))
    : normalized.split(":")[0] ?? normalized;

  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function isLocalUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return isLocalHostHeader(url.host);
  } catch {
    return false;
  }
}

function parseCookies(header: string | null): Record<string, string> {
  if (header === null) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");

        return separator === -1
          ? [part, ""]
          : [part.slice(0, separator), part.slice(separator + 1)];
      }),
  );
}

function encodeSignedSessionPayload(payload: SignedLocalSessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signValue(encodedPayload);

  return `${SESSION_COOKIE_VERSION}.${encodedPayload}.${signature}`;
}

function decodeSignedSessionPayload(
  value: string,
  csrfToken: string,
  now: Date,
): SignedLocalSessionPayload | null {
  const [version, encodedPayload, signature] = value.split(".");

  if (version !== SESSION_COOKIE_VERSION || encodedPayload === undefined || signature === undefined) {
    return null;
  }

  if (!constantTimeEqual(signature, signValue(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SignedLocalSessionPayload>;

    if (
      typeof payload.sessionId !== "string" ||
      typeof payload.csrfHash !== "string" ||
      typeof payload.expiresAt !== "number" ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= now.getTime()
    ) {
      return null;
    }

    if (!constantTimeEqual(payload.csrfHash, hashCsrfToken(csrfToken))) {
      return null;
    }

    return {
      sessionId: payload.sessionId,
      csrfHash: payload.csrfHash,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

function hashCsrfToken(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function signValue(value: string): string {
  return createHmac("sha256", localSessionSecret()).update(value).digest("base64url");
}

function localSessionSecret(): string {
  const configured = process.env[LOCAL_SESSION_SECRET_ENV]?.trim();

  if (configured !== undefined && configured.length > 0) {
    return configured;
  }

  const generated = randomToken(32);
  process.env[LOCAL_SESSION_SECRET_ENV] = generated;

  return generated;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createPkceChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function randomToken(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}
