import { describe, expect, it, beforeEach } from "vitest";
import {
  clearLocalSecurityState,
  consumeOAuthTransaction,
  createLocalSession,
  createOAuthTransaction,
  localSessionCookie,
  requireLocalSession,
} from "./local-security";

beforeEach(() => {
  clearLocalSecurityState();
});

describe("local dashboard security helpers", () => {
  it("requires localhost, an opaque session cookie, and a CSRF header", () => {
    const session = createLocalSession(new Date("2026-06-08T00:00:00.000Z"));
    const request = new Request("http://127.0.0.1:3000/api/connections/openai/credentials", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        cookie: localSessionCookie(session),
        "x-moneysiren-csrf": session.csrfToken,
      },
    });

    expect(requireLocalSession(request, new Date("2026-06-08T00:01:00.000Z"))).toMatchObject({
      sessionId: session.sessionId,
    });
    expect(localSessionCookie(session)).not.toContain(session.csrfToken);
  });

  it("validates a local session even when route-local memory was cleared", () => {
    const session = createLocalSession(new Date("2026-06-08T00:00:00.000Z"));
    const cookie = localSessionCookie(session);
    clearLocalSecurityState();
    const request = new Request("http://127.0.0.1:3000/api/local-tools/aws/profile", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        cookie,
        "x-moneysiren-csrf": session.csrfToken,
      },
    });

    expect(requireLocalSession(request, new Date("2026-06-08T00:01:00.000Z"))).toMatchObject({
      sessionId: session.sessionId,
    });
  });

  it("rejects a signed local session when the CSRF header does not match", () => {
    const session = createLocalSession(new Date("2026-06-08T00:00:00.000Z"));
    const request = new Request("http://127.0.0.1:3000/api/local-tools/aws/profile", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        cookie: localSessionCookie(session),
        "x-moneysiren-csrf": "wrong-csrf-token",
      },
    });

    expect(() => requireLocalSession(request, new Date("2026-06-08T00:01:00.000Z"))).toThrow("invalid");
  });

  it("rejects non-local origins", () => {
    const session = createLocalSession();
    const request = new Request("http://127.0.0.1:3000/api/connections/openai/credentials", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "https://example.com",
        cookie: localSessionCookie(session),
        "x-moneysiren-csrf": session.csrfToken,
      },
    });

    expect(() => requireLocalSession(request)).toThrow("localhost");
  });

  it("owns OAuth state, nonce, and PKCE verifier server-side", () => {
    const session = createLocalSession();
    const request = new Request("http://127.0.0.1:3000/api/auth/start/supabase", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
      },
    });
    const transaction = createOAuthTransaction({
      provider: "supabase",
      request,
      session,
      now: new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(transaction.redirectUri).toBe("http://127.0.0.1:3000/api/auth/callback/supabase");
    expect(transaction.codeChallenge).not.toBe(transaction.codeVerifier);
    expect(consumeOAuthTransaction("supabase", transaction.state, new Date("2026-06-08T00:01:00.000Z"))).toMatchObject({
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
    });
  });
});
