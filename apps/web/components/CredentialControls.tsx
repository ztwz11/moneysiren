"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ProviderKey } from "../lib/provider-catalog";

interface CredentialControlLabels {
  savedConnections: string;
  connectionLabel: string;
  connectionId: string;
  credentialSecret: string;
  accountIds: string;
  openAiAdminKeyHint: string;
  credentialSaveError: string;
  credentialDeleteError: string;
  saveCredential: string;
  removeCredential: string;
  startOAuth: string;
  awsManaged: string;
}

interface CredentialConnectionView {
  connectionId: string;
  label: string;
  readOnlyTestState: string;
  active: boolean;
  updatedAt?: string;
}

export function CredentialControls({
  providerKey,
  connections,
  labels,
}: {
  providerKey: ProviderKey;
  connections: readonly CredentialConnectionView[];
  labels: CredentialControlLabels;
}) {
  const [label, setLabel] = useState(defaultLabel(providerKey));
  const [secret, setSecret] = useState("");
  const [accountIds, setAccountIds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (providerKey === "aws") {
    return <span className="muted">{labels.awsManaged}</span>;
  }

  return (
    <div className="credential-panel">
      {connections.length === 0 ? null : (
        <div className="credential-list">
          <div className="metric-label">{labels.savedConnections}</div>
          {connections.map((connection) => (
            <div className="credential-list-item" key={connection.connectionId}>
              <div>
                <strong>{connection.label}</strong>
                <div className="metric-meta">{labels.connectionId}: {shortConnectionId(connection.connectionId)}</div>
                <div className="credential-status-line">
                  <span className="connection-dot" aria-hidden="true" />
                  <span>{connection.readOnlyTestState}</span>
                </div>
              </div>
              <button
                className="ghost-button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const session = await createSessionOrThrow(labels.credentialDeleteError);
                    const response = await fetch(
                      `/api/connections/${providerKey}/credentials?connectionId=${encodeURIComponent(connection.connectionId)}`,
                      {
                        method: "DELETE",
                        headers: {
                          "x-stackspend-csrf": session.csrfToken,
                        },
                      },
                    );

                    if (response.ok) {
                      window.location.reload();
                      return;
                    }

                    setError(await responseError(response, labels.credentialDeleteError));
                  });
                }}
                type="button"
              >
                {labels.removeCredential}
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        className="credential-form"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              const session = await createSessionOrThrow(labels.credentialSaveError);
              const response = await fetch(`/api/connections/${providerKey}/credentials`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "x-stackspend-csrf": session.csrfToken,
                },
                body: JSON.stringify({
                  label,
                  secret,
                  ...(providerKey === "cloudflare" ? { accountIds } : {}),
                }),
              });

              if (response.ok) {
                window.location.reload();
                return;
              }

              setError(await responseError(response, labels.credentialSaveError));
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : labels.credentialSaveError);
            }
          });
        }}
      >
        <div className="credential-form-grid">
          <label className="credential-field">
            <span className="metric-label">{labels.connectionLabel}</span>
            <input
              autoComplete="off"
              className="credential-input"
              maxLength={80}
              onChange={(event) => {
                setLabel(event.target.value);
                setError(null);
              }}
              placeholder={labels.connectionLabel}
              type="text"
              value={label}
            />
          </label>
          <label className="credential-field">
            <span className="metric-label">{labels.credentialSecret}</span>
            <input
              autoComplete="off"
              className="credential-input"
              onChange={(event) => {
                setSecret(event.target.value);
                setError(null);
              }}
              placeholder={labels.credentialSecret}
              type="password"
              value={secret}
            />
          </label>
        </div>
        {providerKey === "openai" ? (
          <p className="credential-hint">{labels.openAiAdminKeyHint}</p>
        ) : null}
        {providerKey === "cloudflare" ? (
          <label className="credential-field">
            <span className="metric-label">{labels.accountIds}</span>
            <input
              autoComplete="off"
              className="credential-input"
              onChange={(event) => {
                setAccountIds(event.target.value);
                setError(null);
              }}
              placeholder={labels.accountIds}
              type="password"
              value={accountIds}
            />
          </label>
        ) : null}
        <div className="credential-actions">
          {providerKey === "supabase" ? (
            <button
              className="ghost-button"
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const sessionResponse = await fetch("/api/auth/session", {
                    method: "POST",
                  });

                  if (!sessionResponse.ok) {
                    setError(await responseError(sessionResponse, labels.credentialSaveError));
                    return;
                  }

                  const session = await sessionResponse.json() as { csrfToken?: string };
                  const response = await fetch("/api/auth/start/supabase", {
                    method: "POST",
                    headers: {
                      "x-stackspend-csrf": session.csrfToken ?? "",
                    },
                  });
                  const payload = await response.json() as { authorizationUrl?: string | null };

                  if (response.ok && typeof payload.authorizationUrl === "string") {
                    window.location.href = payload.authorizationUrl;
                    return;
                  }

                  setError(await responseError(response, labels.credentialSaveError));
                });
              }}
              type="button"
            >
              {labels.startOAuth}
            </button>
          ) : null}
          <button className="primary-button" disabled={isPending || secret.trim().length === 0} type="submit">
            {labels.saveCredential}
          </button>
        </div>
        {error === null ? null : <p className="credential-error" role="alert">{error}</p>}
      </form>
    </div>
  );
}

async function createSessionOrThrow(fallback: string): Promise<{ csrfToken: string }> {
  const sessionResponse = await fetch("/api/auth/session", {
    method: "POST",
  });

  if (!sessionResponse.ok) {
    throw new Error(await responseError(sessionResponse, fallback));
  }

  const session = await sessionResponse.json() as { csrfToken?: string };
  const csrfToken = session.csrfToken ?? "";

  if (csrfToken.length === 0) {
    throw new Error(fallback);
  }

  return {
    csrfToken,
  };
}

function defaultLabel(providerKey: ProviderKey): string {
  return defaultProviderLabels[providerKey] ?? "Default";
}

const defaultProviderLabels: Record<ProviderKey, string> = {
  aws: "AWS",
  openai: "OpenAI",
  supabase: "Supabase",
  cloudflare: "Cloudflare",
  gcp: "GCP",
  azure: "Azure",
  oracle: "Oracle Cloud",
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini / Vertex AI",
  vercel: "Vercel",
  "github-actions": "GitHub Actions",
  railway: "Railway",
  fly: "Fly.io",
  netlify: "Netlify",
  render: "Render",
  neon: "Neon",
  "mongodb-atlas": "MongoDB Atlas",
  datadog: "Datadog",
  sentry: "Sentry",
};

function shortConnectionId(connectionId: string): string {
  return connectionId.length <= 10 ? connectionId : connectionId.slice(-8);
}

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };

    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return `${fallback} ${payload.error}`;
    }
  } catch {
    // Fall through to the generic message when the response is not JSON.
  }

  return fallback;
}
