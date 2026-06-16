import {
  createDefaultCredentialStore,
  type CredentialConnectionState,
  type CredentialStatus,
  type CredentialStore,
} from "../../../packages/credentials/src/index";
import { loadMoneySirenConfig } from "../../../packages/config/src/index";
import {
  CONNECTABLE_PROVIDER_KEYS,
  findAvailableProvider,
  type ProviderKey,
} from "./provider-catalog";
import {
  readLocalAiCliStatus,
  type LocalAiCliProviderStatus,
  type LocalAiCliStatusPayload,
} from "./local-tools";

export type ConnectionState =
  | "not_configured"
  | "env_configured"
  | "credential_store_configured"
  | "oauth_connected"
  | "locked"
  | "expired"
  | "invalid"
  | "read_only_ready";
export type EmergencyAccessState = "emergency_not_configured" | "emergency_planned";
export type CredentialSource = "env" | "credential_store" | "oauth" | "locked" | "none";

export interface ProviderConnectionStatus {
  providerKey: ProviderKey;
  displayName: string;
  authMethod: string;
  connectionState: ConnectionState;
  credentialSource: CredentialSource;
  readOnlyTestState: ConnectionState;
  emergencyAccessState: EmergencyAccessState;
  connections: readonly ProviderCredentialConnectionStatus[];
  requiredEnvKeys: readonly string[];
  configuredEnvKeys: readonly string[];
  missingEnvKeys: readonly string[];
  credentialRequirements: readonly string[];
  credentialStore: {
    backend: CredentialStatus["backend"];
    storeState: CredentialStatus["storeState"];
    readOnlyState: CredentialConnectionState;
    emergencyState: CredentialConnectionState;
  };
}

export interface ProviderCredentialConnectionStatus {
  connectionId: string;
  label: string;
  active: boolean;
  connectionState: ConnectionState;
  credentialSource: CredentialSource;
  readOnlyTestState: ConnectionState;
  authMethod?: CredentialStatus["authMethod"];
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  validatedAt?: string;
  credentialStore: {
    backend: CredentialStatus["backend"];
    storeState: CredentialStatus["storeState"];
    readOnlyState: CredentialConnectionState;
  };
}

export interface ConnectionsStatusPayload {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  providerWriteActionsEnabled: false;
  providers: readonly ProviderConnectionStatus[];
}

export interface ReadConnectionsStatusOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  credentialStore?: CredentialStore;
  localAiCliStatus?: LocalAiCliStatusPayload;
}

export async function readConnectionsStatus(
  options: ReadConnectionsStatusOptions = {},
): Promise<ConnectionsStatusPayload> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const credentialStore = options.credentialStore ?? createDefaultCredentialStore({ env, now });
  const config = loadMoneySirenConfig(env);
  const localAiCliStatus = options.localAiCliStatus ?? await readLocalAiCliStatus({
    env,
    now,
  });
  const providers = await Promise.all(
    CONNECTABLE_PROVIDER_KEYS.map(async (providerKey) => {
      const readOnlyStatus = await credentialStore.getCredentialStatus(providerKey, "read-only");
      const readOnlyStatuses = await credentialStore.listCredentialStatuses(providerKey, "read-only");
      const emergencyStatus = await credentialStore.getCredentialStatus(providerKey, "emergency");
      const providerConfig = config.providers[providerKey];
      const localCliProvider = localAiCliStatus.providers.find((item) => item.providerKey === providerKey);
      const envConfigured = isProviderEnvConfigured(providerKey, env, providerConfig.configured, localCliProvider);
      const connections = readOnlyStatuses
        .filter((status) => status.connectionId !== undefined && status.label !== undefined)
        .map((status) => credentialConnectionStatusFor(status));
      const connectionState = summarizeProviderConnectionState(envConfigured, readOnlyStatus, connections);
      const catalog = findAvailableProvider(providerKey);
      const readOnlyTestState = summarizeProviderReadOnlyTestState(connectionState, readOnlyStatus, connections);

      return {
        providerKey,
        displayName: catalog?.name ?? providerKey,
        authMethod: catalog?.authMethods.join(" / ") ?? "Unknown",
        connectionState,
        credentialSource: credentialSourceFor(connectionState),
        readOnlyTestState: localCliProvider !== undefined && envConfigured ? "read_only_ready" : readOnlyTestState,
        emergencyAccessState: "emergency_planned",
        connections,
        requiredEnvKeys: providerConfig.requiredEnvKeys,
        configuredEnvKeys: configuredEnvKeysForProvider(providerKey, env, providerConfig.configuredEnvKeys, localCliProvider),
        missingEnvKeys: missingEnvKeysForProvider(providerConfig.missingEnvKeys, localCliProvider, envConfigured),
        credentialRequirements: catalog?.credentialRequirements ?? [],
        credentialStore: {
          backend: readOnlyStatus.backend,
          storeState: readOnlyStatus.storeState,
          readOnlyState: readOnlyStatus.state,
          emergencyState: emergencyStatus.state,
        },
      } satisfies ProviderConnectionStatus;
    }),
  );

  return {
    generatedAt: now().toISOString(),
    localOnly: true,
    secretsReturned: false,
    providerWriteActionsEnabled: false,
    providers,
  };
}

function credentialConnectionStatusFor(status: CredentialStatus): ProviderCredentialConnectionStatus {
  const connectionState = summarizeConnectionState(false, status);
  const readOnlyTestState = summarizeReadOnlyTestState(connectionState, status);

  return {
    connectionId: status.connectionId ?? "unknown",
    label: status.label ?? "Default",
    active: status.active ?? true,
    connectionState,
    credentialSource: credentialSourceFor(connectionState),
    readOnlyTestState,
    ...(status.authMethod === undefined ? {} : { authMethod: status.authMethod }),
    ...(status.createdAt === undefined ? {} : { createdAt: status.createdAt }),
    ...(status.updatedAt === undefined ? {} : { updatedAt: status.updatedAt }),
    ...(status.expiresAt === undefined ? {} : { expiresAt: status.expiresAt }),
    ...(status.validatedAt === undefined ? {} : { validatedAt: status.validatedAt }),
    credentialStore: {
      backend: status.backend,
      storeState: status.storeState,
      readOnlyState: status.state,
    },
  };
}

function summarizeProviderConnectionState(
  envConfigured: boolean,
  readOnlyStatus: CredentialStatus,
  connections: readonly ProviderCredentialConnectionStatus[],
): ConnectionState {
  if (envConfigured) {
    return "env_configured";
  }

  if (connections.some((connection) => connection.connectionState === "credential_store_configured")) {
    return "credential_store_configured";
  }

  if (connections.some((connection) => connection.connectionState === "oauth_connected")) {
    return "oauth_connected";
  }

  return summarizeConnectionState(false, readOnlyStatus);
}

function summarizeProviderReadOnlyTestState(
  connectionState: ConnectionState,
  readOnlyStatus: CredentialStatus,
  connections: readonly ProviderCredentialConnectionStatus[],
): ConnectionState {
  if (connections.some((connection) => connection.readOnlyTestState === "read_only_ready")) {
    return "read_only_ready";
  }

  return summarizeReadOnlyTestState(connectionState, readOnlyStatus);
}

export function summarizeConnectionState(
  envConfigured: boolean,
  credentialStatus: CredentialStatus,
): ConnectionState {
  if (envConfigured) {
    return "env_configured";
  }

  if (credentialStatus.state === "credential_store_configured") {
    return "credential_store_configured";
  }

  if (credentialStatus.state === "oauth_connected") {
    return "oauth_connected";
  }

  if (credentialStatus.state === "locked") {
    return "locked";
  }

  if (credentialStatus.state === "expired") {
    return "expired";
  }

  if (credentialStatus.state === "invalid") {
    return "invalid";
  }

  return "not_configured";
}

function summarizeReadOnlyTestState(
  connectionState: ConnectionState,
  credentialStatus: CredentialStatus,
): ConnectionState {
  if (credentialStatus.validatedAt !== undefined) {
    return "read_only_ready";
  }

  return connectionState;
}

function credentialSourceFor(connectionState: ConnectionState): CredentialSource {
  if (connectionState === "env_configured") {
    return "env";
  }

  if (connectionState === "credential_store_configured") {
    return "credential_store";
  }

  if (connectionState === "oauth_connected") {
    return "oauth";
  }

  if (connectionState === "locked") {
    return "locked";
  }

  return "none";
}

function isProviderEnvConfigured(
  providerKey: ProviderKey,
  env: Record<string, string | undefined>,
  configConfigured: boolean,
  localCliProvider?: LocalAiCliProviderStatus,
): boolean {
  if (localCliProvider !== undefined) {
    return localCliProvider.cli.state === "installed" ||
      localCliProvider.usage.logFileCount > 0 ||
      configConfigured;
  }

  if (providerKey !== "aws") {
    return configConfigured;
  }

  return isConfigured(env.AWS_PROFILE) ||
    (isConfigured(env.AWS_ACCESS_KEY_ID) && isConfigured(env.AWS_SECRET_ACCESS_KEY)) ||
    configConfigured;
}

function configuredEnvKeysForProvider(
  providerKey: ProviderKey,
  env: Record<string, string | undefined>,
  configuredEnvKeys: readonly string[],
  localCliProvider?: LocalAiCliProviderStatus,
): readonly string[] {
  if (localCliProvider !== undefined) {
    const keys = new Set(configuredEnvKeys);

    if (localCliProvider.cli.state === "installed") {
      keys.add(`${localCliProvider.command} command`);
    }

    if (localCliProvider.usage.logFileCount > 0) {
      keys.add(localCliProvider.usage.source);
    }

    return [...keys].sort();
  }

  if (providerKey !== "aws") {
    return configuredEnvKeys;
  }

  const keys = new Set(configuredEnvKeys);

  if (isConfigured(env.AWS_ACCESS_KEY_ID) && isConfigured(env.AWS_SECRET_ACCESS_KEY)) {
    keys.add("AWS_ACCESS_KEY_ID");
    keys.add("AWS_SECRET_ACCESS_KEY");
  }

  return [...keys].sort();
}

function missingEnvKeysForProvider(
  missingEnvKeys: readonly string[],
  localCliProvider: LocalAiCliProviderStatus | undefined,
  envConfigured: boolean,
): readonly string[] {
  if (localCliProvider !== undefined && envConfigured) {
    return [];
  }

  return missingEnvKeys;
}

function isConfigured(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}
