"use client";

import type { OpenAiFirstSyncResult } from "./openai-first-sync";

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

export async function connectAndSyncOpenAi(adminKey?: string): Promise<OpenAiFirstSyncResult> {
  const session = await createLocalDashboardSession();
  const response = await fetch("/api/local/openai-first-sync", {
    body: JSON.stringify(adminKey === undefined ? {} : { adminKey }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-MoneySiren-CSRF": session.csrfToken,
    },
    method: "POST",
  });
  const payload = await readJson(response);

  if (!isOpenAiFirstSyncResult(payload)) {
    throw new Error(`OpenAI first sync failed with status ${response.status}.`);
  }

  return payload;
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

export async function startLocalDesktopHud(path: string): Promise<boolean> {
  const session = await createLocalDashboardSession();
  const response = await fetch("/api/local/desktop-runtime", {
    body: JSON.stringify({ path }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-MoneySiren-CSRF": session.csrfToken,
    },
    method: "POST",
  });

  return response.ok;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isOpenAiFirstSyncResult(value: unknown): value is OpenAiFirstSyncResult {
  if (!isRecord(value) || value.providerKey !== "openai") {
    return false;
  }

  return (value.status === "ok" || value.status === "error" || value.status === "partial") &&
    (value.stage === "complete" || value.stage === "validation" || value.stage === "environment" || value.stage === "canonical") &&
    typeof value.code === "string" &&
    typeof value.generatedAt === "string" &&
    typeof value.credentialSaved === "boolean" &&
    typeof value.canonicalSynced === "boolean" &&
    value.localOnly === true &&
    value.secretsReturned === false &&
    isRecord(value.counts) &&
    typeof value.counts.usage === "number" &&
    typeof value.counts.billing === "number" &&
    typeof value.counts.health === "number" &&
    typeof value.counts.estimates === "number" &&
    typeof value.counts.alerts === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
