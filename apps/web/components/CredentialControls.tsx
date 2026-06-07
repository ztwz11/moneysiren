"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ProviderKey } from "../lib/provider-catalog";

interface CredentialControlLabels {
  credentialSecret: string;
  accountIds: string;
  saveCredential: string;
  removeCredential: string;
  startOAuth: string;
  awsManaged: string;
}

export function CredentialControls({
  providerKey,
  labels,
}: {
  providerKey: ProviderKey;
  labels: CredentialControlLabels;
}) {
  const [secret, setSecret] = useState("");
  const [accountIds, setAccountIds] = useState("");
  const [isPending, startTransition] = useTransition();

  if (providerKey === "aws") {
    return <span className="muted">{labels.awsManaged}</span>;
  }

  return (
    <form
      className="credential-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        startTransition(async () => {
          const sessionResponse = await fetch("/api/auth/session", {
            method: "POST",
          });

          if (!sessionResponse.ok) {
            return;
          }

          const session = await sessionResponse.json() as { csrfToken?: string };
          const response = await fetch(`/api/connections/${providerKey}/credentials`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-stackspend-csrf": session.csrfToken ?? "",
            },
            body: JSON.stringify({
              secret,
              ...(providerKey === "cloudflare" ? { accountIds } : {}),
            }),
          });

          if (response.ok) {
            window.location.reload();
          }
        });
      }}
    >
      <label className="credential-field">
        <span className="metric-label">{labels.credentialSecret}</span>
        <input
          autoComplete="off"
          className="credential-input"
          onChange={(event) => setSecret(event.target.value)}
          type="password"
          value={secret}
        />
      </label>
      {providerKey === "cloudflare" ? (
        <label className="credential-field">
          <span className="metric-label">{labels.accountIds}</span>
          <input
            autoComplete="off"
            className="credential-input"
            onChange={(event) => setAccountIds(event.target.value)}
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
              startTransition(async () => {
                const sessionResponse = await fetch("/api/auth/session", {
                  method: "POST",
                });

                if (!sessionResponse.ok) {
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
                }
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
        <button
          className="ghost-button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const sessionResponse = await fetch("/api/auth/session", {
                method: "POST",
              });

              if (!sessionResponse.ok) {
                return;
              }

              const session = await sessionResponse.json() as { csrfToken?: string };
              const response = await fetch(`/api/connections/${providerKey}/credentials`, {
                method: "DELETE",
                headers: {
                  "x-stackspend-csrf": session.csrfToken ?? "",
                },
              });

              if (response.ok) {
                window.location.reload();
              }
            });
          }}
          type="button"
        >
          {labels.removeCredential}
        </button>
      </div>
    </form>
  );
}
