"use client";

export type LocalRefreshScope = "hud" | "local_ai" | "all";

export interface LocalSessionPayload {
  csrfToken: string;
  expiresAt?: string;
}

export async function createLocalDashboardSession(): Promise<LocalSessionPayload> {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Local session failed with status ${response.status}.`);
  }

  return await response.json() as LocalSessionPayload;
}

export async function refreshLocalLive(scope: LocalRefreshScope): Promise<unknown> {
  const session = await createLocalDashboardSession();
  const response = await fetch("/api/local/refresh-live", {
    body: JSON.stringify({ scope }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-MoneySiren-CSRF": session.csrfToken,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Local refresh failed with status ${response.status}.`);
  }

  return await response.json();
}

export async function stopLocalWebRuntime(): Promise<unknown> {
  const session = await createLocalDashboardSession();
  const response = await fetch("/api/local/runtime/stop", {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "X-MoneySiren-CSRF": session.csrfToken,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Local runtime stop failed with status ${response.status}.`);
  }

  return await response.json();
}
