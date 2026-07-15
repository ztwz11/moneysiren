import { isAbsolute, join } from "node:path";
import {
  collectProviderSnapshots,
  type CollectedProviderSnapshots,
} from "../../../packages/core/src/index";
import {
  createOpenAiUsageCostsClient,
  createOpenAiUsageCostsConnector,
} from "../../../packages/connectors/openai/src/index";
import { loadMoneySirenConfig } from "../../../packages/config/src/index";
import {
  saveLocalProviderCollection,
  type LocalProviderCollectionInput,
} from "../../../packages/db/src/index";
import { setProviderEnvGlobally } from "./local-tools";

const OPENAI_ADMIN_KEY = "OPENAI_ADMIN_KEY";
const MAX_ADMIN_KEY_LENGTH = 4_096;
const DEFAULT_COLLECTION_TIMEOUT_MS = 30_000;

export type OpenAiFirstSyncCode =
  | "openai_first_sync_complete"
  | "openai_first_sync_invalid_request"
  | "openai_first_sync_validation_failed"
  | "openai_first_sync_credential_save_failed"
  | "openai_first_sync_canonical_save_failed";

export interface OpenAiFirstSyncCounts {
  usage: number;
  billing: number;
  health: number;
  estimates: number;
  alerts: number;
}

export interface OpenAiFirstSyncResult {
  generatedAt: string;
  providerKey: "openai";
  status: "ok" | "error" | "partial";
  stage: "complete" | "validation" | "environment" | "canonical";
  code: OpenAiFirstSyncCode;
  credentialSaved: boolean;
  canonicalSynced: boolean;
  counts: OpenAiFirstSyncCounts;
  localOnly: true;
  secretsReturned: false;
}

export interface OpenAiFirstSyncDependencies {
  cwd?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  collect?: (
    adminKey: string,
    now: () => Date,
    signal: AbortSignal,
  ) => Promise<CollectedProviderSnapshots>;
  collectionTimeoutMs?: number;
  saveEnvironment?: (entries: Readonly<Record<string, string>>) => Promise<unknown>;
  saveCanonical?: (input: LocalProviderCollectionInput) => Promise<void>;
}

export async function runOpenAiFirstSync(
  input: { adminKey?: string },
  dependencies: OpenAiFirstSyncDependencies = {},
): Promise<OpenAiFirstSyncResult> {
  const now = (dependencies.now ?? (() => new Date()))();
  const generatedAt = now.toISOString();
  const env = dependencies.env ?? process.env;
  const credentialAlreadySaved = input.adminKey === undefined;
  const adminKey = normalizeAdminKey(input.adminKey ?? env[OPENAI_ADMIN_KEY] ?? "");

  if (adminKey === null) {
    return safeResult(generatedAt, {
      status: "error",
      stage: "validation",
      code: "openai_first_sync_invalid_request",
    });
  }

  let collection: CollectedProviderSnapshots;

  try {
    collection = await collectWithTimeout(
      dependencies.collect ?? collectOpenAi,
      adminKey,
      () => now,
      dependencies.collectionTimeoutMs ?? DEFAULT_COLLECTION_TIMEOUT_MS,
    );
  } catch {
    return safeResult(generatedAt, {
      status: "error",
      stage: "validation",
      code: "openai_first_sync_validation_failed",
    });
  }

  if (collection.provider !== "openai" || collection.status !== "ok") {
    return safeResult(generatedAt, {
      status: "error",
      stage: "validation",
      code: "openai_first_sync_validation_failed",
    });
  }

  const counts = countsFor(collection);

  if (!credentialAlreadySaved) {
    try {
      const saveEnvironment = dependencies.saveEnvironment ?? ((entries: Readonly<Record<string, string>>) => (
        setProviderEnvGlobally(entries, { env, now: () => now })
      ));
      await saveEnvironment({
        [OPENAI_ADMIN_KEY]: adminKey,
      });
    } catch {
      return safeResult(generatedAt, {
        status: "error",
        stage: "environment",
        code: "openai_first_sync_credential_save_failed",
        counts,
      });
    }
  }

  const cwd = dependencies.cwd ?? process.cwd();

  try {
    const configuredDbPath = loadMoneySirenConfig(env).dbPath;
    const dbPath = isAbsolute(configuredDbPath) ? configuredDbPath : join(cwd, configuredDbPath);

    await (dependencies.saveCanonical ?? saveLocalProviderCollection)({
      dbPath,
      provider: {
        key: "openai",
        displayName: "OpenAI Usage/Costs",
        connectorVersion: "0.1.0",
      },
      collectedAt: collection.collectedAt,
      status: collection.status,
      snapshots: collection.snapshots,
      alerts: collection.alerts,
    });
  } catch {
    return safeResult(generatedAt, {
      status: "partial",
      stage: "canonical",
      code: "openai_first_sync_canonical_save_failed",
      credentialSaved: true,
      counts,
    });
  }

  return safeResult(generatedAt, {
    status: "ok",
    stage: "complete",
    code: "openai_first_sync_complete",
    credentialSaved: true,
    canonicalSynced: true,
    counts,
  });
}

async function collectOpenAi(
  adminKey: string,
  now: () => Date,
  signal: AbortSignal,
): Promise<CollectedProviderSnapshots> {
  const connector = createOpenAiUsageCostsConnector({
    client: createOpenAiUsageCostsClient({ adminKey, signal }),
  });

  return collectProviderSnapshots(connector, { now });
}

async function collectWithTimeout(
  collect: NonNullable<OpenAiFirstSyncDependencies["collect"]>,
  adminKey: string,
  now: () => Date,
  timeoutMs: number,
): Promise<CollectedProviderSnapshots> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const boundedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(timeoutMs, DEFAULT_COLLECTION_TIMEOUT_MS)
    : DEFAULT_COLLECTION_TIMEOUT_MS;

  try {
    return await Promise.race([
      collect(adminKey, now, controller.signal),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("OpenAI read-only validation timed out."));
        }, boundedTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function normalizeAdminKey(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length >= 8 && trimmed.length <= MAX_ADMIN_KEY_LENGTH
    ? trimmed
    : null;
}

function countsFor(collection: CollectedProviderSnapshots): OpenAiFirstSyncCounts {
  return {
    usage: collection.snapshots.usage.length,
    billing: collection.snapshots.billing.length,
    health: collection.snapshots.serviceHealth.length,
    estimates: collection.snapshots.costEstimates.length,
    alerts: collection.alerts.length,
  };
}

function safeResult(
  generatedAt: string,
  input: {
    status: OpenAiFirstSyncResult["status"];
    stage: OpenAiFirstSyncResult["stage"];
    code: OpenAiFirstSyncCode;
    credentialSaved?: boolean;
    canonicalSynced?: boolean;
    counts?: OpenAiFirstSyncCounts;
  },
): OpenAiFirstSyncResult {
  return {
    generatedAt,
    providerKey: "openai",
    status: input.status,
    stage: input.stage,
    code: input.code,
    credentialSaved: input.credentialSaved ?? false,
    canonicalSynced: input.canonicalSynced ?? false,
    counts: input.counts ?? {
      usage: 0,
      billing: 0,
      health: 0,
      estimates: 0,
      alerts: 0,
    },
    localOnly: true,
    secretsReturned: false,
  };
}
