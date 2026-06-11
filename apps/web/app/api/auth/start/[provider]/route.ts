import { createOAuthTransaction, requireLocalSession } from "../../../../../lib/local-security";
import {
  CREDENTIAL_WRITES_DISABLED_MESSAGE,
  credentialWritesEnabled,
} from "../../../../../lib/credential-write-policy";

type OAuthProviderKey = "supabase";

interface RouteContext {
  params: Promise<{
    provider: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const provider = await readProvider(context.params);
    const session = requireLocalSession(request);

    if (!credentialWritesEnabled()) {
      return Response.json(
        {
          provider,
          oauthConfigured: false,
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

    const transaction = createOAuthTransaction({
      provider,
      request,
      session,
    });
    const authorizationUrl = buildAuthorizationUrl(transaction);

    return Response.json(
      {
        provider,
        state: transaction.state,
        authorizationUrl,
        callbackUrl: transaction.redirectUri,
        pkce: "server_held",
        nonce: "server_held",
        oauthConfigured: authorizationUrl !== null,
      },
      {
        status: authorizationUrl === null ? 409 : 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "OAuth start failed.",
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

async function readProvider(params: RouteContext["params"]): Promise<OAuthProviderKey> {
  const { provider } = await params;

  if (provider !== "supabase") {
    throw new Error("Unsupported provider.");
  }

  return provider;
}

function buildAuthorizationUrl(transaction: ReturnType<typeof createOAuthTransaction>): string | null {
  const authorizationEndpoint = process.env.SUPABASE_OAUTH_AUTHORIZATION_URL?.trim();
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID?.trim();

  if (authorizationEndpoint === undefined || authorizationEndpoint.length === 0 || clientId === undefined || clientId.length === 0) {
    return null;
  }

  const url = new URL(authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", transaction.redirectUri);
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("code_challenge", transaction.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", "read");

  return url.toString();
}
