import { describe, expect, it } from "vitest";
import {
  buildLocalApiUrl,
  createLocalApiClient,
  LOCAL_API_ENDPOINTS,
  type FetchLike,
  type LocalApiEndpointPath,
} from "./local-api.js";

describe("local API client", () => {
  it("requests only the approved local GET endpoints", async () => {
    const calls: Array<{ method: string; pathname: string; url: string }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";

      calls.push({
        method,
        pathname: url.pathname,
        url: url.href,
      });

      return new Response(JSON.stringify(responseForPath(url.pathname)), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    };
    const client = createLocalApiClient({
      baseUrl: "http://127.0.0.1:47831",
      fetchImpl,
    });

    await client.getHealth();
    await client.getTrayMenu();
    await client.getNotificationDigest();

    expect(calls).toEqual([
      {
        method: "GET",
        pathname: LOCAL_API_ENDPOINTS.health,
        url: "http://127.0.0.1:47831/api/local/health",
      },
      {
        method: "GET",
        pathname: LOCAL_API_ENDPOINTS.trayMenu,
        url: "http://127.0.0.1:47831/api/local/tray-menu",
      },
      {
        method: "GET",
        pathname: LOCAL_API_ENDPOINTS.notificationDigest,
        url: "http://127.0.0.1:47831/api/local/notification-digest",
      },
    ]);
  });

  it("rejects non-loopback hosts and unapproved paths", async () => {
    expect(() => buildLocalApiUrl("https://moneysiren.example", LOCAL_API_ENDPOINTS.health)).toThrow(/loopback/i);
    expect(() =>
      buildLocalApiUrl("http://127.0.0.1:47831", "/api/local/credentials" as LocalApiEndpointPath)
    ).toThrow(/not allowed/i);
  });

  it("requires local-safe envelopes", async () => {
    const client = createLocalApiClient({
      baseUrl: "http://localhost:47831",
      fetchImpl: async () => new Response(JSON.stringify({
        generatedAt: "2026-06-10T00:00:00.000Z",
        localOnly: true,
        secretsReturned: true,
        status: "ok",
      })),
    });

    await expect(client.getHealth()).rejects.toThrow(/local-safe envelope/i);
  });
});

function responseForPath(pathname: string): unknown {
  const envelope = {
    generatedAt: "2026-06-10T00:00:00.000Z",
    localOnly: true,
    secretsReturned: false,
  };

  if (pathname === LOCAL_API_ENDPOINTS.health) {
    return {
      ...envelope,
      status: "ok",
      loopbackOnly: true,
    };
  }

  if (pathname === LOCAL_API_ENDPOINTS.trayMenu) {
    return {
      ...envelope,
      title: "MoneySiren",
      tooltip: "MoneySiren local status",
      status: "ok",
      items: [],
    };
  }

  if (pathname === LOCAL_API_ENDPOINTS.notificationDigest) {
    return {
      ...envelope,
      title: "MoneySiren",
      body: "Today live USD 0.00",
      severity: "info",
      suppressedReason: null,
      items: [],
    };
  }

  throw new Error(`Unexpected path ${pathname}`);
}
