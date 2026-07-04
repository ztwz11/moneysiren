import { isAbsolute, join } from "node:path";
import { recordEmergencyActionRun } from "../../../../../../../packages/db/src/index";
import { assertNoSensitivePayloadLeaks } from "../../../../../../../packages/security/src/index";
import {
  buildEmergencyActionPlan,
  type EmergencyActionProvider,
} from "../../../../../lib/emergency-actions";
import { requireLocalSession } from "../../../../../lib/local-security";
import { findAvailableProvider, isProviderKey } from "../../../../../lib/provider-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};
const DRY_RUN_STATE_SOURCE = "client_supplied_preview";

class SafeDryRunRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireLocalSession(request);
  } catch {
    return Response.json({
      error: "Local session and CSRF token are required.",
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    }, {
      status: 403,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const body = await readBody(request);
    const provider = readProvider(body);
    const plan = buildEmergencyActionPlan(provider);
    const requestedActionKey = readOptionalString(recordAt(body, "actionKey"));
    const candidate = requestedActionKey === undefined
      ? plan.candidates[0] ?? null
      : plan.candidates.find((item) => item.actionKey === requestedActionKey) ?? null;

    if (requestedActionKey !== undefined && candidate === null) {
      return Response.json({
        error: "Emergency action candidate was not found.",
        localOnly: true,
        secretsReturned: false,
        providerWriteActionsEnabled: false,
      }, {
        status: 404,
        headers: NO_STORE_HEADERS,
      });
    }

    const payload = {
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
      source: DRY_RUN_STATE_SOURCE,
      mode: "dry_run",
      executeEnabled: false,
      providerKey: plan.providerKey,
      actionKey: candidate?.actionKey ?? requestedActionKey ?? null,
      readiness: candidate?.readiness ?? "not_supported",
      candidate,
      plan,
    } as const;
    assertNoSensitivePayloadLeaks(payload);
    await recordEmergencyDryRunAudit({
      actionKey: payload.actionKey ?? "none",
      providerKey: payload.providerKey,
      readiness: payload.readiness,
      requestedAt: plan.generatedAt,
      reasonCode: candidate?.reasonCodes[0] ?? "no_candidate",
      targetLabelRedacted: candidate?.providerDisplayName ?? plan.providerDisplayName,
    });

    return Response.json(payload, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const safeError = safeDryRunError(error);

    return Response.json({
      error: safeError.message,
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    }, {
      status: safeError.status,
      headers: NO_STORE_HEADERS,
    });
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();

  if (text.trim().length === 0) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new SafeDryRunRequestError("Emergency dry-run body must be valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new SafeDryRunRequestError("Emergency dry-run body must be a JSON object.");
  }

  return parsed;
}

function readProvider(body: Record<string, unknown>): EmergencyActionProvider {
  const nestedProvider = recordAt(body, "provider");
  const source = isRecord(nestedProvider) ? nestedProvider : body;
  const providerKey = readRequiredString(recordAt(source, "providerKey"), "providerKey");

  if (!isProviderKey(providerKey)) {
    throw new SafeDryRunRequestError("Unsupported provider.");
  }

  const catalog = findAvailableProvider(providerKey);

  return {
    providerKey,
    displayName: readOptionalString(recordAt(source, "displayName")) ?? catalog?.name ?? providerKey,
    connectionState: readOptionalString(recordAt(source, "connectionState")) ?? "not_configured",
    readOnlyTestState: readOptionalString(recordAt(source, "readOnlyTestState")) ??
      readOptionalString(recordAt(source, "connectionState")) ??
      "not_configured",
    emergencyAccessState: readOptionalString(recordAt(source, "emergencyAccessState")) ?? "emergency_planned",
    credentialStore: {
      emergencyState: readOptionalString(recordAt(source, "emergencyCredentialState")) ?? "not_configured",
    },
    setupLinks: catalog?.setupLinks ?? [],
    canonicalFreshness: readOptionalString(recordAt(source, "canonicalFreshness")) ?? "missing",
    liveFreshness: readOptionalString(recordAt(source, "liveFreshness")) ?? "stale",
    healthStatus: readOptionalString(recordAt(source, "healthStatus")) ?? "unknown",
    riskLevel: readOptionalString(recordAt(source, "riskLevel")) ?? "warning",
    missingEnvKeys: readStringArray(recordAt(source, "missingEnvKeys")),
    requiredEnvKeys: readStringArray(recordAt(source, "requiredEnvKeys")),
  };
}

async function recordEmergencyDryRunAudit(input: {
  providerKey: string;
  actionKey: string;
  readiness: string;
  requestedAt: string;
  reasonCode: string;
  targetLabelRedacted: string;
}): Promise<void> {
  await recordEmergencyActionRun({
    dbPath: resolveLocalDbPath(process.cwd(), process.env.MONEYSIREN_DB_PATH),
    providerKey: input.providerKey,
    actionKey: input.actionKey,
    mode: "dry_run",
    readiness: input.readiness,
    requestedAt: input.requestedAt,
    status: "dry_run",
    reasonCode: input.reasonCode,
    targetLabelRedacted: input.targetLabelRedacted,
    resultSummary: "Emergency dry-run readiness computed from client-supplied preview state without provider write calls.",
    localOnly: true,
    secretsReturned: false,
  });
}

function resolveLocalDbPath(cwd: string, configuredPath: string | undefined): string {
  const rawPath = configuredPath === undefined || configuredPath.trim().length === 0
    ? ".moneysiren/moneysiren.sqlite"
    : configuredPath.trim();

  return isAbsolute(rawPath) ? rawPath : join(cwd, rawPath);
}

function recordAt(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function readRequiredString(value: unknown, label: string): string {
  const parsed = readOptionalString(value);

  if (parsed === undefined) {
    throw new SafeDryRunRequestError(`${label} is required.`);
  }

  return parsed;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed.slice(0, 200);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.slice(0, 120));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeDryRunError(error: unknown): { message: string; status: number } {
  if (error instanceof SafeDryRunRequestError) {
    return {
      message: error.message,
      status: error.status,
    };
  }

  return {
    message: "Emergency dry-run failed.",
    status: 400,
  };
}
