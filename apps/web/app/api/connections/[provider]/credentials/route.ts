import {
  createDefaultCredentialStore,
  deleteCredential,
  setCredential,
  testCredentialStore,
  type CredentialAuthMethod,
  type CredentialStore,
} from "../../../../../../../packages/credentials/src/index";
import { readConnectionsStatus } from "../../../../../lib/connection-status";
import {
  CREDENTIAL_WRITES_DISABLED_MESSAGE,
  credentialWritesEnabled,
} from "../../../../../lib/credential-write-policy";
import { validateReadOnlyCredential } from "../../../../../lib/credential-validation";
import { requireLocalSession } from "../../../../../lib/local-security";
import type { LocalAiCliStatusPayload } from "../../../../../lib/local-tools";
import {
  findAvailableProvider,
  isConnectableProviderKey,
  isLiveProviderKey,
  isProviderKey,
  type ProviderKey,
} from "../../../../../lib/provider-catalog";

interface RouteContext {
  params: Promise<{
    provider: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    requireLocalSession(request);
    const provider = await readProvider(context.params);

    if (!credentialWritesEnabled()) {
      throw new Error(CREDENTIAL_WRITES_DISABLED_MESSAGE);
    }

    const input = await readCredentialInput(request, provider);
    const credentialStore = createDefaultCredentialStore();
    await assertCredentialStoreWritable(credentialStore);
    const validation = isLiveProviderKey(provider)
      ? await validateReadOnlyCredential(provider, {
          secret: input.secret,
          ...(input.metadata?.accountIds === undefined ? {} : { accountIds: input.metadata.accountIds }),
        })
      : undefined;

    const credential = await setCredential(provider, "read-only", {
      ...input,
      metadata: {
        ...(input.metadata ?? {}),
        ...(validation === undefined ? {} : { validatedAt: validation.validatedAt }),
      },
    }, {
      store: credentialStore,
    });

    return providerStatusResponse(provider, credentialStore, credential.connectionId);
  } catch (error) {
    return errorResponse(error);
  }
}

async function assertCredentialStoreWritable(credentialStore: CredentialStore): Promise<void> {
  const health = await testCredentialStore({
    store: credentialStore,
  });

  if (!health.writable) {
    const reason = health.reason ?? "Credential store is not writable.";
    const hint = health.backend === "encrypted_vault"
      ? "Set MONEYSIREN_CREDENTIAL_VAULT_PASSPHRASE before starting the local web server, or configure the OS keychain backend."
      : "Check the local credential store backend configuration.";

    throw new Error(`${reason} ${hint}`);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    requireLocalSession(request);
    const provider = await readProvider(context.params);
    const connectionId = readConnectionId(request);
    const credentialStore = createDefaultCredentialStore();

    await deleteCredential(provider, "read-only", { connectionId, store: credentialStore });

    return providerStatusResponse(provider, credentialStore);
  } catch (error) {
    return errorResponse(error);
  }
}

async function readProvider(params: RouteContext["params"]): Promise<ProviderKey> {
  const { provider } = await params;

  if (!isProviderKey(provider)) {
    throw new Error("Unsupported provider.");
  }

  if (!isConnectableProviderKey(provider)) {
    throw new Error("Provider is not connectable in MoneySiren v0.1.");
  }

  return provider;
}

async function readCredentialInput(
  request: Request,
  provider: ProviderKey,
): Promise<{
  secret: string;
  authMethod: CredentialAuthMethod;
  label: string;
  metadata?: Record<string, string>;
}> {
  if (provider === "aws") {
    throw new Error("AWS raw access keys are not stored by MoneySiren. Use AWS_PROFILE or SDK SSO setup.");
  }

  const body = await request.json() as Record<string, unknown>;
  const secret = readRequiredString(body.secret, "Credential secret");
  const label = readOptionalString(body.label, "Connection label") ?? defaultConnectionLabel(provider);

  if (provider === "openai") {
    return {
      secret,
      label,
      authMethod: "api_key",
    };
  }

  if (provider === "supabase") {
    return {
      secret,
      label,
      authMethod: "pat",
    };
  }

  if (provider === "cloudflare") {
    const accountIds = readRequiredString(body.accountIds, "Cloudflare account IDs");

    return {
      secret,
      label,
      authMethod: "api_token",
      metadata: {
        accountIds,
      },
    };
  }

  if (provider === "github-actions") {
    return {
      secret,
      label,
      authMethod: "pat",
    };
  }

  return {
    secret,
    label,
    authMethod: apiKeyProviders.has(provider) ? "api_key" : "api_token",
  };
}

const apiKeyProviders = new Set<ProviderKey>([
  "gcp",
  "azure",
  "oracle",
  "anthropic",
  "gemini",
  "neon",
  "mongodb-atlas",
  "datadog",
  "sentry",
]);

function readConnectionId(request: Request): string {
  const connectionId = new URL(request.url).searchParams.get("connectionId")?.trim();

  if (connectionId === undefined || connectionId.length === 0) {
    throw new Error("Connection id is required.");
  }

  return connectionId;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length < 8) {
    throw new Error(`${label} must be at least 8 characters.`);
  }

  return value.trim();
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 80) {
    throw new Error(`${label} must be 1-80 characters.`);
  }

  return value.trim();
}

function defaultConnectionLabel(provider: ProviderKey): string {
  return findAvailableProvider(provider)?.name ?? "Default";
}

async function providerStatusResponse(
  provider: ProviderKey,
  credentialStore: CredentialStore,
  connectionId?: string,
): Promise<Response> {
  const status = await readConnectionsStatus({
    credentialStore,
    localAiCliStatus: emptyLocalAiCliStatus(),
  });
  const providerStatus = status.providers.find((item) => item.providerKey === provider);

  return Response.json(
    {
      provider: providerStatus,
      ...(connectionId === undefined ? {} : { connectionId }),
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function emptyLocalAiCliStatus(): LocalAiCliStatusPayload {
  return {
    generatedAt: new Date().toISOString(),
    localOnly: true,
    secretsReturned: false,
    providers: [],
  };
}

function errorResponse(error: unknown): Response {
  return Response.json(
    {
      error: error instanceof Error ? error.message : "Credential operation failed.",
    },
    {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
