import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

export const CREDENTIAL_PROVIDERS = [
  "aws",
  "openai",
  "supabase",
  "cloudflare",
  "gcp",
  "azure",
  "oracle",
  "anthropic",
  "gemini",
  "vercel",
  "github-actions",
  "railway",
  "fly",
  "netlify",
  "render",
  "neon",
  "mongodb-atlas",
  "datadog",
  "sentry",
] as const;
export const CREDENTIAL_SCOPES = ["read-only", "emergency"] as const;

export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];
export type CredentialScope = (typeof CREDENTIAL_SCOPES)[number];
export type CredentialAuthMethod = "aws_profile" | "api_key" | "api_token" | "oauth2" | "pat";
export type CredentialBackendKind = "memory" | "os_keychain" | "encrypted_vault";
export type CredentialStoreState = "ready" | "locked" | "unavailable";
export type CredentialConnectionState =
  | "not_configured"
  | "credential_store_configured"
  | "oauth_connected"
  | "locked"
  | "expired"
  | "invalid";

export interface CredentialSecretInput {
  connectionId?: string;
  label?: string;
  secret: string;
  authMethod?: CredentialAuthMethod;
  active?: boolean;
  expiresAt?: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface StoredCredential {
  connectionId: string;
  label: string;
  secret: string;
  authMethod: CredentialAuthMethod;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  metadata: Readonly<Record<string, string>>;
}

export interface CredentialStatus {
  provider: CredentialProvider;
  scope: CredentialScope;
  connectionId?: string;
  label?: string;
  active?: boolean;
  state: CredentialConnectionState;
  backend: CredentialBackendKind;
  storeState: CredentialStoreState;
  authMethod?: CredentialAuthMethod;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  validatedAt?: string;
  reason?: string;
}

export interface CredentialStoreHealth {
  backend: CredentialBackendKind;
  state: CredentialStoreState;
  writable: boolean;
  reason?: string;
}

export interface CredentialStore {
  readonly backend: CredentialBackendKind;
  listCredentials(provider: CredentialProvider, scope: CredentialScope): Promise<StoredCredential[]>;
  getCredential(
    provider: CredentialProvider,
    scope: CredentialScope,
    connectionId?: string,
  ): Promise<StoredCredential | null>;
  setCredential(
    provider: CredentialProvider,
    scope: CredentialScope,
    secret: string | CredentialSecretInput,
  ): Promise<StoredCredential>;
  deleteCredential(provider: CredentialProvider, scope: CredentialScope, connectionId?: string): Promise<void>;
  getCredentialStatus(provider: CredentialProvider, scope: CredentialScope): Promise<CredentialStatus>;
  listCredentialStatuses(provider: CredentialProvider, scope: CredentialScope): Promise<CredentialStatus[]>;
  testCredentialStore(): Promise<CredentialStoreHealth>;
}

export interface CredentialOperationOptions {
  store?: CredentialStore;
  connectionId?: string;
}

export async function getCredential(
  provider: CredentialProvider,
  scope: CredentialScope,
  options: CredentialOperationOptions = {},
): Promise<StoredCredential | null> {
  return (options.store ?? getDefaultCredentialStore()).getCredential(provider, scope, options.connectionId);
}

export async function listCredentials(
  provider: CredentialProvider,
  scope: CredentialScope,
  options: CredentialOperationOptions = {},
): Promise<StoredCredential[]> {
  return (options.store ?? getDefaultCredentialStore()).listCredentials(provider, scope);
}

export async function setCredential(
  provider: CredentialProvider,
  scope: CredentialScope,
  secret: string | CredentialSecretInput,
  options: CredentialOperationOptions = {},
): Promise<StoredCredential> {
  return (options.store ?? getDefaultCredentialStore()).setCredential(provider, scope, secret);
}

export async function deleteCredential(
  provider: CredentialProvider,
  scope: CredentialScope,
  options: CredentialOperationOptions = {},
): Promise<void> {
  await (options.store ?? getDefaultCredentialStore()).deleteCredential(provider, scope, options.connectionId);
}

export async function testCredentialStore(
  options: CredentialOperationOptions = {},
): Promise<CredentialStoreHealth> {
  return (options.store ?? getDefaultCredentialStore()).testCredentialStore();
}

export async function getCredentialStatus(
  provider: CredentialProvider,
  scope: CredentialScope,
  options: CredentialOperationOptions = {},
): Promise<CredentialStatus> {
  return (options.store ?? getDefaultCredentialStore()).getCredentialStatus(provider, scope);
}

export async function listCredentialStatuses(
  provider: CredentialProvider,
  scope: CredentialScope,
  options: CredentialOperationOptions = {},
): Promise<CredentialStatus[]> {
  return (options.store ?? getDefaultCredentialStore()).listCredentialStatuses(provider, scope);
}

export interface MemoryCredentialStoreOptions {
  now?: () => Date;
  initialCredentials?: ReadonlyArray<{
    provider: CredentialProvider;
    scope: CredentialScope;
    credential: StoredCredential;
  }>;
}

export function createMemoryCredentialStore(options: MemoryCredentialStoreOptions = {}): CredentialStore {
  const now = options.now ?? (() => new Date());
  const credentials = new Map<string, StoredCredential>();

  for (const item of options.initialCredentials ?? []) {
    credentials.set(
      credentialKey(item.provider, item.scope, item.credential.connectionId),
      cloneCredential(item.credential),
    );
  }

  return {
    backend: "memory",
    async listCredentials(provider, scope) {
      return listStoredCredentials(credentials, provider, scope);
    },
    async getCredential(provider, scope, connectionId) {
      if (connectionId !== undefined) {
        return cloneCredentialOrNull(credentials.get(credentialKey(provider, scope, connectionId)) ?? null);
      }

      return cloneCredentialOrNull(firstActiveCredential(await this.listCredentials(provider, scope)));
    },
    async setCredential(provider, scope, secret) {
      const normalizedInput = normalizeSecretInput(secret);
      const connectionId = normalizeConnectionId(normalizedInput.connectionId ?? createCredentialConnectionId());
      const key = credentialKey(provider, scope, connectionId);
      const existing = credentials.get(key);
      const credential = normalizeCredentialInput(normalizedInput, {
        connectionId,
        existing,
        now,
      });

      credentials.set(
        key,
        credential,
      );

      return cloneCredential(credential);
    },
    async deleteCredential(provider, scope, connectionId) {
      if (connectionId !== undefined) {
        credentials.delete(credentialKey(provider, scope, connectionId));
        return;
      }

      deleteStoredCredentials(credentials, provider, scope);
    },
    async getCredentialStatus(provider, scope) {
      const credential = firstActiveCredential(await this.listCredentials(provider, scope));

      return statusForCredential({
        provider,
        scope,
        credential,
        backend: "memory",
        storeState: "ready",
        now: now(),
      });
    },
    async listCredentialStatuses(provider, scope) {
      return (await this.listCredentials(provider, scope)).map((credential) => statusForCredential({
        provider,
        scope,
        credential,
        backend: "memory",
        storeState: "ready",
        now: now(),
      }));
    },
    async testCredentialStore() {
      return {
        backend: "memory",
        state: "ready",
        writable: true,
      };
    },
  };
}

export interface EncryptedVaultCredentialStoreOptions {
  vaultPath?: string;
  cwd?: string;
  passphrase?: string;
  now?: () => Date;
}

export function createEncryptedVaultCredentialStore(
  options: EncryptedVaultCredentialStoreOptions = {},
): CredentialStore {
  const now = options.now ?? (() => new Date());
  const vaultPath = resolveVaultPath(options.cwd ?? process.cwd(), options.vaultPath);
  const passphrase = normalizePassphrase(options.passphrase);

  return {
    backend: "encrypted_vault",
    async listCredentials(provider, scope) {
      const payload = await readVaultPayload(vaultPath, passphrase);

      return listStoredCredentials(new Map(Object.entries(payload.credentials)), provider, scope);
    },
    async getCredential(provider, scope, connectionId) {
      const payload = await readVaultPayload(vaultPath, passphrase);

      if (connectionId !== undefined) {
        const credential = payload.credentials[credentialKey(provider, scope, connectionId)] ?? null;

        return cloneCredentialOrNull(credential);
      }

      return cloneCredentialOrNull(firstActiveCredential(await this.listCredentials(provider, scope)));
    },
    async setCredential(provider, scope, secret) {
      const payload = await readVaultPayload(vaultPath, passphrase);
      const normalizedInput = normalizeSecretInput(secret);
      const connectionId = normalizeConnectionId(normalizedInput.connectionId ?? createCredentialConnectionId());
      const key = credentialKey(provider, scope, connectionId);
      const credential = normalizeCredentialInput(normalizedInput, {
        connectionId,
        existing: payload.credentials[key],
        now,
      });
      payload.credentials[key] = credential;
      await writeVaultPayload(vaultPath, passphrase, payload);

      return cloneCredential(credential);
    },
    async deleteCredential(provider, scope, connectionId) {
      const payload = await readVaultPayload(vaultPath, passphrase);

      if (connectionId !== undefined) {
        delete payload.credentials[credentialKey(provider, scope, connectionId)];
      } else {
        for (const key of Object.keys(payload.credentials)) {
          if (isCredentialKeyFor(key, provider, scope)) {
            delete payload.credentials[key];
          }
        }
      }

      await writeVaultPayload(vaultPath, passphrase, payload);
    },
    async getCredentialStatus(provider, scope) {
      if (passphrase === undefined) {
        return vaultLockedOrEmptyStatus(vaultPath, provider, scope, now());
      }

      try {
        const credential = firstActiveCredential(await this.listCredentials(provider, scope));

        return statusForCredential({
          provider,
          scope,
          credential,
          backend: "encrypted_vault",
          storeState: "ready",
          now: now(),
        });
      } catch (error) {
        return lockedStatus(provider, scope, "encrypted_vault", errorMessage(error));
      }
    },
    async listCredentialStatuses(provider, scope) {
      if (passphrase === undefined) {
        const status = await this.getCredentialStatus(provider, scope);

        return status.state === "not_configured" ? [] : [status];
      }

      return (await this.listCredentials(provider, scope)).map((credential) => statusForCredential({
        provider,
        scope,
        credential,
        backend: "encrypted_vault",
        storeState: "ready",
        now: now(),
      }));
    },
    async testCredentialStore() {
      if (passphrase === undefined) {
        return {
          backend: "encrypted_vault",
          state: "locked",
          writable: false,
          reason: "Vault passphrase is not loaded in this server process.",
        };
      }

      const probeProvider = "openai";
      const probeScope = "read-only";
      const probeSecret = `probe-${randomBytes(8).toString("hex")}`;

      try {
        const probeCredential = await this.setCredential(probeProvider, probeScope, {
          secret: probeSecret,
          authMethod: "api_key",
        });
        const roundTrip = await this.getCredential(probeProvider, probeScope, probeCredential.connectionId);
        await this.deleteCredential(probeProvider, probeScope, probeCredential.connectionId);

        return {
          backend: "encrypted_vault",
          state: roundTrip?.secret === probeSecret ? "ready" : "unavailable",
          writable: roundTrip?.secret === probeSecret,
          ...(roundTrip?.secret === probeSecret ? {} : { reason: "Vault round-trip check failed." }),
        };
      } catch (error) {
        return {
          backend: "encrypted_vault",
          state: "unavailable",
          writable: false,
          reason: errorMessage(error),
        };
      }
    },
  };
}

export interface OsKeychainCredentialStoreOptions {
  serviceName?: string;
  now?: () => Date;
  loadKeyring?: () => Promise<KeyringModule>;
}

export function createOsKeychainCredentialStore(options: OsKeychainCredentialStoreOptions = {}): CredentialStore {
  const now = options.now ?? (() => new Date());
  const serviceName = options.serviceName ?? "StackSpend";
  const loadKeyring = options.loadKeyring ?? loadNapiKeyring;

  return {
    backend: "os_keychain",
    async listCredentials(provider, scope) {
      const module = await loadKeyring();
      const ids = readKeychainConnectionIndex(module, serviceName, provider, scope);
      const credentials: StoredCredential[] = [];

      for (const connectionId of ids) {
        const raw = readPassword(module, serviceName, credentialKey(provider, scope, connectionId));

        if (raw === null || raw.trim().length === 0) {
          continue;
        }

        credentials.push(parseStoredCredential(raw));
      }

      return credentials.sort(compareCredentials);
    },
    async getCredential(provider, scope, connectionId) {
      const module = await loadKeyring();

      if (connectionId !== undefined) {
        const raw = readPassword(module, serviceName, credentialKey(provider, scope, connectionId));

        if (raw === null || raw.trim().length === 0) {
          return null;
        }

        return parseStoredCredential(raw);
      }

      const credential = firstActiveCredential(await this.listCredentials(provider, scope));

      return cloneCredentialOrNull(credential);
    },
    async setCredential(provider, scope, secret) {
      const module = await loadKeyring();
      const normalizedInput = normalizeSecretInput(secret);
      const connectionId = normalizeConnectionId(normalizedInput.connectionId ?? createCredentialConnectionId());
      const existing = await this.getCredential(provider, scope, connectionId);
      const credential = normalizeCredentialInput(normalizedInput, {
        connectionId,
        existing: existing ?? undefined,
        now,
      });

      writePassword(module, serviceName, credentialKey(provider, scope, connectionId), JSON.stringify(credential));
      writeKeychainConnectionIndex(module, serviceName, provider, scope, connectionId);

      return cloneCredential(credential);
    },
    async deleteCredential(provider, scope, connectionId) {
      const module = await loadKeyring();

      if (connectionId !== undefined) {
        deletePassword(module, serviceName, credentialKey(provider, scope, connectionId));
        removeKeychainConnectionIndex(module, serviceName, provider, scope, connectionId);
        return;
      }

      for (const storedConnectionId of readKeychainConnectionIndex(module, serviceName, provider, scope)) {
        deletePassword(module, serviceName, credentialKey(provider, scope, storedConnectionId));
      }
      deletePassword(module, serviceName, credentialIndexKey(provider, scope));
    },
    async getCredentialStatus(provider, scope) {
      try {
        const credential = firstActiveCredential(await this.listCredentials(provider, scope));

        return statusForCredential({
          provider,
          scope,
          credential,
          backend: "os_keychain",
          storeState: "ready",
          now: now(),
        });
      } catch (error) {
        return {
          provider,
          scope,
          backend: "os_keychain",
          storeState: "unavailable",
          state: "not_configured",
          reason: errorMessage(error),
        };
      }
    },
    async listCredentialStatuses(provider, scope) {
      try {
        return (await this.listCredentials(provider, scope)).map((credential) => statusForCredential({
          provider,
          scope,
          credential,
          backend: "os_keychain",
          storeState: "ready",
          now: now(),
        }));
      } catch {
        return [];
      }
    },
    async testCredentialStore() {
      const account = `probe:${randomBytes(8).toString("hex")}`;
      const probeSecret = `probe-${randomBytes(8).toString("hex")}`;

      try {
        const module = await loadKeyring();
        writePassword(module, serviceName, account, probeSecret);
        const roundTrip = readPassword(module, serviceName, account);
        deletePassword(module, serviceName, account);

        return {
          backend: "os_keychain",
          state: roundTrip === probeSecret ? "ready" : "unavailable",
          writable: roundTrip === probeSecret,
          ...(roundTrip === probeSecret ? {} : { reason: "OS keychain round-trip check failed." }),
        };
      } catch (error) {
        return {
          backend: "os_keychain",
          state: "unavailable",
          writable: false,
          reason: errorMessage(error),
        };
      }
    },
  };
}

export interface DefaultCredentialStoreOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
  now?: () => Date;
}

export function createDefaultCredentialStore(options: DefaultCredentialStoreOptions = {}): CredentialStore {
  const env = options.env ?? process.env;
  const backend = env.STACKSPEND_CREDENTIAL_BACKEND?.trim().toLowerCase();
  const vault = createEncryptedVaultCredentialStore({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(env.STACKSPEND_CREDENTIAL_VAULT_PATH === undefined
      ? {}
      : { vaultPath: env.STACKSPEND_CREDENTIAL_VAULT_PATH }),
    ...(env.STACKSPEND_CREDENTIAL_VAULT_PASSPHRASE === undefined
      ? {}
      : { passphrase: env.STACKSPEND_CREDENTIAL_VAULT_PASSPHRASE }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const keychain = createOsKeychainCredentialStore({
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  if (backend === "vault" || backend === "encrypted_vault") {
    return vault;
  }

  if (backend === "keychain" || backend === "os_keychain") {
    return keychain;
  }

  return createPreferredCredentialStore({
    primary: keychain,
    fallback: vault,
  });
}

let defaultStore: CredentialStore | undefined;

function getDefaultCredentialStore(): CredentialStore {
  defaultStore ??= createDefaultCredentialStore();

  return defaultStore;
}

export interface PreferredCredentialStoreOptions {
  primary: CredentialStore;
  fallback: CredentialStore;
}

export function createPreferredCredentialStore(options: PreferredCredentialStoreOptions): CredentialStore {
  let selectedStore: Promise<CredentialStore> | undefined;
  const selectStore = async (): Promise<CredentialStore> => {
    selectedStore ??= selectPreferredCredentialStore(options.primary, options.fallback);

    return selectedStore;
  };

  return {
    backend: "os_keychain",
    async listCredentials(provider, scope) {
      return (await selectStore()).listCredentials(provider, scope);
    },
    async getCredential(provider, scope, connectionId) {
      return (await selectStore()).getCredential(provider, scope, connectionId);
    },
    async setCredential(provider, scope, secret) {
      return (await selectStore()).setCredential(provider, scope, secret);
    },
    async deleteCredential(provider, scope, connectionId) {
      await (await selectStore()).deleteCredential(provider, scope, connectionId);
    },
    async getCredentialStatus(provider, scope) {
      return (await selectStore()).getCredentialStatus(provider, scope);
    },
    async listCredentialStatuses(provider, scope) {
      return (await selectStore()).listCredentialStatuses(provider, scope);
    },
    async testCredentialStore() {
      return (await selectStore()).testCredentialStore();
    },
  };
}

async function selectPreferredCredentialStore(
  primary: CredentialStore,
  fallback: CredentialStore,
): Promise<CredentialStore> {
  const status = await primary.getCredentialStatus("openai", "read-only");

  return status.storeState === "unavailable" ? fallback : primary;
}

interface VaultPayload {
  version: 1;
  credentials: Record<string, StoredCredential>;
}

interface VaultFile {
  version: 1;
  kdf: "scrypt";
  cipher: "aes-256-gcm";
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

interface KeyringEntry {
  getPassword(): string | null;
  setPassword(password: string): void;
  deletePassword(): void;
}

interface KeyringModule {
  Entry: new (service: string, account: string) => KeyringEntry;
}

const DEFAULT_VAULT_PATH = ".stackspend/credentials-vault.json";
const SCRYPT_KEY_LENGTH = 32;
const GCM_IV_LENGTH = 12;
const GCM_AUTH_TAG_LENGTH = 16;

async function readVaultPayload(vaultPath: string, passphrase: string | undefined): Promise<VaultPayload> {
  if (passphrase === undefined) {
    throw new Error("Credential vault is locked.");
  }

  const file = await readVaultFileOrNull(vaultPath);

  if (file === null) {
    return createEmptyVaultPayload();
  }

  return decryptVaultPayload(file, passphrase);
}

async function writeVaultPayload(
  vaultPath: string,
  passphrase: string | undefined,
  payload: VaultPayload,
): Promise<void> {
  if (passphrase === undefined) {
    throw new Error("Credential vault is locked.");
  }

  await mkdir(dirname(vaultPath), {
    recursive: true,
  });
  await writeFile(vaultPath, JSON.stringify(encryptVaultPayload(payload, passphrase), null, 2), {
    encoding: "utf8",
  });
}

async function readVaultFileOrNull(vaultPath: string): Promise<VaultFile | null> {
  try {
    return JSON.parse(await readFile(vaultPath, "utf8")) as VaultFile;
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }

    throw error;
  }
}

async function vaultLockedOrEmptyStatus(
  vaultPath: string,
  provider: CredentialProvider,
  scope: CredentialScope,
  now: Date,
): Promise<CredentialStatus> {
  const file = await readVaultFileOrNull(vaultPath);

  if (file === null) {
    return statusForCredential({
      provider,
      scope,
      credential: null,
      backend: "encrypted_vault",
      storeState: "locked",
      now,
    });
  }

  return lockedStatus(provider, scope, "encrypted_vault", "Credential vault is locked.");
}

function encryptVaultPayload(payload: VaultPayload, passphrase: string): VaultFile {
  const salt = randomBytes(16);
  const iv = randomBytes(GCM_IV_LENGTH);
  const key = deriveVaultKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: GCM_AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return {
    version: 1,
    kdf: "scrypt",
    cipher: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptVaultPayload(file: VaultFile, passphrase: string): VaultPayload {
  if (
    file.version !== 1 ||
    file.kdf !== "scrypt" ||
    file.cipher !== "aes-256-gcm" ||
    typeof file.salt !== "string" ||
    typeof file.iv !== "string" ||
    typeof file.authTag !== "string" ||
    typeof file.ciphertext !== "string"
  ) {
    throw new Error("Credential vault format is unsupported.");
  }

  const key = deriveVaultKey(passphrase, Buffer.from(file.salt, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(file.iv, "base64"), {
    authTagLength: GCM_AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(file.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(file.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const payload = JSON.parse(plaintext) as VaultPayload;

  if (payload.version !== 1 || typeof payload.credentials !== "object" || payload.credentials === null) {
    throw new Error("Credential vault payload is invalid.");
  }

  return payload;
}

function deriveVaultKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, SCRYPT_KEY_LENGTH);
}

function createEmptyVaultPayload(): VaultPayload {
  return {
    version: 1,
    credentials: {},
  };
}

export async function resetEncryptedVault(options: EncryptedVaultCredentialStoreOptions = {}): Promise<void> {
  const vaultPath = resolveVaultPath(options.cwd ?? process.cwd(), options.vaultPath);

  await rm(vaultPath, {
    force: true,
  });
}

function normalizeSecretInput(input: string | CredentialSecretInput): CredentialSecretInput {
  return typeof input === "string"
    ? {
        secret: input,
      }
    : input;
}

function normalizeCredentialInput(
  input: CredentialSecretInput,
  options: {
    connectionId: string;
    existing: StoredCredential | undefined;
    now: () => Date;
  },
): StoredCredential {
  const nowIso = options.now().toISOString();
  const secret = input.secret.trim();
  const label = normalizeCredentialLabel(input.label ?? options.existing?.label);

  if (secret.length === 0) {
    throw new Error("Credential secret must not be blank.");
  }

  if (input.expiresAt !== undefined && Number.isNaN(new Date(input.expiresAt).getTime())) {
    throw new Error("Credential expiration must be an ISO-compatible timestamp.");
  }

  return {
    connectionId: options.connectionId,
    label,
    secret,
    authMethod: input.authMethod ?? options.existing?.authMethod ?? "api_token",
    active: input.active ?? options.existing?.active ?? true,
    createdAt: options.existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    metadata: sanitizeMetadata(input.metadata ?? {}),
  };
}

function normalizeConnectionId(connectionId: string): string {
  const trimmed = connectionId.trim();

  if (!/^[A-Za-z0-9_-]{6,64}$/.test(trimmed)) {
    throw new Error("Credential connection id is invalid.");
  }

  return trimmed;
}

function createCredentialConnectionId(): string {
  return `conn_${randomBytes(8).toString("hex")}`;
}

function normalizeCredentialLabel(label: string | undefined): string {
  const trimmed = label?.trim();

  return trimmed === undefined || trimmed.length === 0 ? "Default" : trimmed.slice(0, 80);
}

function sanitizeMetadata(metadata: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, value.trim()]),
  );
}

function statusForCredential(options: {
  provider: CredentialProvider;
  scope: CredentialScope;
  credential: StoredCredential | null;
  backend: CredentialBackendKind;
  storeState: CredentialStoreState;
  now: Date;
}): CredentialStatus {
  if (options.credential === null) {
    return {
      provider: options.provider,
      scope: options.scope,
      backend: options.backend,
      storeState: options.storeState,
      state: "not_configured",
    };
  }

  const expired = options.credential.expiresAt !== undefined &&
    new Date(options.credential.expiresAt).getTime() <= options.now.getTime();
  const state: CredentialConnectionState = expired
    ? "expired"
    : options.credential.authMethod === "oauth2"
      ? "oauth_connected"
      : "credential_store_configured";

  return {
    provider: options.provider,
    scope: options.scope,
    connectionId: options.credential.connectionId,
    label: options.credential.label,
    active: options.credential.active,
    backend: options.backend,
    storeState: options.storeState,
    state,
    authMethod: options.credential.authMethod,
    createdAt: options.credential.createdAt,
    updatedAt: options.credential.updatedAt,
    ...(options.credential.expiresAt === undefined ? {} : { expiresAt: options.credential.expiresAt }),
    ...(options.credential.metadata.validatedAt === undefined
      ? {}
      : { validatedAt: options.credential.metadata.validatedAt }),
  };
}

function lockedStatus(
  provider: CredentialProvider,
  scope: CredentialScope,
  backend: CredentialBackendKind,
  reason: string,
): CredentialStatus {
  return {
    provider,
    scope,
    backend,
    storeState: "locked",
    state: "locked",
    reason,
  };
}

function credentialKey(provider: CredentialProvider, scope: CredentialScope, connectionId: string): string {
  return `${provider}:${scope}:${connectionId}`;
}

function credentialIndexKey(provider: CredentialProvider, scope: CredentialScope): string {
  return `${provider}:${scope}:index`;
}

function credentialPrefix(provider: CredentialProvider, scope: CredentialScope): string {
  return `${provider}:${scope}:`;
}

function isCredentialKeyFor(key: string, provider: CredentialProvider, scope: CredentialScope): boolean {
  const prefix = credentialPrefix(provider, scope);

  return key.startsWith(prefix) && key !== credentialIndexKey(provider, scope);
}

function listStoredCredentials(
  credentials: ReadonlyMap<string, StoredCredential>,
  provider: CredentialProvider,
  scope: CredentialScope,
): StoredCredential[] {
  return [...credentials.entries()]
    .filter(([key]) => isCredentialKeyFor(key, provider, scope))
    .map(([, credential]) => cloneCredential(credential))
    .sort(compareCredentials);
}

function deleteStoredCredentials(
  credentials: Map<string, StoredCredential>,
  provider: CredentialProvider,
  scope: CredentialScope,
): void {
  for (const key of credentials.keys()) {
    if (isCredentialKeyFor(key, provider, scope)) {
      credentials.delete(key);
    }
  }
}

function firstActiveCredential(credentials: readonly StoredCredential[]): StoredCredential | null {
  return credentials.find((credential) => credential.active) ?? credentials[0] ?? null;
}

function compareCredentials(left: StoredCredential, right: StoredCredential): number {
  return left.createdAt.localeCompare(right.createdAt) ||
    left.connectionId.localeCompare(right.connectionId);
}

function cloneCredentialOrNull(credential: StoredCredential | null): StoredCredential | null {
  return credential === null ? null : cloneCredential(credential);
}

function cloneCredential(credential: StoredCredential): StoredCredential {
  return {
    ...credential,
    metadata: {
      ...credential.metadata,
    },
  };
}

function parseStoredCredential(value: string): StoredCredential {
  const parsed = JSON.parse(value) as StoredCredential;

  if (
    typeof parsed.connectionId !== "string" ||
    typeof parsed.label !== "string" ||
    typeof parsed.secret !== "string" ||
    typeof parsed.authMethod !== "string" ||
    typeof parsed.active !== "boolean" ||
    typeof parsed.createdAt !== "string" ||
    typeof parsed.updatedAt !== "string"
  ) {
    throw new Error("Stored credential payload is invalid.");
  }

  return {
    ...parsed,
    metadata: sanitizeMetadata(parsed.metadata ?? {}),
  };
}

function resolveVaultPath(cwd: string, configuredPath: string | undefined): string {
  const rawPath = configuredPath?.trim() || DEFAULT_VAULT_PATH;

  return isAbsolute(rawPath) ? rawPath : join(cwd, rawPath);
}

function normalizePassphrase(passphrase: string | undefined): string | undefined {
  const trimmed = passphrase?.trim();

  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

async function loadNapiKeyring(): Promise<KeyringModule> {
  const module = await import("@napi-rs/keyring");

  if (!isKeyringModule(module)) {
    throw new Error("@napi-rs/keyring did not expose Entry.");
  }

  return module;
}

function readPassword(module: KeyringModule, serviceName: string, account: string): string | null {
  return new module.Entry(serviceName, account).getPassword();
}

function writePassword(module: KeyringModule, serviceName: string, account: string, password: string): void {
  new module.Entry(serviceName, account).setPassword(password);
}

function deletePassword(module: KeyringModule, serviceName: string, account: string): void {
  try {
    new module.Entry(serviceName, account).deletePassword();
  } catch {
    // Missing entries are already deleted for StackSpend's purposes.
  }
}

function readKeychainConnectionIndex(
  module: KeyringModule,
  serviceName: string,
  provider: CredentialProvider,
  scope: CredentialScope,
): string[] {
  const raw = readPassword(module, serviceName, credentialIndexKey(provider, scope));

  if (raw === null || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .filter((item) => /^[A-Za-z0-9_-]{6,64}$/.test(item));
  } catch {
    return [];
  }
}

function writeKeychainConnectionIndex(
  module: KeyringModule,
  serviceName: string,
  provider: CredentialProvider,
  scope: CredentialScope,
  connectionId: string,
): void {
  const ids = new Set(readKeychainConnectionIndex(module, serviceName, provider, scope));
  ids.add(connectionId);
  writePassword(module, serviceName, credentialIndexKey(provider, scope), JSON.stringify([...ids].sort()));
}

function removeKeychainConnectionIndex(
  module: KeyringModule,
  serviceName: string,
  provider: CredentialProvider,
  scope: CredentialScope,
  connectionId: string,
): void {
  const ids = readKeychainConnectionIndex(module, serviceName, provider, scope)
    .filter((item) => item !== connectionId);

  if (ids.length === 0) {
    deletePassword(module, serviceName, credentialIndexKey(provider, scope));
    return;
  }

  writePassword(module, serviceName, credentialIndexKey(provider, scope), JSON.stringify(ids));
}

function isKeyringModule(value: unknown): value is KeyringModule {
  return typeof value === "object" && value !== null && "Entry" in value;
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Credential store operation failed.";
}
