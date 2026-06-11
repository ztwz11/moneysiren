import { setCredential } from "../../../../../../../packages/credentials/src/index";
import {
  CREDENTIAL_WRITES_DISABLED_MESSAGE,
  credentialWritesEnabled,
} from "../../../../../lib/credential-write-policy";
import { validateReadOnlyCredential } from "../../../../../lib/credential-validation";
import { consumeOAuthTransaction, isLocalRequest } from "../../../../../lib/local-security";

type OAuthProviderKey = "supabase";

interface RouteContext {
  params: Promise<{
    provider: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    if (!isLocalRequest(request)) {
      throw new Error("OAuth callback must use localhost.");
    }

    const provider = await readProvider(context.params);
    const url = new URL(request.url);
    const state = url.searchParams.get("state")?.trim();
    const code = url.searchParams.get("code")?.trim();

    if (state === undefined || state.length === 0 || code === undefined || code.length === 0) {
      throw new Error("OAuth callback is missing state or code.");
    }

    const transaction = consumeOAuthTransaction(provider, state);

    if (transaction === null) {
      throw new Error("OAuth transaction was not found or expired.");
    }

    if (!credentialWritesEnabled()) {
      return Response.json(
        {
          provider,
          status: "oauth_disabled",
          credentialStored: false,
          secretsReturned: false,
          error: CREDENTIAL_WRITES_DISABLED_MESSAGE,
        },
        {
          status: 409,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const stored = await maybeStoreOAuthCredential(code, transaction.codeVerifier);

    return Response.json(
      {
        provider,
        status: "oauth_callback_received",
        credentialStored: stored,
        secretsReturned: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "OAuth callback failed.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

async function maybeStoreOAuthCredential(
  code: string,
  codeVerifier: string,
): Promise<boolean> {
  const tokenUrl = process.env.SUPABASE_OAUTH_TOKEN_URL?.trim();
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET?.trim();

  if (
    tokenUrl === undefined ||
    tokenUrl.length === 0 ||
    clientId === undefined ||
    clientId.length === 0 ||
    clientSecret === undefined ||
    clientSecret.length === 0
  ) {
    return false;
  }

  const token = await exchangeSupabaseCode({
    tokenUrl,
    clientId,
    clientSecret,
    code,
    codeVerifier,
  });
  const validation = await validateReadOnlyCredential("supabase", {
    secret: token.accessToken,
  });

  await setCredential("supabase", "read-only", {
    secret: token.accessToken,
    authMethod: "oauth2",
    ...(token.expiresAt === undefined ? {} : { expiresAt: token.expiresAt }),
    metadata: {
      validatedAt: validation.validatedAt,
    },
  });

  return true;
}

async function exchangeSupabaseCode(options: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
}): Promise<{ accessToken: string; expiresAt?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: options.clientId,
    client_secret: options.clientSecret,
    code: options.code,
    code_verifier: options.codeVerifier,
  });
  const response = await fetch(options.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Supabase OAuth token exchange failed with status ${response.status}.`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";

  if (accessToken.length === 0) {
    throw new Error("Supabase OAuth token exchange did not return an access token.");
  }

  const expiresIn = typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
    ? payload.expires_in
    : undefined;

  return {
    accessToken,
    ...(expiresIn === undefined
      ? {}
      : { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() }),
  };
}

async function readProvider(params: RouteContext["params"]): Promise<OAuthProviderKey> {
  const { provider } = await params;

  if (provider !== "supabase") {
    throw new Error("Unsupported provider.");
  }

  return provider;
}
