import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, win32 } from "node:path";
import { promisify } from "node:util";
import { readCodexAppServerMeasurements } from "./local-ai/codex/app-server-client";
import {
  readCodexAppServerOfficialMeasurements,
  type CodexOfficialAccountMeasurements,
} from "./local-ai/codex/app-server-transport";

const execFileAsync = promisify(execFile);
const AWS_CLI_TIMEOUT_MS = 10_000;
const AWS_PROFILE_PERSIST_TIMEOUT_MS = 10_000;
const GCLOUD_CLI_TIMEOUT_MS = 10_000;
const LOCAL_CLI_TIMEOUT_MS = 3_000;
const CODEX_APP_SERVER_TIMEOUT_MS = 8_000;
const CODEX_APP_SERVER_CACHE_MS = 30_000;
const CODEX_RESET_CREDIT_DEFAULT_TTL_DAYS = 30;
const CODEX_RESET_CREDIT_OBSERVATION_FILE = "codex-reset-credit-observations.json";
const MAX_LOCAL_USAGE_FILES = 400;
const LOCAL_AI_CLI_STATUS_CACHE_MS = 30_000;
const AWS_PROFILE_NAME_PATTERN = /^[A-Za-z0-9_.:@+=,-]{1,80}$/;
const PROVIDER_ENV_VALUE_MAX_LENGTH = 8_000;
const PROVIDER_ENV_KEYS = new Set([
  "OPENAI_ADMIN_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_IDS",
]);
const WINDOWS_PATH_DELIMITER = ";";
const DEFAULT_LOCAL_AI_PROVIDER_KEYS = ["codex-cli", "codex-app", "claude-cli", "claude-app", "antigravity"] as const;

export const AWS_CLI_INSTALL_URL = "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html";
export const AWS_CLI_SSO_URL = "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html";
export const GCLOUD_CLI_INSTALL_URL = "https://docs.cloud.google.com/sdk/docs/install";
export const GCLOUD_CLI_AUTH_URL = "https://docs.cloud.google.com/docs/authentication/gcloud";
export const GCLOUD_ADC_AUTH_URL = "https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/login";

export type AwsCliState = "installed" | "missing" | "error";
export type AwsCredentialChainState = "configured" | "missing";
export type AwsCredentialChainSource = "AWS_PROFILE" | "access_key_env" | "none";
export type GcloudCliState = "installed" | "missing" | "error";
export type GcpLocalSetupState = "configured" | "missing";
export type GcpAdcSource = "GOOGLE_APPLICATION_CREDENTIALS" | "application_default_credentials" | "none";
export type LocalAiCliProviderKey = "codex-cli" | "codex-app" | "claude-cli" | "claude-app" | "antigravity";
export type LocalCliState = "installed" | "missing" | "error";

export interface AwsLocalSetupStatus {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  awsCli: {
    state: AwsCliState;
    version: string | null;
    detail: string | null;
  };
  credentialChain: {
    state: AwsCredentialChainState;
    source: AwsCredentialChainSource;
    profileName: string | null;
  };
  docs: {
    installUrl: string;
    ssoUrl: string;
  };
  commands: readonly string[];
}

export interface ReadAwsLocalSetupStatusOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  runCommand?: LocalCommandRunner;
}

export interface SetAwsProfileGloballyOptions {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  now?: () => Date;
  runCommand?: LocalCommandRunner;
}

export interface SetAwsProfileGloballyResult {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  profileName: string;
  target: "windows_user_environment";
  activeForCurrentProcess: true;
  restartHint: string;
}

export interface SetProviderEnvGloballyOptions {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  now?: () => Date;
  runCommand?: LocalCommandRunner;
}

export interface SetProviderEnvGloballyResult {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  keys: readonly string[];
  target: "windows_user_environment" | "process_environment";
  activeForCurrentProcess: true;
  restartHint: string;
}

export interface GcpLocalSetupStatus {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  gcloudCli: {
    state: GcloudCliState;
    version: string | null;
    detail: string | null;
  };
  account: {
    state: GcpLocalSetupState;
    activeAccountHint: string | null;
  };
  project: {
    state: GcpLocalSetupState;
    projectIdHint: string | null;
  };
  adc: {
    state: GcpLocalSetupState;
    source: GcpAdcSource;
    envConfigured: boolean;
    fileDetected: boolean;
  };
  docs: {
    installUrl: string;
    authUrl: string;
    adcUrl: string;
  };
  commands: readonly string[];
}

export interface ReadGcpLocalSetupStatusOptions {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  now?: () => Date;
  runCommand?: LocalCommandRunner;
  homeDir?: string;
}

export interface LocalAiCliStatusPayload {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
  providers: readonly LocalAiCliProviderStatus[];
}

export interface LocalAiCliProviderStatus {
  providerKey: LocalAiCliProviderKey;
  displayName: string;
  command: string;
  cli: {
    state: LocalCliState;
    version: string | null;
    detail: string | null;
  };
  usage: LocalCliUsageSummary;
}

export interface LocalCliUsageSummary {
  source: "codex_sessions" | "codex_app_sessions" | "claude_projects" | "claude_app" | "antigravity_app" | "not_found";
  period: "current_month";
  providerKind: "codex" | "claude" | "antigravity";
  sessionCount: number;
  turnCount: number;
  toolCallCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheTokens: number | null;
  totalTokens: number | null;
  reasoningOutputTokens: number | null;
  logFileCount: number;
  parsedUsageRecordCount: number;
  searchedPathHint: string;
  latestActivityAt: string | null;
  topModels: readonly string[];
  statusLine: LocalCliStatusLineUsage;
  message: string;
  codexOfficial?: CodexOfficialAccountMeasurements;
}

export interface LocalCliUsageResetCredit {
  label: string | null;
  expiresAt: string | null;
  estimatedEarliestExpiryUtc?: string | null;
  estimatedLatestExpiryUtc?: string | null;
  observedFromUtc?: string | null;
  observedToUtc?: string | null;
  status?: CodexResetCreditObservationStatus;
  isExact?: boolean;
}

export type CodexResetCreditObservationStatus = "estimated" | "initial_existing" | "removed_unknown";

export interface CodexResetCreditObservation {
  id: string;
  previousCount: number;
  currentCount: number;
  observedFromUtc: string;
  observedToUtc: string;
  estimatedEarliestExpiryUtc: string | null;
  estimatedLatestExpiryUtc: string | null;
  status: CodexResetCreditObservationStatus;
  isExact: false;
  removedAtUtc?: string;
}

export interface CodexResetCreditObservationStore {
  version: 1;
  updatedAtUtc: string;
  lastObservedAtUtc: string | null;
  lastCount: number | null;
  observations: readonly CodexResetCreditObservation[];
}

export interface LocalCliStatusLineUsage {
  contextWindowTokens: number | null;
  contextWindowLimit: number | null;
  contextWindowPercent: number | null;
  fiveHourUsedTokens: number | null;
  fiveHourLimitTokens: number | null;
  fiveHourLimitPercent: number | null;
  fiveHourRemainingTokens: number | null;
  fiveHourResetAt: string | null;
  weeklyUsedTokens: number | null;
  weeklyLimitTokens: number | null;
  weeklyLimitPercent: number | null;
  weeklyRemainingTokens: number | null;
  weeklyResetAt: string | null;
  lastInputTokens: number | null;
  lastOutputTokens: number | null;
  lastCacheTokens: number | null;
  lastReasoningTokens: number | null;
  lastTotalTokens: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalCacheTokens: number | null;
  totalReasoningTokens: number | null;
  totalTokens: number | null;
  usageResetCredits: readonly LocalCliUsageResetCredit[];
}

export interface ReadLocalAiCliStatusOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  runCommand?: LocalCommandRunner;
  homeDir?: string;
  providerKeys?: readonly LocalAiCliProviderKey[];
  cacheTtlMs?: number;
}

export type LocalCommandRunner = (
  file: string,
  args: readonly string[],
  options: {
    direct?: boolean;
    timeout: number;
    windowsHide: boolean;
  },
) => Promise<{
  stdout?: string;
  stderr?: string;
}>;

export function buildWindowsLocalToolPath(
  currentPath: string,
  env: Record<string, string | undefined>,
  nodeExecutable: string,
): string {
  return appendUniqueWindowsPathSegments(currentPath, [
    win32.dirname(windowsSystemExecutable("cmd.exe", env)),
    trimToNull(nodeExecutable) === null ? null : win32.dirname(nodeExecutable),
    trimToNull(env.NVM_SYMLINK),
    trimToNull(env.NVM_HOME),
    joinIfBase(env.APPDATA, "npm"),
    joinIfBase(env.USERPROFILE, "AppData", "Roaming", "npm"),
    joinIfBase(env.LOCALAPPDATA, "pnpm"),
    joinIfBase(env.VOLTA_HOME, "bin"),
    joinIfBase(env.LOCALAPPDATA, "Volta", "bin"),
    joinIfBase(env.USERPROFILE, ".volta", "bin"),
    joinIfBase(env.SCOOP, "shims"),
    joinIfBase(env.USERPROFILE, "scoop", "shims"),
    joinIfBase(env.ChocolateyInstall, "bin"),
    joinIfBase(env.ProgramData, "chocolatey", "bin"),
    joinIfBase(env.USERPROFILE, ".bun", "bin"),
    joinIfBase(env.LOCALAPPDATA, "Microsoft", "WindowsApps"),
    joinIfBase(env["ProgramFiles"], "Amazon", "AWSCLIV2"),
    win32.join("C:\\Program Files", "Amazon", "AWSCLIV2"),
    joinIfBase(env["ProgramFiles"], "Google", "Cloud SDK", "google-cloud-sdk", "bin"),
    joinIfBase(env["ProgramFiles(x86)"], "Google", "Cloud SDK", "google-cloud-sdk", "bin"),
    win32.join("C:\\Program Files", "Google", "Cloud SDK", "google-cloud-sdk", "bin"),
    win32.join("C:\\Program Files (x86)", "Google", "Cloud SDK", "google-cloud-sdk", "bin"),
  ]);
}

let localAiCliStatusCache: {
  expiresAt: number;
  key: string;
  payload: LocalAiCliStatusPayload;
} | null = null;
let localAiCliStatusInFlight: {
  key: string;
  promise: Promise<LocalAiCliStatusPayload>;
} | null = null;
let codexAppServerRateLimitCache: {
  expiresAt: number;
  key: string;
  promise: Promise<LocalCliStatusLineUsage | null>;
} | null = null;

export async function readAwsLocalSetupStatus(
  options: ReadAwsLocalSetupStatusOptions = {},
): Promise<AwsLocalSetupStatus> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const runCommand = options.runCommand ?? defaultRunCommand;
  const awsCli = await readAwsCliStatus(runCommand);
  const credentialChain = readAwsCredentialChainStatus(env);

  return {
    generatedAt: now().toISOString(),
    localOnly: true,
    secretsReturned: false,
    awsCli,
    credentialChain,
    docs: {
      installUrl: AWS_CLI_INSTALL_URL,
      ssoUrl: AWS_CLI_SSO_URL,
    },
    commands: [
      "aws --version",
      "aws configure sso",
      "aws sso login --profile <profile>",
      "$env:AWS_PROFILE=\"<profile>\"",
      "setx AWS_PROFILE <profile>",
    ],
  };
}

export async function setAwsProfileGlobally(
  profileName: string,
  options: SetAwsProfileGloballyOptions = {},
): Promise<SetAwsProfileGloballyResult> {
  const normalizedProfileName = normalizeAwsProfileName(profileName);
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const now = options.now ?? (() => new Date());
  const runCommand = options.runCommand ?? defaultRunCommand;

  if (platform !== "win32") {
    throw new Error("Persisting AWS_PROFILE from MoneySiren is currently supported on Windows only.");
  }

  try {
    await runCommand(windowsSystemExecutable("setx.exe", env), ["AWS_PROFILE", normalizedProfileName], {
      direct: true,
      timeout: AWS_PROFILE_PERSIST_TIMEOUT_MS,
      windowsHide: true,
    });
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : "setx failed.";

    throw new Error(`AWS_PROFILE was not saved to the Windows user environment. ${detail}`);
  }

  env.AWS_PROFILE = normalizedProfileName;

  return {
    generatedAt: now().toISOString(),
    localOnly: true,
    secretsReturned: false,
    profileName: normalizedProfileName,
    target: "windows_user_environment",
    activeForCurrentProcess: true,
    restartHint: "New terminals inherit the saved AWS_PROFILE. The current MoneySiren server process was updated immediately.",
  };
}

export async function setProviderEnvGlobally(
  entries: Readonly<Record<string, string>>,
  options: SetProviderEnvGloballyOptions = {},
): Promise<SetProviderEnvGloballyResult> {
  const normalizedEntries = normalizeProviderEnvEntries(entries);
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const now = options.now ?? (() => new Date());
  const runCommand = options.runCommand ?? defaultRunCommand;
  const keys = Object.keys(normalizedEntries).sort();

  if (platform === "win32") {
    try {
      for (const key of keys) {
        await runCommand(windowsSystemExecutable("setx.exe", env), [key, normalizedEntries[key] ?? ""], {
          direct: true,
          timeout: AWS_PROFILE_PERSIST_TIMEOUT_MS,
          windowsHide: true,
        });
      }
    } catch {
      throw new Error("Provider environment variables were not saved to the Windows user environment.");
    }
  }

  for (const key of keys) {
    env[key] = normalizedEntries[key];
  }

  return {
    generatedAt: now().toISOString(),
    localOnly: true,
    secretsReturned: false,
    keys,
    target: platform === "win32" ? "windows_user_environment" : "process_environment",
    activeForCurrentProcess: true,
    restartHint: platform === "win32"
      ? "New terminals inherit the saved provider environment variables. The current MoneySiren server process was updated immediately."
      : "The current MoneySiren server process was updated immediately. Persist these variables in your shell profile before restarting.",
  };
}

export async function readGcpLocalSetupStatus(
  options: ReadGcpLocalSetupStatusOptions = {},
): Promise<GcpLocalSetupStatus> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const runCommand = options.runCommand ?? defaultRunCommand;
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? readHomeDir(env);
  const gcloudCli = await readGcloudCliStatus(runCommand);
  const [account, project] = gcloudCli.state === "installed"
    ? await Promise.all([
        readGcloudActiveAccount(runCommand),
        readGcloudProject(runCommand, env),
      ])
    : [
        {
          state: "missing" as const,
          activeAccountHint: null,
        },
        readGcpProjectFromEnv(env),
      ];
  const adc = await readGcpAdcStatus({
    env,
    homeDir,
    platform,
  });

  return {
    generatedAt: now().toISOString(),
    localOnly: true,
    secretsReturned: false,
    gcloudCli,
    account,
    project,
    adc,
    docs: {
      installUrl: GCLOUD_CLI_INSTALL_URL,
      authUrl: GCLOUD_CLI_AUTH_URL,
      adcUrl: GCLOUD_ADC_AUTH_URL,
    },
    commands: [
      "gcloud --version",
      "gcloud init",
      "gcloud auth login",
      "gcloud auth application-default login",
      "gcloud config set project <project-id>",
    ],
  };
}

export async function readLocalAiCliStatus(
  options: ReadLocalAiCliStatusOptions = {},
): Promise<LocalAiCliStatusPayload> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const runCommand = options.runCommand ?? defaultRunCommand;
  const homeDir = options.homeDir ?? readHomeDir(env);
  const providerKeys = options.providerKeys ?? DEFAULT_LOCAL_AI_PROVIDER_KEYS;
  const cacheKey = localAiCliStatusCacheKey(env, homeDir, providerKeys);
  const cacheTtlMs = options.cacheTtlMs ?? LOCAL_AI_CLI_STATUS_CACHE_MS;
  const cacheNow = now().getTime();
  const allowCodexAppServerProbe = options.runCommand === undefined &&
    trimToNull(env.MONEYSIREN_CODEX_APP_SERVER_USAGE_DISABLED) !== "1";

  if (options.runCommand === undefined && cacheTtlMs > 0 && localAiCliStatusCache?.key === cacheKey && localAiCliStatusCache.expiresAt > cacheNow) {
    return localAiCliStatusCache.payload;
  }

  if (options.runCommand === undefined && cacheTtlMs > 0 && localAiCliStatusInFlight?.key === cacheKey) {
    return localAiCliStatusInFlight.promise;
  }

  const promise = collectLocalAiCliStatusPayload({
    allowCodexAppServerProbe,
    env,
    homeDir,
    now,
    providerKeys,
    runCommand,
  });

  if (options.runCommand === undefined && cacheTtlMs > 0) {
    localAiCliStatusInFlight = {
      key: cacheKey,
      promise,
    };
  }

  try {
    const payload = await promise;

    if (options.runCommand === undefined && cacheTtlMs > 0) {
      localAiCliStatusCache = {
        expiresAt: now().getTime() + cacheTtlMs,
        key: cacheKey,
        payload,
      };
    }

    return payload;
  } finally {
    if (localAiCliStatusInFlight?.promise === promise) {
      localAiCliStatusInFlight = null;
    }
  }
}

async function collectLocalAiCliStatusPayload(options: {
  allowCodexAppServerProbe: boolean;
  env: Record<string, string | undefined>;
  homeDir: string;
  now: () => Date;
  providerKeys: readonly LocalAiCliProviderKey[];
  runCommand: LocalCommandRunner;
}): Promise<LocalAiCliStatusPayload> {
  return {
    generatedAt: options.now().toISOString(),
    localOnly: true,
    secretsReturned: false,
    providers: await Promise.all(options.providerKeys.map((providerKey) =>
      readLocalAiCliProviderStatus(providerKey, {
        env: options.env,
        homeDir: options.homeDir,
        now: options.now(),
        runCommand: options.runCommand,
        allowCodexAppServerProbe: options.allowCodexAppServerProbe,
      })
    )),
  };
}

async function readLocalAiCliProviderStatus(
  providerKey: LocalAiCliProviderKey,
  context: {
    env: Record<string, string | undefined>;
    homeDir: string;
    now: Date;
    runCommand: LocalCommandRunner;
    allowCodexAppServerProbe: boolean;
  },
): Promise<LocalAiCliProviderStatus> {
  const definition = localCliDefinition(providerKey);
  const [cli, usage] = await Promise.all([
    definition.surface === "cli"
      ? readLocalCliStatus(definition.command, definition.versionPattern, context.runCommand)
      : readLocalAppStatus(definition.appDataDir(context.env, context.homeDir), definition.versionFiles, context.homeDir),
    readLocalProviderUsage(providerKey, context),
  ]);

  return {
    providerKey,
    displayName: definition.displayName,
    command: definition.command,
    cli,
    usage,
  };
}

function localAiCliStatusCacheKey(
  env: Record<string, string | undefined>,
  homeDir: string,
  providerKeys: readonly LocalAiCliProviderKey[],
): string {
  return JSON.stringify({
    claudeConfigDir: trimToNull(env.CLAUDE_CONFIG_DIR),
    claudeFiveHourLimit: trimToNull(env.MONEYSIREN_CLAUDE_FIVE_HOUR_TOKEN_LIMIT),
    claudeWeeklyLimit: trimToNull(env.MONEYSIREN_CLAUDE_WEEKLY_TOKEN_LIMIT),
    codexUsageResetCredits: trimToNull(env.MONEYSIREN_CODEX_USAGE_RESET_CREDITS),
    codexUsageResetCreditExpiresAt: trimToNull(env.MONEYSIREN_CODEX_USAGE_RESET_CREDIT_EXPIRES_AT),
    codexAppUsageResetCredits: trimToNull(env.MONEYSIREN_CODEX_APP_USAGE_RESET_CREDITS),
    codexAppUsageResetCreditExpiresAt: trimToNull(env.MONEYSIREN_CODEX_APP_USAGE_RESET_CREDIT_EXPIRES_AT),
    codexAppServerUsageDisabled: trimToNull(env.MONEYSIREN_CODEX_APP_SERVER_USAGE_DISABLED),
    codexResetCreditObservationsPath: trimToNull(env.MONEYSIREN_CODEX_RESET_CREDIT_OBSERVATIONS_PATH),
    codexResetCreditTtlDays: trimToNull(env.MONEYSIREN_CODEX_RESET_CREDIT_TTL_DAYS),
    codexAppDataDir: trimToNull(env.MONEYSIREN_CODEX_APP_DATA_DIR),
    codexAppSessionsDir: trimToNull(env.MONEYSIREN_CODEX_APP_SESSIONS_DIR),
    codexHome: trimToNull(env.CODEX_HOME),
    codexSessionsDir: trimToNull(env.MONEYSIREN_CODEX_SESSIONS_DIR),
    codexFiveHourLimit: trimToNull(env.MONEYSIREN_CODEX_FIVE_HOUR_TOKEN_LIMIT),
    codexWeeklyLimit: trimToNull(env.MONEYSIREN_CODEX_WEEKLY_TOKEN_LIMIT),
    claudeAppDataDir: trimToNull(env.MONEYSIREN_CLAUDE_APP_DATA_DIR),
    claudeAppProjectsDir: trimToNull(env.MONEYSIREN_CLAUDE_APP_PROJECTS_DIR),
    antigravityDataDir: trimToNull(env.MONEYSIREN_ANTIGRAVITY_DATA_DIR),
    appData: trimToNull(env.APPDATA),
    localAppData: trimToNull(env.LOCALAPPDATA),
    homeDir,
    providerKeys: [...providerKeys].sort(),
  });
}

async function readLocalCliStatus(
  command: string,
  versionPattern: RegExp,
  runCommand: LocalCommandRunner,
): Promise<LocalAiCliProviderStatus["cli"]> {
  try {
    const result = await runCommand(command, ["--version"], {
      timeout: LOCAL_CLI_TIMEOUT_MS,
      windowsHide: true,
    });
    const output = normalizeCommandOutput(result.stdout, result.stderr);

    return {
      state: "installed",
      version: extractVersion(output, versionPattern),
      detail: output.length === 0 ? null : output,
    };
  } catch (caught) {
    if (isCommandMissingError(caught)) {
      return {
        state: "missing",
        version: null,
        detail: null,
      };
    }

    return {
      state: "error",
      version: null,
      detail: caught instanceof Error ? caught.message : "Local CLI check failed.",
    };
  }
}

type LocalToolDefinition = {
  command: string;
  displayName: string;
  surface: "cli";
  versionPattern: RegExp;
} | {
  command: string;
  displayName: string;
  surface: "app";
  appDataDir: (env: Record<string, string | undefined>, homeDir: string) => string;
  versionFiles: readonly string[];
};

function localCliDefinition(providerKey: LocalAiCliProviderKey): LocalToolDefinition {
  if (providerKey === "codex-cli") {
    return {
      command: "codex",
      displayName: "Codex CLI",
      surface: "cli",
      versionPattern: /codex(?:-cli)?\s+([^\s]+)/i,
    };
  }

  if (providerKey === "codex-app") {
    return {
      command: "Codex App",
      displayName: "Codex App",
      surface: "app",
      appDataDir: codexAppDataDir,
      versionFiles: ["Last Version"],
    };
  }

  if (providerKey === "claude-cli") {
    return {
      command: "claude",
      displayName: "Claude CLI",
      surface: "cli",
      versionPattern: /(?:claude(?: code)?|claude-code)\s+([^\s]+)/i,
    };
  }

  if (providerKey === "claude-app") {
    return {
      command: "Claude App",
      displayName: "Claude App",
      surface: "app",
      appDataDir: claudeAppDataDir,
      versionFiles: ["Last Version"],
    };
  }

  return {
    command: "Antigravity",
    displayName: "Antigravity",
    surface: "app",
    appDataDir: antigravityAppDataDir,
    versionFiles: ["Last Version"],
  };
}

async function readLocalProviderUsage(
  providerKey: LocalAiCliProviderKey,
  context: {
    env: Record<string, string | undefined>;
    homeDir: string;
    now: Date;
    allowCodexAppServerProbe: boolean;
  },
): Promise<LocalCliUsageSummary> {
  if (providerKey === "codex-cli") {
    return readCodexCliUsage(context);
  }

  if (providerKey === "codex-app") {
    return readCodexAppUsage(context);
  }

  if (providerKey === "claude-cli") {
    return readClaudeCliUsage(context);
  }

  if (providerKey === "claude-app") {
    return readClaudeAppUsage(context);
  }

  return readLocalAppUsage({
    source: "antigravity_app",
    providerKind: "antigravity",
    appDir: antigravityAppDataDir(context.env, context.homeDir),
    homeDir: context.homeDir,
    message: "Antigravity local usage metadata is not available yet.",
  });
}

async function readLocalAppStatus(
  appDir: string,
  versionFiles: readonly string[],
  homeDir: string,
): Promise<LocalAiCliProviderStatus["cli"]> {
  try {
    const appStat = await stat(appDir);

    if (!appStat.isDirectory()) {
      return {
        state: "missing",
        version: null,
        detail: null,
      };
    }

    return {
      state: "installed",
      version: await readLocalAppVersion(appDir, versionFiles),
      detail: localPathHint(appDir, homeDir),
    };
  } catch {
    return {
      state: "missing",
      version: null,
      detail: null,
    };
  }
}

async function readLocalAppVersion(appDir: string, versionFiles: readonly string[]): Promise<string | null> {
  for (const fileName of versionFiles) {
    try {
      const content = await readFile(join(appDir, fileName), "utf8");
      const version = trimToNull(content.split(/\r?\n/, 1)[0]);

      if (version !== null) {
        return version;
      }
    } catch {
      // Version metadata is optional.
    }
  }

  return null;
}

function codexAppDataDir(env: Record<string, string | undefined>, homeDir: string): string {
  return trimToNull(env.MONEYSIREN_CODEX_APP_DATA_DIR) ??
    joinIfBase(env.APPDATA, "Codex", "web", "Codex") ??
    joinIfBase(env.USERPROFILE, "AppData", "Roaming", "Codex", "web", "Codex") ??
    join(homeDir, "Library", "Application Support", "Codex");
}

function claudeAppDataDir(env: Record<string, string | undefined>, homeDir: string): string {
  return trimToNull(env.MONEYSIREN_CLAUDE_APP_DATA_DIR) ??
    joinIfBase(env.APPDATA, "Claude") ??
    joinIfBase(env.USERPROFILE, "AppData", "Roaming", "Claude") ??
    join(homeDir, "Library", "Application Support", "Claude");
}

function antigravityAppDataDir(env: Record<string, string | undefined>, homeDir: string): string {
  return trimToNull(env.MONEYSIREN_ANTIGRAVITY_DATA_DIR) ??
    joinIfBase(env.APPDATA, "Antigravity") ??
    joinIfBase(env.USERPROFILE, "AppData", "Roaming", "Antigravity") ??
    join(homeDir, "Library", "Application Support", "Antigravity");
}

async function readCodexCliUsage(context: {
  env: Record<string, string | undefined>;
  homeDir: string;
  now: Date;
  allowCodexAppServerProbe: boolean;
}): Promise<LocalCliUsageSummary> {
  const sessionsRoot = trimToNull(context.env.MONEYSIREN_CODEX_SESSIONS_DIR) ??
    join(trimToNull(context.env.CODEX_HOME) ?? join(context.homeDir, ".codex"), "sessions");
  const result = await readJsonlUsageFiles({
    env: context.env,
    root: sessionsRoot,
    searchedPathHint: localPathHint(sessionsRoot, context.homeDir),
    now: context.now,
    providerKind: "codex",
    providerKey: "codex-cli",
    source: "codex_sessions",
    missingMessage: "Codex session logs were not found.",
    includeFile: async (path) => await detectCodexSessionSurface(path) !== "app",
  });

  return enrichCodexUsageWithAppServer(
    result.logFileCount === 0
      ? result
      : {
          ...result,
          message: "Codex CLI usage is estimated from local session status metadata.",
        },
    context,
  );
}

async function readCodexAppUsage(context: {
  env: Record<string, string | undefined>;
  homeDir: string;
  now: Date;
  allowCodexAppServerProbe: boolean;
}): Promise<LocalCliUsageSummary> {
  const sessionsRoot = trimToNull(context.env.MONEYSIREN_CODEX_APP_SESSIONS_DIR) ??
    trimToNull(context.env.MONEYSIREN_CODEX_SESSIONS_DIR) ??
    join(trimToNull(context.env.CODEX_HOME) ?? join(context.homeDir, ".codex"), "sessions");
  const appResult = await readJsonlUsageFiles({
    env: context.env,
    root: sessionsRoot,
    searchedPathHint: localPathHint(sessionsRoot, context.homeDir),
    now: context.now,
    providerKind: "codex",
    providerKey: "codex-app",
    source: "codex_app_sessions",
    missingMessage: "Codex App session logs were not found.",
    includeFile: async (path) => await detectCodexSessionSurface(path) === "app",
  });

  if (appResult.logFileCount > 0) {
    return enrichCodexUsageWithAppServer({
      ...appResult,
      message: "Codex App usage is estimated from local app session metadata.",
    }, context);
  }

  const sharedResult = await readJsonlUsageFiles({
    env: context.env,
    root: sessionsRoot,
    searchedPathHint: localPathHint(sessionsRoot, context.homeDir),
    now: context.now,
    providerKind: "codex",
    providerKey: "codex-app",
    source: "codex_app_sessions",
    missingMessage: "Codex App session logs were not found.",
  });

  return enrichCodexUsageWithAppServer(
    sharedResult.logFileCount === 0
      ? sharedResult
      : {
          ...sharedResult,
          message: "Codex App usage is estimated from shared local session metadata.",
        },
    context,
  );
}

async function enrichCodexUsageWithAppServer(
  usage: LocalCliUsageSummary,
  context: {
    env: Record<string, string | undefined>;
    homeDir: string;
    now: Date;
    allowCodexAppServerProbe: boolean;
  },
): Promise<LocalCliUsageSummary> {
  if (!context.allowCodexAppServerProbe) {
    return usage;
  }

  const childEnv = childProcessEnv(context.env);
  const codexOfficial = await readCodexAppServerMeasurements({
    read: async () => await readCodexAppServerOfficialMeasurements({
      now: () => context.now,
      spawnProcess: (_command, args) => spawnLocalCommand("codex", args, childEnv),
    }),
  });
  const appServerStatusLine = statusLineFromCodexOfficialMeasurements(
    codexOfficial,
    context,
  );
  const hasOfficialMeasurement =
    codexOfficial.rateLimits.availability === "available" ||
    codexOfficial.accountUsage.availability === "available";

  if (appServerStatusLine === null) {
    return {
      ...usage,
      codexOfficial,
      ...(hasOfficialMeasurement
        ? {
            message: usage.logFileCount === 0
              ? "Official Codex account measurements were read from local App Server; local session logs were not found."
              : `${usage.message} Official Codex account measurements were read from local App Server.`,
          }
        : {}),
    };
  }

  return {
    ...usage,
    codexOfficial,
    statusLine: finalizeStatusLineUsage(
      mergeStatusLineUsage(usage.statusLine, appServerStatusLine),
    ),
    message: usage.logFileCount === 0
      ? "Official Codex rate-limit metadata was read from local App Server; local session logs were not found."
      : `${usage.message} Official Codex rate-limit metadata was read from local App Server.`,
  };
}

function statusLineFromCodexOfficialMeasurements(
  measurements: CodexOfficialAccountMeasurements,
  context: {
    env: Record<string, string | undefined>;
    now: Date;
  },
): LocalCliStatusLineUsage | null {
  if (measurements.rateLimits.availability !== "available") {
    return null;
  }

  const accumulator = createUsageAccumulator(
    "codex",
    context.env,
    context.now,
    "codex-cli",
  );

  for (const window of [
    measurements.rateLimits.data.primary,
    measurements.rateLimits.data.secondary,
  ]) {
    if (window === null) {
      continue;
    }

    applyWindowedRateLimit({
      usedPercent: window.usedPercent,
      windowDurationMins: window.windowDurationMinutes,
      resetsAt: window.resetsAt,
    }, accumulator, null);
  }

  accumulator.statusLine.usageResetCredits =
    measurements.rateLimits.data.resetCredits?.details.map((detail) => ({
      label: detail.title,
      expiresAt: detail.expiresAt,
      isExact: true,
    })) ?? [];

  const statusLine = finalizeStatusLineUsage(accumulator.statusLine);
  const hasRateLimitMetadata = statusLine.fiveHourLimitPercent !== null ||
    statusLine.weeklyLimitPercent !== null ||
    statusLine.fiveHourResetAt !== null ||
    statusLine.weeklyResetAt !== null ||
    statusLine.usageResetCredits.length > 0;

  return hasRateLimitMetadata ? statusLine : null;
}

async function readCodexAppServerRateLimitStatus(context: {
  env: Record<string, string | undefined>;
  homeDir: string;
  now: Date;
}): Promise<LocalCliStatusLineUsage | null> {
  const cacheKey = JSON.stringify({
    codexHome: trimToNull(context.env.CODEX_HOME),
    homeDir: context.homeDir,
  });
  const cacheNow = context.now.getTime();

  if (codexAppServerRateLimitCache?.key === cacheKey && codexAppServerRateLimitCache.expiresAt > cacheNow) {
    return codexAppServerRateLimitCache.promise;
  }

  const promise = readCodexAppServerRateLimitStatusUncached(context)
    .catch(() => null);

  codexAppServerRateLimitCache = {
    expiresAt: cacheNow + CODEX_APP_SERVER_CACHE_MS,
    key: cacheKey,
    promise,
  };

  return promise;
}

function readCodexAppServerRateLimitStatusUncached(context: {
  env: Record<string, string | undefined>;
  homeDir: string;
  now: Date;
}): Promise<LocalCliStatusLineUsage | null> {
  return new Promise((resolve) => {
    const childEnv = childProcessEnv(context.env);
    const child = spawnLocalCommand("codex", ["app-server", "--stdio"], childEnv);
    let finished = false;
    let stdoutBuffer = "";

    const finish = (statusLine: LocalCliStatusLineUsage | null) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        // The process may have already exited.
      }
      resolve(statusLine);
    };

    const timer = setTimeout(() => finish(null), CODEX_APP_SERVER_TIMEOUT_MS);

    child.on("error", () => finish(null));
    child.on("close", () => finish(null));
    child.stderr.on("data", () => undefined);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      let newlineIndex = stdoutBuffer.indexOf("\n");

      while (newlineIndex >= 0) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

        if (line.length > 0) {
          try {
            const message = JSON.parse(line) as unknown;
            const record = asRecord(message);

            if (record?.id === 2) {
              const result = asRecord(record.result);
              if (result === null) {
                finish(null);
                return;
              }

              void statusLineFromCodexAppServerRateLimits(result, context)
                .then(finish)
                .catch(() => finish(null));
              return;
            }
          } catch {
            // Ignore non-JSON diagnostic lines without surfacing local details.
          }
        }

        newlineIndex = stdoutBuffer.indexOf("\n");
      }
    });

    const initialize = {
      method: "initialize",
      id: 1,
      params: {
        clientInfo: {
          name: "moneysiren",
          title: "MoneySiren",
          version: "0.1.0",
        },
      },
    };
    child.stdin.write(`${JSON.stringify(initialize)}\n`);
    child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
    child.stdin.write(`${JSON.stringify({ method: "account/rateLimits/read", id: 2 })}\n`);
  });
}

async function statusLineFromCodexAppServerRateLimits(
  response: Record<string, unknown>,
  context: {
    env: Record<string, string | undefined>;
    homeDir: string;
    now: Date;
  },
): Promise<LocalCliStatusLineUsage | null> {
  const accumulator = createUsageAccumulator("codex", context.env, context.now, "codex-cli");
  applyCodexAppServerRateLimits(response, accumulator);
  await applyCodexResetCreditObservationEstimates(response, accumulator, context);

  const statusLine = finalizeStatusLineUsage(accumulator.statusLine);
  const hasRateLimitMetadata = statusLine.fiveHourLimitPercent !== null ||
    statusLine.weeklyLimitPercent !== null ||
    statusLine.fiveHourResetAt !== null ||
    statusLine.weeklyResetAt !== null ||
    statusLine.usageResetCredits.length > 0;

  return hasRateLimitMetadata ? statusLine : null;
}

async function applyCodexResetCreditObservationEstimates(
  response: Record<string, unknown>,
  accumulator: UsageAccumulator,
  context: {
    env: Record<string, string | undefined>;
    homeDir: string;
    now: Date;
  },
): Promise<void> {
  const currentCount = readCodexResetCreditCount(response.rateLimitResetCredits ?? response.rate_limit_reset_credits);

  if (currentCount === null) {
    return;
  }

  const path = codexResetCreditObservationPath(context.env);
  const store = await readCodexResetCreditObservationStore(path);
  const nextStore = reconcileCodexResetCreditObservations(store, currentCount, context.now.toISOString(), {
    ttlDays: readConfiguredCodexResetCreditTtlDays(context.env),
  });
  await writeCodexResetCreditObservationStore(path, nextStore);

  const estimatedCredits = codexResetCreditsFromObservationStore(nextStore, currentCount);

  accumulator.statusLine.usageResetCredits = estimatedCredits;
}

function readCodexResetCreditCount(value: unknown): number | null {
  const record = asRecord(value);

  if (record === null) {
    return null;
  }

  const count = readNumber(record.availableCount ?? record.available_count);

  return count === null ? null : Math.max(0, Math.floor(count));
}

async function readCodexResetCreditObservationStore(path: string): Promise<CodexResetCreditObservationStore> {
  try {
    return parseCodexResetCreditObservationStore(JSON.parse(await readFile(path, "utf8")) as unknown);
  } catch {
    return emptyCodexResetCreditObservationStore();
  }
}

async function writeCodexResetCreditObservationStore(
  path: string,
  store: CodexResetCreditObservationStore,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function parseCodexResetCreditObservationStore(value: unknown): CodexResetCreditObservationStore {
  const record = asRecord(value);

  if (record === null) {
    return emptyCodexResetCreditObservationStore();
  }

  return {
    version: 1,
    updatedAtUtc: readIsoString(record.updatedAtUtc) ?? new Date(0).toISOString(),
    lastObservedAtUtc: readIsoString(record.lastObservedAtUtc),
    lastCount: readNonNegativeInteger(record.lastCount),
    observations: Array.isArray(record.observations)
      ? record.observations.flatMap(parseCodexResetCreditObservation)
      : [],
  };
}

function parseCodexResetCreditObservation(value: unknown): CodexResetCreditObservation[] {
  const record = asRecord(value);

  if (record === null) {
    return [];
  }

  const id = trimToNull(stringValue(record.id) ?? undefined);
  const previousCount = readNonNegativeInteger(record.previousCount);
  const currentCount = readNonNegativeInteger(record.currentCount);
  const observedFromUtc = readIsoString(record.observedFromUtc);
  const observedToUtc = readIsoString(record.observedToUtc);
  const status = parseCodexResetCreditObservationStatus(record.status);
  const removedAtUtc = readIsoString(record.removedAtUtc);

  if (id === null || previousCount === null || currentCount === null || observedFromUtc === null || observedToUtc === null || status === null) {
    return [];
  }

  return [{
    id,
    previousCount,
    currentCount,
    observedFromUtc,
    observedToUtc,
    estimatedEarliestExpiryUtc: readIsoString(record.estimatedEarliestExpiryUtc),
    estimatedLatestExpiryUtc: readIsoString(record.estimatedLatestExpiryUtc),
    status,
    isExact: false,
    ...(removedAtUtc === null ? {} : { removedAtUtc }),
  }];
}

function parseCodexResetCreditObservationStatus(value: unknown): CodexResetCreditObservationStatus | null {
  return value === "estimated" || value === "initial_existing" || value === "removed_unknown"
    ? value
    : null;
}

function emptyCodexResetCreditObservationStore(): CodexResetCreditObservationStore {
  return {
    version: 1,
    updatedAtUtc: new Date(0).toISOString(),
    lastObservedAtUtc: null,
    lastCount: null,
    observations: [],
  };
}

function codexResetCreditObservationPath(env: Record<string, string | undefined>): string {
  return trimToNull(env.MONEYSIREN_CODEX_RESET_CREDIT_OBSERVATIONS_PATH) ??
    join(process.cwd(), ".moneysiren", CODEX_RESET_CREDIT_OBSERVATION_FILE);
}

function readConfiguredCodexResetCreditTtlDays(env: Record<string, string | undefined>): number {
  return readPositiveNumber(env.MONEYSIREN_CODEX_RESET_CREDIT_TTL_DAYS) ?? CODEX_RESET_CREDIT_DEFAULT_TTL_DAYS;
}

function applyCodexAppServerRateLimits(response: Record<string, unknown>, accumulator: UsageAccumulator): void {
  const rateLimitsByLimitId = asRecord(response.rateLimitsByLimitId) ?? asRecord(response.rate_limits_by_limit_id);
  const codexRateLimits = asRecord(rateLimitsByLimitId?.codex) ??
    asRecord(response.rateLimits) ??
    asRecord(response.rate_limits);

  applyUsageResetCredits(
    response.rateLimitResetCredits ?? response.rate_limit_reset_credits,
    accumulator,
    null,
  );
  applyWindowedRateLimit(asRecord(codexRateLimits?.primary), accumulator, null);
  applyWindowedRateLimit(asRecord(codexRateLimits?.secondary), accumulator, null);
}

function mergeStatusLineUsage(
  localStatusLine: LocalCliStatusLineUsage,
  appServerStatusLine: LocalCliStatusLineUsage,
): LocalCliStatusLineUsage {
  const appServerHasRateLimitMetadata = appServerStatusLine.fiveHourLimitPercent !== null ||
    appServerStatusLine.fiveHourResetAt !== null ||
    appServerStatusLine.weeklyLimitPercent !== null ||
    appServerStatusLine.weeklyResetAt !== null ||
    appServerStatusLine.usageResetCredits.length > 0;

  return {
    ...localStatusLine,
    fiveHourLimitPercent: appServerStatusLine.fiveHourLimitPercent ?? localStatusLine.fiveHourLimitPercent,
    fiveHourResetAt: appServerStatusLine.fiveHourResetAt ?? localStatusLine.fiveHourResetAt,
    weeklyLimitPercent: appServerStatusLine.weeklyLimitPercent ?? localStatusLine.weeklyLimitPercent,
    weeklyResetAt: appServerStatusLine.weeklyResetAt ?? localStatusLine.weeklyResetAt,
    usageResetCredits: appServerHasRateLimitMetadata
      ? appServerStatusLine.usageResetCredits
      : localStatusLine.usageResetCredits,
  };
}

export function reconcileCodexResetCreditObservations(
  store: CodexResetCreditObservationStore,
  currentCount: number,
  observedAtUtc: string,
  options: {
    ttlDays?: number;
  } = {},
): CodexResetCreditObservationStore {
  const normalizedCurrentCount = Math.max(0, Math.floor(currentCount));
  const ttlDays = readPositiveNumber(options.ttlDays) ?? CODEX_RESET_CREDIT_DEFAULT_TTL_DAYS;
  const previousCount = store.lastCount;
  const observedFromUtc = store.lastObservedAtUtc ?? observedAtUtc;
  const observations = [...store.observations.map((observation) => ({ ...observation }))];

  if (previousCount === null) {
    for (let index = 0; index < normalizedCurrentCount; index += 1) {
      observations.push(createCodexResetCreditObservation({
        previousCount: normalizedCurrentCount,
        currentCount: normalizedCurrentCount,
        observedFromUtc: observedAtUtc,
        observedToUtc: observedAtUtc,
        estimatedEarliestExpiryUtc: null,
        estimatedLatestExpiryUtc: null,
        status: "initial_existing",
        index,
      }));
    }
  } else if (normalizedCurrentCount > previousCount) {
    const addedCount = normalizedCurrentCount - previousCount;
    const estimatedEarliestExpiryUtc = addDaysIso(observedFromUtc, ttlDays);
    const estimatedLatestExpiryUtc = addDaysIso(observedAtUtc, ttlDays);

    for (let index = 0; index < addedCount; index += 1) {
      observations.push(createCodexResetCreditObservation({
        previousCount,
        currentCount: normalizedCurrentCount,
        observedFromUtc,
        observedToUtc: observedAtUtc,
        estimatedEarliestExpiryUtc,
        estimatedLatestExpiryUtc,
        status: "estimated",
        index,
      }));
    }
  } else if (normalizedCurrentCount < previousCount) {
    const removedCount = previousCount - normalizedCurrentCount;
    const removable = activeCodexResetCreditObservations(observations)
      .sort(compareCodexResetCreditObservationsForRemoval)
      .slice(0, removedCount);
    const removableIds = new Set(removable.map((observation) => observation.id));

    for (const observation of observations) {
      if (removableIds.has(observation.id)) {
        observation.status = "removed_unknown";
        observation.removedAtUtc = observedAtUtc;
      }
    }
  }

  return {
    version: 1,
    updatedAtUtc: observedAtUtc,
    lastObservedAtUtc: observedAtUtc,
    lastCount: normalizedCurrentCount,
    observations: observations.slice(-500),
  };
}

function activeCodexResetCreditObservations(
  observations: readonly CodexResetCreditObservation[],
): CodexResetCreditObservation[] {
  return observations
    .filter((observation) => observation.status !== "removed_unknown")
    .map((observation) => ({ ...observation }));
}

function codexResetCreditsFromObservationStore(
  store: CodexResetCreditObservationStore,
  currentCount: number,
): LocalCliUsageResetCredit[] {
  const active = activeCodexResetCreditObservations(store.observations)
    .sort(compareCodexResetCreditObservationsForDisplay)
    .slice(0, Math.max(0, Math.floor(currentCount)));

  return active.map((observation) => ({
    label: observation.status === "estimated" ? "estimated" : null,
    expiresAt: observation.estimatedEarliestExpiryUtc,
    estimatedEarliestExpiryUtc: observation.estimatedEarliestExpiryUtc,
    estimatedLatestExpiryUtc: observation.estimatedLatestExpiryUtc,
    observedFromUtc: observation.observedFromUtc,
    observedToUtc: observation.observedToUtc,
    status: observation.status,
    isExact: false,
  }));
}

function createCodexResetCreditObservation(options: {
  previousCount: number;
  currentCount: number;
  observedFromUtc: string;
  observedToUtc: string;
  estimatedEarliestExpiryUtc: string | null;
  estimatedLatestExpiryUtc: string | null;
  status: CodexResetCreditObservationStatus;
  index: number;
}): CodexResetCreditObservation {
  return {
    id: [
      "codex-reset-credit",
      options.status,
      options.observedFromUtc,
      options.observedToUtc,
      String(options.previousCount),
      String(options.currentCount),
      String(options.index),
    ].join(":"),
    previousCount: options.previousCount,
    currentCount: options.currentCount,
    observedFromUtc: options.observedFromUtc,
    observedToUtc: options.observedToUtc,
    estimatedEarliestExpiryUtc: options.estimatedEarliestExpiryUtc,
    estimatedLatestExpiryUtc: options.estimatedLatestExpiryUtc,
    status: options.status,
    isExact: false,
  };
}

function compareCodexResetCreditObservationsForDisplay(
  left: CodexResetCreditObservation,
  right: CodexResetCreditObservation,
): number {
  return compareNullableIso(left.estimatedEarliestExpiryUtc, right.estimatedEarliestExpiryUtc) ||
    left.observedToUtc.localeCompare(right.observedToUtc);
}

function compareCodexResetCreditObservationsForRemoval(
  left: CodexResetCreditObservation,
  right: CodexResetCreditObservation,
): number {
  return compareNullableIso(left.estimatedEarliestExpiryUtc, right.estimatedEarliestExpiryUtc) ||
    left.observedToUtc.localeCompare(right.observedToUtc);
}

function compareNullableIso(left: string | null, right: string | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}

function addDaysIso(value: string, days: number): string {
  const timestamp = Date.parse(value);
  const base = Number.isFinite(timestamp) ? timestamp : Date.now();

  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

function readPositiveNumber(value: unknown): number | null {
  const numberValue = readNumber(value);

  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

async function readClaudeCliUsage(context: {
  env: Record<string, string | undefined>;
  homeDir: string;
  now: Date;
}): Promise<LocalCliUsageSummary> {
  const claudeHome = trimToNull(context.env.CLAUDE_CONFIG_DIR) ?? join(context.homeDir, ".claude");
  const projectsRoot = join(claudeHome, "projects");
  const result = await readJsonlUsageFiles({
    env: context.env,
    root: projectsRoot,
    searchedPathHint: localPathHint(projectsRoot, context.homeDir),
    now: context.now,
    providerKind: "claude",
    providerKey: "claude-cli",
    source: "claude_projects",
    missingMessage: "Claude Code project logs were not found.",
  });

  return result.logFileCount === 0
    ? result
    : {
        ...result,
        message: "Claude CLI usage is estimated from local project logs.",
      };
}

async function readClaudeAppUsage(context: {
  env: Record<string, string | undefined>;
  homeDir: string;
  now: Date;
}): Promise<LocalCliUsageSummary> {
  const appProjectsRoot = trimToNull(context.env.MONEYSIREN_CLAUDE_APP_PROJECTS_DIR) ??
    join(claudeAppDataDir(context.env, context.homeDir), "projects");
  const appResult = await readJsonlUsageFiles({
    env: context.env,
    root: appProjectsRoot,
    searchedPathHint: localPathHint(appProjectsRoot, context.homeDir),
    now: context.now,
    providerKind: "claude",
    providerKey: "claude-app",
    source: "claude_app",
    missingMessage: "Claude App project logs were not found.",
  });

  if (appResult.logFileCount > 0) {
    return {
      ...appResult,
      message: "Claude App usage is estimated from local app project logs.",
    };
  }

  const claudeHome = trimToNull(context.env.CLAUDE_CONFIG_DIR) ?? join(context.homeDir, ".claude");
  const sharedProjectsRoot = join(claudeHome, "projects");
  const sharedResult = await readJsonlUsageFiles({
    env: context.env,
    root: sharedProjectsRoot,
    searchedPathHint: localPathHint(sharedProjectsRoot, context.homeDir),
    now: context.now,
    providerKind: "claude",
    providerKey: "claude-app",
    source: "claude_app",
    missingMessage: "Claude App project logs were not found.",
  });

  return sharedResult.logFileCount === 0
    ? sharedResult
    : {
        ...sharedResult,
        message: "Claude App usage is estimated from shared local project logs.",
      };
}

async function readLocalAppUsage(options: {
  source: LocalCliUsageSummary["source"];
  providerKind: LocalCliUsageSummary["providerKind"];
  appDir: string;
  homeDir: string;
  message: string;
}): Promise<LocalCliUsageSummary> {
  try {
    const appStat = await stat(options.appDir);

    if (appStat.isDirectory()) {
      return emptyLocalCliUsage(
        options.source,
        options.providerKind,
        options.message,
        localPathHint(options.appDir, options.homeDir),
      );
    }
  } catch {
    // Missing app data is represented as a no-usage local provider.
  }

  return emptyLocalCliUsage(
    options.source,
    options.providerKind,
    "Local app data was not found.",
    localPathHint(options.appDir, options.homeDir),
  );
}

async function readJsonlUsageFiles(options: {
  env: Record<string, string | undefined>;
  root: string;
  searchedPathHint: string;
  now: Date;
  providerKind: LocalCliUsageSummary["providerKind"];
  providerKey?: LocalAiCliProviderKey;
  source: LocalCliUsageSummary["source"];
  missingMessage: string;
  includeFile?: (path: string) => Promise<boolean>;
}): Promise<LocalCliUsageSummary> {
  const periodStart = new Date(Date.UTC(options.now.getUTCFullYear(), options.now.getUTCMonth(), 1));
  const files = (await listJsonlFiles(options.root, periodStart))
    .sort((left, right) => right.modifiedAt.getTime() - left.modifiedAt.getTime())
    .slice(0, MAX_LOCAL_USAGE_FILES);
  const accumulator = createUsageAccumulator(options.providerKind, options.env, options.now, options.providerKey);

  for (const file of files) {
    if (options.includeFile !== undefined && !(await options.includeFile(file.path))) {
      continue;
    }

    accumulator.logFileCount += 1;
    accumulator.sessionIds.add(file.path);
    accumulator.latestActivityAt = latestIsoValue(accumulator.latestActivityAt, file.modifiedAt.toISOString());
    await readJsonlUsageFile(file.path, accumulator);
  }

  if (accumulator.logFileCount === 0) {
    return emptyLocalCliUsage(
      options.source,
      options.providerKind,
      options.missingMessage,
      options.searchedPathHint,
      finalizeStatusLineUsage(accumulator.statusLine),
    );
  }

  return {
    source: options.source,
    period: "current_month",
    providerKind: options.providerKind,
    sessionCount: accumulator.sessionIds.size,
    turnCount: accumulator.turnIds.size,
    toolCallCount: accumulator.toolCallCount,
    inputTokens: accumulator.inputTokens === 0 ? null : accumulator.inputTokens,
    outputTokens: accumulator.outputTokens === 0 ? null : accumulator.outputTokens,
    cacheTokens: accumulator.cacheTokens === 0 ? null : accumulator.cacheTokens,
    totalTokens: accumulator.totalTokens === 0 ? null : accumulator.totalTokens,
    reasoningOutputTokens: accumulator.reasoningOutputTokens === 0 ? null : accumulator.reasoningOutputTokens,
    logFileCount: accumulator.logFileCount,
    parsedUsageRecordCount: accumulator.parsedUsageRecordCount,
    searchedPathHint: options.searchedPathHint,
    latestActivityAt: accumulator.latestActivityAt,
    topModels: topEntries(accumulator.models),
    statusLine: finalizeStatusLineUsage(accumulator.statusLine),
    message: "Local CLI usage was estimated from local logs.",
  };
}

async function detectCodexSessionSurface(path: string): Promise<"app" | "cli" | "unknown"> {
  let content = "";

  try {
    content = await readFile(path, "utf8");
  } catch {
    return "unknown";
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    try {
      const value = JSON.parse(trimmed) as unknown;
      const record = asRecord(value);
      const payload = asRecord(record?.payload);
      const originator = stringValue(payload?.originator ?? record?.originator)?.toLowerCase() ?? "";
      const source = stringValue(payload?.source ?? record?.source)?.toLowerCase() ?? "";

      if (originator.includes("desktop") || originator.includes("app")) {
        return "app";
      }

      if (originator.includes("cli") || source === "cli") {
        return "cli";
      }
    } catch {
      // Some local session files include non-JSON control lines; skip them without exposing content.
    }
  }

  return "unknown";
}

async function readJsonlUsageFile(path: string, accumulator: UsageAccumulator): Promise<void> {
  let content = "";

  try {
    content = await readFile(path, "utf8");
  } catch {
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    try {
      const value = JSON.parse(trimmed) as unknown;
      accumulator.parsedUsageRecordCount += 1;
      accumulateRollingUsageFromValue(value, accumulator);
      accumulateLimitMetadataFromValue(value, accumulator);
      accumulateUsageFromValue(value, accumulator);
    } catch {
      // Some local session files include non-JSON control lines; skip them without exposing content.
    }
  }
}

function accumulateRollingUsageFromValue(value: unknown, accumulator: UsageAccumulator): void {
  const occurredAt = readTimestamp(value);
  const tokenTotal = readRollingTokenTotal(value);

  if (occurredAt === null || tokenTotal === null || tokenTotal <= 0) {
    return;
  }

  const occurredAtTime = occurredAt.getTime();

  if (occurredAtTime >= accumulator.fiveHourWindowStart.getTime()) {
    accumulator.statusLine.fiveHourUsedTokens = (accumulator.statusLine.fiveHourUsedTokens ?? 0) + tokenTotal;
  }

  if (occurredAtTime >= accumulator.weeklyWindowStart.getTime()) {
    accumulator.statusLine.weeklyUsedTokens = (accumulator.statusLine.weeklyUsedTokens ?? 0) + tokenTotal;
  }
}

function accumulateUsageFromValue(value: unknown, accumulator: UsageAccumulator, insideUsage = false): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      accumulateUsageFromValue(item, accumulator, insideUsage);
    }
    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;
  accumulateStatusLineUsage(record, accumulator);
  const model = typeof record.model === "string"
    ? record.model
    : typeof record.model_slug === "string"
      ? record.model_slug
      : null;

  if (model !== null && model.trim().length > 0) {
    increment(accumulator.models, model.trim());
  }

  const turnId = typeof record.turn_id === "string"
    ? record.turn_id
    : typeof record.requestId === "string"
      ? record.requestId
      : null;

  if (turnId !== null && turnId.trim().length > 0) {
    accumulator.turnIds.add(turnId);
  }

  const type = typeof record.type === "string" ? record.type : "";

  if (type === "assistant" || type === "turn_context") {
    const sessionId = typeof record.sessionId === "string"
      ? record.sessionId
      : typeof record.session_id === "string"
        ? record.session_id
        : null;

    if (sessionId !== null) {
      accumulator.turnIds.add(`${type}:${sessionId}:${accumulator.turnIds.size}`);
    }
  }

  if (
    type === "tool_use" ||
    type === "function_call" ||
    (typeof record.call_id === "string" && typeof record.name === "string")
  ) {
    accumulator.toolCallCount += 1;
  }

  for (const [key, nested] of Object.entries(record)) {
    if (insideUsage && typeof nested === "number" && Number.isFinite(nested)) {
      accumulateTokenMetric(key, nested, accumulator);
    }

    accumulateUsageFromValue(nested, accumulator, insideUsage || isUsageContainerKey(key));
  }
}

function isUsageContainerKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return normalizedKey === "usage" || normalizedKey === "token_usage";
}

function accumulateTokenMetric(key: string, value: number, accumulator: UsageAccumulator): void {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "input_tokens" || normalizedKey === "prompt_tokens") {
    accumulator.inputTokens += value;
    accumulator.totalTokens += value;
    return;
  }

  if (normalizedKey === "output_tokens" || normalizedKey === "completion_tokens") {
    accumulator.outputTokens += value;
    accumulator.totalTokens += value;
    return;
  }

  if (normalizedKey === "total_tokens") {
    accumulator.totalTokens += value;
    return;
  }

  if (normalizedKey === "reasoning_output_tokens") {
    accumulator.reasoningOutputTokens += value;
    return;
  }

  if (normalizedKey.includes("cache") && normalizedKey.endsWith("tokens")) {
    accumulator.cacheTokens += value;
    accumulator.totalTokens += value;
  }
}

function accumulateStatusLineUsage(record: Record<string, unknown>, accumulator: UsageAccumulator): void {
  const payload = asRecord(record.payload);
  const info = asRecord(payload?.info);
  const codexLastUsage = asRecord(info?.last_token_usage);
  const codexTotalUsage = asRecord(info?.total_token_usage);
  const codexContextWindow = readNumber(info?.model_context_window) ?? readNumber(payload?.model_context_window);

  if (codexLastUsage !== null || codexTotalUsage !== null || codexContextWindow !== null) {
    applyTokenUsageToStatusLine(codexLastUsage, "last", accumulator.statusLine);
    applyTokenUsageToStatusLine(codexTotalUsage, "total", accumulator.statusLine);

    if (codexContextWindow !== null) {
      accumulator.statusLine.contextWindowLimit = codexContextWindow;
    }

    if (accumulator.statusLine.lastInputTokens !== null) {
      accumulator.statusLine.contextWindowTokens = accumulator.statusLine.lastInputTokens;
    }

    accumulator.statusLine.contextWindowPercent = percentOf(
      accumulator.statusLine.contextWindowTokens,
      accumulator.statusLine.contextWindowLimit,
    );
  }

  const claudeContextWindow = asRecord(record.context_window) ?? asRecord(payload?.context_window);
  const claudeCurrentUsage = asRecord(claudeContextWindow?.current_usage);
  const claudeContextLimit = readNumber(claudeContextWindow?.max_tokens) ??
    readNumber(claudeContextWindow?.limit) ??
    readNumber(claudeContextWindow?.total);

  if (claudeCurrentUsage !== null || claudeContextLimit !== null) {
    applyTokenUsageToStatusLine(claudeCurrentUsage, "last", accumulator.statusLine);
    const contextTokens = sumNumbers([
      readNumber(claudeCurrentUsage?.input_tokens),
      readNumber(claudeCurrentUsage?.cache_creation_input_tokens),
      readNumber(claudeCurrentUsage?.cache_read_input_tokens),
      readNumber(claudeCurrentUsage?.cached_input_tokens),
    ]);

    accumulator.statusLine.contextWindowTokens = contextTokens === 0 ? accumulator.statusLine.contextWindowTokens : contextTokens;
    accumulator.statusLine.contextWindowLimit = claudeContextLimit ?? accumulator.statusLine.contextWindowLimit;
    accumulator.statusLine.contextWindowPercent = percentOf(
      accumulator.statusLine.contextWindowTokens,
      accumulator.statusLine.contextWindowLimit,
    );
  }

  const message = asRecord(record.message);
  const recordType = typeof record.type === "string" ? record.type : "";
  const messageUsage = asRecord(message?.usage) ?? (recordType === "assistant" ? asRecord(record.usage) : null);

  if (messageUsage !== null) {
    applyTokenUsageToStatusLine(messageUsage, "last", accumulator.statusLine);
    addTokenUsageToStatusLineTotals(messageUsage, accumulator.statusLine);
  }

}

function applyTokenUsageToStatusLine(
  usage: Record<string, unknown> | null,
  scope: "last" | "total",
  statusLine: MutableLocalCliStatusLineUsage,
): void {
  if (usage === null) {
    return;
  }

  const inputTokens = readNumber(usage.input_tokens) ?? readNumber(usage.prompt_tokens);
  const outputTokens = readNumber(usage.output_tokens) ?? readNumber(usage.completion_tokens);
  const cacheTokens = readCacheTokens(usage);
  const reasoningTokens = readNumber(usage.reasoning_output_tokens);
  const explicitTotalTokens = readNumber(usage.total_tokens);
  const totalTokens = explicitTotalTokens ?? sumNumbers([inputTokens, outputTokens, cacheTokens, reasoningTokens]);

  if (scope === "last") {
    statusLine.lastInputTokens = inputTokens ?? statusLine.lastInputTokens;
    statusLine.lastOutputTokens = outputTokens ?? statusLine.lastOutputTokens;
    statusLine.lastCacheTokens = cacheTokens ?? statusLine.lastCacheTokens;
    statusLine.lastReasoningTokens = reasoningTokens ?? statusLine.lastReasoningTokens;
    statusLine.lastTotalTokens = totalTokens === 0 ? statusLine.lastTotalTokens : totalTokens;
    return;
  }

  statusLine.totalInputTokens = inputTokens ?? statusLine.totalInputTokens;
  statusLine.totalOutputTokens = outputTokens ?? statusLine.totalOutputTokens;
  statusLine.totalCacheTokens = cacheTokens ?? statusLine.totalCacheTokens;
  statusLine.totalReasoningTokens = reasoningTokens ?? statusLine.totalReasoningTokens;
  statusLine.totalTokens = totalTokens === 0 ? statusLine.totalTokens : totalTokens;
}

function addTokenUsageToStatusLineTotals(
  usage: Record<string, unknown>,
  statusLine: MutableLocalCliStatusLineUsage,
): void {
  statusLine.totalInputTokens = addNullable(statusLine.totalInputTokens, readNumber(usage.input_tokens) ?? readNumber(usage.prompt_tokens));
  statusLine.totalOutputTokens = addNullable(statusLine.totalOutputTokens, readNumber(usage.output_tokens) ?? readNumber(usage.completion_tokens));
  statusLine.totalCacheTokens = addNullable(statusLine.totalCacheTokens, readCacheTokens(usage));
  statusLine.totalReasoningTokens = addNullable(statusLine.totalReasoningTokens, readNumber(usage.reasoning_output_tokens));
  statusLine.totalTokens = addNullable(statusLine.totalTokens, readNumber(usage.total_tokens));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(/,/g, "");

  if (normalizedValue.length === 0) {
    return null;
  }

  const numberValue = Number(normalizedValue);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  const numberValue = readNumber(value);

  return numberValue === null || numberValue < 0 ? null : Math.floor(numberValue);
}

function readIsoString(value: unknown): string | null {
  const date = readTimestampValue(value);

  return date === null ? null : date.toISOString();
}

function readCacheTokens(usage: Record<string, unknown>): number | null {
  const total = sumNumbers([
    readNumber(usage.cached_input_tokens),
    readNumber(usage.cache_creation_input_tokens),
    readNumber(usage.cache_read_input_tokens),
    readNumber(usage.cache_tokens),
  ]);

  return total === 0 ? null : total;
}

function sumNumbers(values: ReadonlyArray<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function addNullable(left: number | null, right: number | null): number | null {
  if (right === null) {
    return left;
  }

  return (left ?? 0) + right;
}

function percentOf(value: number | null, limit: number | null): number | null {
  if (value === null || limit === null || limit <= 0) {
    return null;
  }

  return Math.round((value / limit) * 10_000) / 100;
}

function readTimestamp(value: unknown): Date | null {
  const record = asRecord(value);

  if (record === null) {
    return null;
  }

  const directTimestamp = readTimestampValue(
    record.timestamp ??
      record.created_at ??
      record.createdAt ??
      record.time ??
      record.ts ??
      record.datetime,
  );

  if (directTimestamp !== null) {
    return directTimestamp;
  }

  const payload = asRecord(record.payload);
  const payloadTimestamp = readTimestampValue(
    payload?.timestamp ??
      payload?.created_at ??
      payload?.createdAt ??
      payload?.time ??
      payload?.ts ??
      payload?.datetime,
  );

  if (payloadTimestamp !== null) {
    return payloadTimestamp;
  }

  const message = asRecord(record.message);

  return readTimestampValue(
    message?.timestamp ??
      message?.created_at ??
      message?.createdAt ??
      message?.time ??
      message?.ts ??
      message?.datetime,
  );
}

function readTimestampValue(value: unknown): Date | null {
  if (typeof value === "string") {
    const timestamp = Date.parse(value);

    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  const numericValue = readNumber(value);

  if (numericValue === null || numericValue <= 0) {
    return null;
  }

  const timestamp = numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
  const date = new Date(timestamp);

  return Number.isFinite(date.getTime()) ? date : null;
}

function readRollingTokenTotal(value: unknown): number | null {
  const record = asRecord(value);

  if (record === null) {
    return null;
  }

  const payload = asRecord(record.payload);
  const payloadInfo = asRecord(payload?.info);
  const message = asRecord(record.message);
  const recordType = typeof record.type === "string" ? record.type : "";
  const payloadType = typeof payload?.type === "string" ? payload.type : "";
  const usageCandidates = [
    asRecord(payloadInfo?.last_token_usage),
    asRecord(message?.usage),
    recordType === "assistant" || recordType === "response_item" || recordType === "turn_context" ? asRecord(record.usage) : null,
    payloadType === "function_call" || payloadType === "response" || payloadType === "message" ? asRecord(payload?.usage) : null,
    asRecord(record.token_usage),
    asRecord(payload?.token_usage),
  ];

  for (const usage of usageCandidates) {
    const total = tokenTotalFromUsage(usage);

    if (total !== null && total > 0) {
      return total;
    }
  }

  return null;
}

function tokenTotalFromUsage(usage: Record<string, unknown> | null): number | null {
  if (usage === null) {
    return null;
  }

  const explicitTotal = readNumber(usage.total_tokens);

  if (explicitTotal !== null && explicitTotal > 0) {
    return explicitTotal;
  }

  const total = sumNumbers([
    readNumber(usage.input_tokens) ?? readNumber(usage.prompt_tokens),
    readNumber(usage.output_tokens) ?? readNumber(usage.completion_tokens),
    readCacheTokens(usage),
    readNumber(usage.reasoning_output_tokens),
  ]);

  return total === 0 ? null : total;
}

function accumulateLimitMetadataFromValue(value: unknown, accumulator: UsageAccumulator): void {
  const record = asRecord(value);

  if (record !== null) {
    const observedAt = readTimestamp(value)?.getTime() ?? null;
    applyWindowedRateLimits(record, accumulator, observedAt);
    accumulateLimitMetadata(record, accumulator, observedAt);
  }
}

function applyWindowedRateLimits(
  record: Record<string, unknown>,
  accumulator: UsageAccumulator,
  observedAt: number | null,
): void {
  const payload = asRecord(record.payload);
  const result = asRecord(record.result);
  const payloadResult = asRecord(payload?.result);
  const rateLimits = asRecord(payload?.rate_limits) ??
    asRecord(payload?.rateLimits) ??
    asRecord(payloadResult?.rate_limits) ??
    asRecord(payloadResult?.rateLimits) ??
    asRecord(result?.rate_limits) ??
    asRecord(result?.rateLimits) ??
    asRecord(record.rate_limits) ??
    asRecord(record.rateLimits);

  if (rateLimits === null) {
    applyUsageResetCredits(
      payload?.rate_limit_reset_credits ??
        payload?.rateLimitResetCredits ??
        payloadResult?.rate_limit_reset_credits ??
        payloadResult?.rateLimitResetCredits ??
        result?.rate_limit_reset_credits ??
        result?.rateLimitResetCredits ??
        record.rate_limit_reset_credits ??
        record.rateLimitResetCredits,
      accumulator,
      observedAt,
    );
    return;
  }

  applyUsageResetCredits(
    rateLimits.credits ??
      rateLimits.reset_credits ??
      rateLimits.resetCredits ??
      rateLimits.usage_reset_credits ??
      rateLimits.usageResetCredits ??
      payload?.rate_limit_reset_credits ??
      payload?.rateLimitResetCredits ??
      payloadResult?.rate_limit_reset_credits ??
      payloadResult?.rateLimitResetCredits ??
      result?.rate_limit_reset_credits ??
      result?.rateLimitResetCredits ??
      record.rate_limit_reset_credits ??
      record.rateLimitResetCredits,
    accumulator,
    observedAt,
  );
  applyWindowedRateLimit(asRecord(rateLimits.primary), accumulator, observedAt);
  applyWindowedRateLimit(asRecord(rateLimits.secondary), accumulator, observedAt);
}

function applyUsageResetCredits(
  value: unknown,
  accumulator: UsageAccumulator,
  observedAt: number | null,
): void {
  const credits = readUsageResetCredits(value);

  if (credits.length === 0 || !shouldApplyUsageResetCreditMetadata(accumulator, observedAt)) {
    return;
  }

  accumulator.statusLine.usageResetCredits = credits;
  noteUsageResetCreditMetadata(accumulator, observedAt);
}

function readUsageResetCredits(value: unknown, depth = 0): LocalCliUsageResetCredit[] {
  if (value === null || value === undefined || depth > 3) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => readUsageResetCreditItem(item, depth + 1));
  }

  const record = asRecord(value);

  if (record === null) {
    return [];
  }

  const nestedCredits = [
    record.items,
    record.credits,
    record.reset_credits,
    record.resetCredits,
    record.grants,
    record.entitlements,
  ].flatMap((item) => readUsageResetCredits(item, depth + 1));

  if (nestedCredits.length > 0) {
    return nestedCredits;
  }

  if (readBoolean(record.unlimited) === true || readBoolean(record.has_credits) === false || readBoolean(record.hasCredits) === false) {
    return [];
  }

  const count = Math.floor(readNumber(
    record.available_count ??
      record.availableCount ??
      record.count ??
      record.quantity ??
      record.balance ??
      record.remaining ??
      record.available,
  ) ?? 0);
  const expiresAt = readUsageResetCreditExpiry(record);

  if (count <= 0) {
    return [];
  }

  return Array.from({ length: count }, () => ({
    label: readUsageResetCreditLabel(record),
    expiresAt,
  }));
}

function readUsageResetCreditItem(value: unknown, depth: number): LocalCliUsageResetCredit[] {
  const record = asRecord(value);

  if (record === null) {
    return readUsageResetCredits(value, depth);
  }

  if (
    readBoolean(record.used) === true ||
    readBoolean(record.consumed) === true ||
    readBoolean(record.available) === false ||
    readBoolean(record.active) === false
  ) {
    return [];
  }

  const nested = readUsageResetCredits(value, depth);

  if (nested.length > 0) {
    return nested;
  }

  return [{
    label: readUsageResetCreditLabel(record),
    expiresAt: readUsageResetCreditExpiry(record),
  }];
}

function readUsageResetCreditLabel(record: Record<string, unknown>): string | null {
  return trimToNull(stringValue(record.label ?? record.name ?? record.type ?? record.id) ?? undefined);
}

function readUsageResetCreditExpiry(record: Record<string, unknown>): string | null {
  const expiresAt = readTimestampValue(
    record.expires_at ??
      record.expiresAt ??
      record.expiration_at ??
      record.expirationAt ??
      record.valid_until ??
      record.validUntil ??
      record.expires_on ??
      record.expiresOn,
  );

  return expiresAt === null ? null : expiresAt.toISOString();
}

function shouldApplyUsageResetCreditMetadata(
  accumulator: UsageAccumulator,
  observedAt: number | null,
): boolean {
  if (observedAt === null) {
    return true;
  }

  return accumulator.usageResetCreditMetadataObservedAt === null ||
    observedAt >= accumulator.usageResetCreditMetadataObservedAt;
}

function noteUsageResetCreditMetadata(accumulator: UsageAccumulator, observedAt: number | null): void {
  if (observedAt !== null) {
    accumulator.usageResetCreditMetadataObservedAt = observedAt;
  }
}

function applyWindowedRateLimit(
  rateLimit: Record<string, unknown> | null,
  accumulator: UsageAccumulator,
  observedAt: number | null,
): void {
  if (rateLimit === null) {
    return;
  }

  const window = usageLimitWindowFromMinutes(readNumber(
    rateLimit.window_minutes ??
      rateLimit.windowMinutes ??
      rateLimit.window_duration_mins ??
      rateLimit.windowDurationMins,
  ));

  if (window === null) {
    return;
  }

  const usedPercent = readNumber(
    rateLimit.used_percent ??
      rateLimit.usedPercent ??
      rateLimit.used_percentage ??
      rateLimit.percent ??
      rateLimit.percentage,
  );
  const remainingPercent = readNumber(
    rateLimit.remaining_percent ??
      rateLimit.remainingPercent ??
      rateLimit.remaining_percentage ??
      rateLimit.percent_remaining ??
      rateLimit.percentRemaining ??
      rateLimit.percentage_remaining ??
      rateLimit.left_percent ??
      rateLimit.left_percentage,
  );

  if (usedPercent !== null && usedPercent >= 0) {
    setUsageLimitPercent(accumulator, window, usedPercent, observedAt);
  } else if (remainingPercent !== null && remainingPercent >= 0) {
    setUsageLimitPercent(accumulator, window, usedPercentFromRemainingPercent(remainingPercent), observedAt);
  }

  const resetAt = readTimestampValue(
    rateLimit.resets_at ??
      rateLimit.resetsAt ??
      rateLimit.reset_at ??
      rateLimit.resetAt,
  );

  if (resetAt !== null) {
    setUsageLimitResetAt(accumulator, window, resetAt.toISOString(), observedAt);
  }
}

function usageLimitWindowFromMinutes(minutes: number | null): "fiveHour" | "weekly" | null {
  if (minutes === 300) {
    return "fiveHour";
  }

  if (minutes === 10_080) {
    return "weekly";
  }

  return null;
}

function accumulateLimitMetadata(
  record: Record<string, unknown>,
  accumulator: UsageAccumulator,
  observedAt: number | null,
  path: readonly string[] = [],
): void {
  for (const [key, nested] of Object.entries(record)) {
    const nextPath = [...path, key];
    const window = usageLimitWindowFromPath(nextPath);

    if (window !== null) {
      applyUsageLimitMetadata(nextPath, nested, window, accumulator, observedAt);
    }

    const nestedRecord = asRecord(nested);

    if (nestedRecord !== null) {
      accumulateLimitMetadata(nestedRecord, accumulator, observedAt, nextPath);
    }
  }
}

function usageLimitWindowFromPath(path: readonly string[]): "fiveHour" | "weekly" | null {
  const normalizedPath = path.map((item) => item.toLowerCase()).join(".");

  if (
    normalizedPath.includes("five_hour") ||
    normalizedPath.includes("fivehour") ||
    normalizedPath.includes("5_hour") ||
    normalizedPath.includes("5hour") ||
    normalizedPath.includes("5h") ||
    normalizedPath.includes("five.hour") ||
    (normalizedPath.includes("five") && normalizedPath.includes("hour"))
  ) {
    return "fiveHour";
  }

  if (
    normalizedPath.includes("weekly") ||
    normalizedPath.includes("week") ||
    normalizedPath.includes("seven_day") ||
    normalizedPath.includes("sevenday") ||
    normalizedPath.includes("seven.day") ||
    normalizedPath.includes("7_day") ||
    normalizedPath.includes("7day")
  ) {
    return "weekly";
  }

  return null;
}

function applyUsageLimitMetadata(
  path: readonly string[],
  value: unknown,
  window: "fiveHour" | "weekly",
  accumulator: UsageAccumulator,
  observedAt: number | null,
): void {
  const normalizedPath = path.map((item) => item.toLowerCase()).join(".");
  const leafKey = path[path.length - 1]?.toLowerCase() ?? "";
  const numericValue = readNumber(value);

  if (numericValue !== null && numericValue >= 0) {
    const hasTokenHint = leafKey.includes("token") || normalizedPath.includes("token");

    if (
      leafKey.includes("percent") ||
      leafKey.includes("percentage") ||
      leafKey.includes("pct")
    ) {
      setUsageLimitPercent(
        accumulator,
        window,
        isRemainingUsageLimitPercentPath(normalizedPath, leafKey)
          ? usedPercentFromRemainingPercent(numericValue)
          : numericValue,
        observedAt,
      );
      return;
    }

    if (
      hasTokenHint &&
      (
        leafKey.includes("limit") ||
        leafKey.includes("quota") ||
        leafKey.includes("max")
      )
    ) {
      setUsageLimitTokenLimit(accumulator.statusLine, window, numericValue);
      return;
    }

    if (
      hasTokenHint &&
      (
        leafKey.includes("used") ||
        leafKey.includes("usage") ||
        leafKey.includes("current") ||
        leafKey.includes("consumed")
      )
    ) {
      setUsageLimitTokenUsage(accumulator, window, numericValue, observedAt);
    }
  }

  if (typeof value === "string" && leafKey.includes("reset")) {
    const resetAt = readTimestampValue(value);

    if (resetAt !== null) {
      setUsageLimitResetAt(accumulator, window, resetAt.toISOString(), observedAt);
    }
  }
}

function setUsageLimitPercent(
  accumulator: UsageAccumulator,
  window: "fiveHour" | "weekly",
  value: number,
  observedAt: number | null,
): void {
  if (!shouldApplyUsageLimitMetadata(accumulator, window, observedAt)) {
    return;
  }

  const statusLine = accumulator.statusLine;

  if (window === "fiveHour") {
    statusLine.fiveHourLimitPercent = observedAt === null ? maxNullable(statusLine.fiveHourLimitPercent, value) : value;
    noteUsageLimitMetadata(accumulator, window, observedAt);
    return;
  }

  statusLine.weeklyLimitPercent = observedAt === null ? maxNullable(statusLine.weeklyLimitPercent, value) : value;
  noteUsageLimitMetadata(accumulator, window, observedAt);
}

function isRemainingUsageLimitPercentPath(normalizedPath: string, leafKey: string): boolean {
  return leafKey.includes("remaining") ||
    leafKey.includes("left") ||
    leafKey.includes("available") ||
    normalizedPath.includes("remaining") ||
    normalizedPath.includes("left") ||
    normalizedPath.includes("available");
}

function usedPercentFromRemainingPercent(value: number): number {
  return Math.max(100 - value, 0);
}

function setUsageLimitTokenLimit(
  statusLine: MutableLocalCliStatusLineUsage,
  window: "fiveHour" | "weekly",
  value: number,
): void {
  if (window === "fiveHour") {
    statusLine.fiveHourLimitTokens = maxNullable(statusLine.fiveHourLimitTokens, value);
    return;
  }

  statusLine.weeklyLimitTokens = maxNullable(statusLine.weeklyLimitTokens, value);
}

function setUsageLimitTokenUsage(
  accumulator: UsageAccumulator,
  window: "fiveHour" | "weekly",
  value: number,
  observedAt: number | null,
): void {
  if (!shouldApplyUsageLimitMetadata(accumulator, window, observedAt)) {
    return;
  }

  const statusLine = accumulator.statusLine;

  if (window === "fiveHour") {
    statusLine.fiveHourUsedTokens = observedAt === null ? maxNullable(statusLine.fiveHourUsedTokens, value) : value;
    noteUsageLimitMetadata(accumulator, window, observedAt);
    return;
  }

  statusLine.weeklyUsedTokens = observedAt === null ? maxNullable(statusLine.weeklyUsedTokens, value) : value;
  noteUsageLimitMetadata(accumulator, window, observedAt);
}

function setUsageLimitResetAt(
  accumulator: UsageAccumulator,
  window: "fiveHour" | "weekly",
  value: string,
  observedAt: number | null,
): void {
  if (!shouldApplyUsageLimitMetadata(accumulator, window, observedAt)) {
    return;
  }

  const statusLine = accumulator.statusLine;

  if (window === "fiveHour") {
    statusLine.fiveHourResetAt = observedAt === null ? statusLine.fiveHourResetAt ?? value : value;
    noteUsageLimitMetadata(accumulator, window, observedAt);
    return;
  }

  statusLine.weeklyResetAt = observedAt === null ? statusLine.weeklyResetAt ?? value : value;
  noteUsageLimitMetadata(accumulator, window, observedAt);
}

function shouldApplyUsageLimitMetadata(
  accumulator: UsageAccumulator,
  window: "fiveHour" | "weekly",
  observedAt: number | null,
): boolean {
  if (observedAt === null) {
    return true;
  }

  const current = accumulator.limitMetadataObservedAt[window];

  return current === null || observedAt >= current;
}

function noteUsageLimitMetadata(
  accumulator: UsageAccumulator,
  window: "fiveHour" | "weekly",
  observedAt: number | null,
): void {
  if (observedAt === null) {
    return;
  }

  accumulator.limitMetadataObservedAt[window] = observedAt;
}

function maxNullable(left: number | null, right: number): number {
  return Math.max(left ?? 0, right);
}

async function listJsonlFiles(root: string, periodStart: Date): Promise<Array<{ path: string; modifiedAt: Date }>> {
  try {
    const rootStat = await stat(root);

    if (!rootStat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  return listJsonlFilesRecursive(root, periodStart);
}

async function listJsonlFilesRecursive(root: string, periodStart: Date): Promise<Array<{ path: string; modifiedAt: Date }>> {
  const entries = (await readdir(root, {
    withFileTypes: true,
  })).sort((left, right) => right.name.localeCompare(left.name));
  const files: Array<{ path: string; modifiedAt: Date }> = [];
  const periodStartTime = periodStart.getTime();

  for (const entry of entries) {
    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listJsonlFilesRecursive(fullPath, periodStart));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
      continue;
    }

    let fileStat;

    try {
      fileStat = await stat(fullPath);
    } catch {
      continue;
    }

    if (fileStat.mtime.getTime() < periodStartTime) {
      continue;
    }

    files.push({
      path: fullPath,
      modifiedAt: fileStat.mtime,
    });
  }

  return files;
}

interface UsageAccumulator {
  sessionIds: Set<string>;
  turnIds: Set<string>;
  models: Map<string, number>;
  fiveHourWindowStart: Date;
  weeklyWindowStart: Date;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  reasoningOutputTokens: number;
  logFileCount: number;
  parsedUsageRecordCount: number;
  latestActivityAt: string | null;
  statusLine: MutableLocalCliStatusLineUsage;
  limitMetadataObservedAt: Record<"fiveHour" | "weekly", number | null>;
  usageResetCreditMetadataObservedAt: number | null;
}

type MutableLocalCliStatusLineUsage = LocalCliStatusLineUsage;

function createUsageAccumulator(
  providerKind: LocalCliUsageSummary["providerKind"],
  env: Record<string, string | undefined>,
  now: Date,
  providerKey?: LocalAiCliProviderKey,
): UsageAccumulator {
  const statusLine = emptyStatusLineUsage();
  const fiveHourLimit = providerKind === "codex"
    ? readConfiguredTokenLimit(env.MONEYSIREN_CODEX_FIVE_HOUR_TOKEN_LIMIT)
    : providerKind === "claude"
      ? readConfiguredTokenLimit(env.MONEYSIREN_CLAUDE_FIVE_HOUR_TOKEN_LIMIT)
      : null;
  const weeklyLimit = providerKind === "codex"
    ? readConfiguredTokenLimit(env.MONEYSIREN_CODEX_WEEKLY_TOKEN_LIMIT)
    : providerKind === "claude"
      ? readConfiguredTokenLimit(env.MONEYSIREN_CLAUDE_WEEKLY_TOKEN_LIMIT)
      : null;

  statusLine.fiveHourLimitTokens = fiveHourLimit;
  statusLine.weeklyLimitTokens = weeklyLimit;
  statusLine.usageResetCredits = readConfiguredUsageResetCredits(providerKind, providerKey, env);

  return {
    sessionIds: new Set(),
    turnIds: new Set(),
    models: new Map(),
    fiveHourWindowStart: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    weeklyWindowStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    toolCallCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheTokens: 0,
    totalTokens: 0,
    reasoningOutputTokens: 0,
    logFileCount: 0,
    parsedUsageRecordCount: 0,
    latestActivityAt: null,
    statusLine,
    limitMetadataObservedAt: {
      fiveHour: null,
      weekly: null,
    },
    usageResetCreditMetadataObservedAt: null,
  };
}

function readConfiguredTokenLimit(value: unknown): number | null {
  const numberValue = readNumber(value);

  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function readConfiguredUsageResetCredits(
  providerKind: LocalCliUsageSummary["providerKind"],
  providerKey: LocalAiCliProviderKey | undefined,
  env: Record<string, string | undefined>,
): readonly LocalCliUsageResetCredit[] {
  if (providerKind !== "codex") {
    return [];
  }

  const appSpecific = providerKey === "codex-app";
  const count = readConfiguredTokenLimit(
    appSpecific
      ? env.MONEYSIREN_CODEX_APP_USAGE_RESET_CREDITS ?? env.MONEYSIREN_CODEX_USAGE_RESET_CREDITS
      : env.MONEYSIREN_CODEX_USAGE_RESET_CREDITS,
  );

  if (count === null) {
    return [];
  }

  const expiresAtValues = readConfiguredUsageResetCreditExpiries(
    appSpecific
      ? env.MONEYSIREN_CODEX_APP_USAGE_RESET_CREDIT_EXPIRES_AT ?? env.MONEYSIREN_CODEX_USAGE_RESET_CREDIT_EXPIRES_AT
      : env.MONEYSIREN_CODEX_USAGE_RESET_CREDIT_EXPIRES_AT,
  );

  return Array.from({ length: Math.floor(count) }, (_item, index) => ({
    label: null,
    expiresAt: expiresAtValues[index] ?? expiresAtValues[0] ?? null,
  }));
}

function readConfiguredUsageResetCreditExpiries(value: string | undefined): string[] {
  const trimmed = trimToNull(value);

  if (trimmed === null) {
    return [];
  }

  return trimmed
    .split(/[;,]/)
    .map((item) => readTimestampValue(item.trim()))
    .filter((item): item is Date => item !== null)
    .map((item) => item.toISOString());
}

function emptyLocalCliUsage(
  source: LocalCliUsageSummary["source"],
  providerKind: LocalCliUsageSummary["providerKind"],
  message: string,
  searchedPathHint: string,
  statusLine: LocalCliStatusLineUsage = emptyStatusLineUsage(),
): LocalCliUsageSummary {
  return {
    source,
    period: "current_month",
    providerKind,
    sessionCount: 0,
    turnCount: 0,
    toolCallCount: 0,
    inputTokens: null,
    outputTokens: null,
    cacheTokens: null,
    totalTokens: null,
    reasoningOutputTokens: null,
    logFileCount: 0,
    parsedUsageRecordCount: 0,
    searchedPathHint,
    latestActivityAt: null,
    topModels: [],
    statusLine,
    message,
  };
}

function emptyStatusLineUsage(): LocalCliStatusLineUsage {
  return {
    contextWindowTokens: null,
    contextWindowLimit: null,
    contextWindowPercent: null,
    fiveHourUsedTokens: null,
    fiveHourLimitTokens: null,
    fiveHourLimitPercent: null,
    fiveHourRemainingTokens: null,
    fiveHourResetAt: null,
    weeklyUsedTokens: null,
    weeklyLimitTokens: null,
    weeklyLimitPercent: null,
    weeklyRemainingTokens: null,
    weeklyResetAt: null,
    lastInputTokens: null,
    lastOutputTokens: null,
    lastCacheTokens: null,
    lastReasoningTokens: null,
    lastTotalTokens: null,
    totalInputTokens: null,
    totalOutputTokens: null,
    totalCacheTokens: null,
    totalReasoningTokens: null,
    totalTokens: null,
    usageResetCredits: [],
  };
}

function finalizeStatusLineUsage(statusLine: LocalCliStatusLineUsage): LocalCliStatusLineUsage {
  const inferredTotalTokens = sumNumbers([
    statusLine.totalInputTokens,
    statusLine.totalOutputTokens,
    statusLine.totalCacheTokens,
    statusLine.totalReasoningTokens,
  ]);
  const inferredLastTotalTokens = sumNumbers([
    statusLine.lastInputTokens,
    statusLine.lastOutputTokens,
    statusLine.lastCacheTokens,
    statusLine.lastReasoningTokens,
  ]);

  return {
    ...statusLine,
    contextWindowPercent: percentOf(statusLine.contextWindowTokens, statusLine.contextWindowLimit),
    fiveHourLimitPercent: statusLine.fiveHourLimitPercent ??
      percentOf(statusLine.fiveHourUsedTokens, statusLine.fiveHourLimitTokens),
    fiveHourRemainingTokens: remainingTokens(statusLine.fiveHourUsedTokens, statusLine.fiveHourLimitTokens),
    weeklyLimitPercent: statusLine.weeklyLimitPercent ??
      percentOf(statusLine.weeklyUsedTokens, statusLine.weeklyLimitTokens),
    weeklyRemainingTokens: remainingTokens(statusLine.weeklyUsedTokens, statusLine.weeklyLimitTokens),
    totalTokens: statusLine.totalTokens ?? (inferredTotalTokens === 0 ? null : inferredTotalTokens),
    lastTotalTokens: statusLine.lastTotalTokens ?? (inferredLastTotalTokens === 0 ? null : inferredLastTotalTokens),
  };
}

function remainingTokens(used: number | null, limit: number | null): number | null {
  if (used === null || limit === null) {
    return null;
  }

  return Math.max(limit - used, 0);
}

async function readAwsCliStatus(
  runCommand: LocalCommandRunner,
): Promise<AwsLocalSetupStatus["awsCli"]> {
  try {
    const result = await runCommand("aws", ["--version"], {
      timeout: AWS_CLI_TIMEOUT_MS,
      windowsHide: true,
    });
    const output = normalizeCommandOutput(result.stdout, result.stderr);

    return {
      state: "installed",
      version: extractAwsCliVersion(output),
      detail: output.length === 0 ? null : output,
    };
  } catch (caught) {
    if (isCommandMissingError(caught)) {
      return {
        state: "missing",
        version: null,
        detail: null,
      };
    }

    return {
      state: "error",
      version: null,
      detail: caught instanceof Error ? caught.message : "AWS CLI check failed.",
    };
  }
}

async function readGcloudCliStatus(
  runCommand: LocalCommandRunner,
): Promise<GcpLocalSetupStatus["gcloudCli"]> {
  try {
    const result = await runCommand("gcloud", ["--version"], {
      timeout: GCLOUD_CLI_TIMEOUT_MS,
      windowsHide: true,
    });
    const output = normalizeCommandOutput(result.stdout, result.stderr);

    return {
      state: "installed",
      version: extractGcloudCliVersion(output),
      detail: output.length === 0 ? null : output,
    };
  } catch (caught) {
    if (isCommandMissingError(caught)) {
      return {
        state: "missing",
        version: null,
        detail: null,
      };
    }

    return {
      state: "error",
      version: null,
      detail: caught instanceof Error ? caught.message : "Google Cloud CLI check failed.",
    };
  }
}

async function readGcloudActiveAccount(
  runCommand: LocalCommandRunner,
): Promise<GcpLocalSetupStatus["account"]> {
  try {
    const result = await runCommand("gcloud", ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"], {
      timeout: GCLOUD_CLI_TIMEOUT_MS,
      windowsHide: true,
    });
    const account = trimToNull(normalizeCommandOutput(result.stdout, result.stderr));

    return {
      state: account === null ? "missing" : "configured",
      activeAccountHint: account === null ? null : maskAccountIdentifier(account),
    };
  } catch {
    return {
      state: "missing",
      activeAccountHint: null,
    };
  }
}

async function readGcloudProject(
  runCommand: LocalCommandRunner,
  env: Record<string, string | undefined>,
): Promise<GcpLocalSetupStatus["project"]> {
  const envProject = readGcpProjectFromEnv(env);

  if (envProject.state === "configured") {
    return envProject;
  }

  try {
    const result = await runCommand("gcloud", ["config", "get-value", "project", "--quiet"], {
      timeout: GCLOUD_CLI_TIMEOUT_MS,
      windowsHide: true,
    });
    const projectId = normalizeGcloudValue(normalizeCommandOutput(result.stdout, result.stderr));

    return {
      state: projectId === null ? "missing" : "configured",
      projectIdHint: projectId === null ? null : maskProjectIdentifier(projectId),
    };
  } catch {
    return {
      state: "missing",
      projectIdHint: null,
    };
  }
}

function readGcpProjectFromEnv(env: Record<string, string | undefined>): GcpLocalSetupStatus["project"] {
  const projectId = trimToNull(env.GOOGLE_CLOUD_PROJECT);

  return {
    state: projectId === null ? "missing" : "configured",
    projectIdHint: projectId === null ? null : maskProjectIdentifier(projectId),
  };
}

async function readGcpAdcStatus(options: {
  env: Record<string, string | undefined>;
  homeDir: string;
  platform: NodeJS.Platform;
}): Promise<GcpLocalSetupStatus["adc"]> {
  const envConfigured = trimToNull(options.env.GOOGLE_APPLICATION_CREDENTIALS) !== null;
  const fileDetected = await fileExists(defaultGcpAdcPath(options));
  const source = envConfigured
    ? "GOOGLE_APPLICATION_CREDENTIALS"
    : fileDetected
      ? "application_default_credentials"
      : "none";

  return {
    state: envConfigured || fileDetected ? "configured" : "missing",
    source,
    envConfigured,
    fileDetected,
  };
}

function defaultGcpAdcPath(options: {
  env: Record<string, string | undefined>;
  homeDir: string;
  platform: NodeJS.Platform;
}): string {
  const cloudSdkConfig = trimToNull(options.env.CLOUDSDK_CONFIG);

  if (cloudSdkConfig !== null) {
    return join(cloudSdkConfig, "application_default_credentials.json");
  }

  if (options.platform === "win32") {
    return join(trimToNull(options.env.APPDATA) ?? join(options.homeDir, "AppData", "Roaming"), "gcloud", "application_default_credentials.json");
  }

  return join(options.homeDir, ".config", "gcloud", "application_default_credentials.json");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);

    return fileStat.isFile();
  } catch {
    return false;
  }
}

function readAwsCredentialChainStatus(
  env: Record<string, string | undefined>,
): AwsLocalSetupStatus["credentialChain"] {
  const profileName = trimToNull(env.AWS_PROFILE);

  if (profileName !== null) {
    return {
      state: "configured",
      source: "AWS_PROFILE",
      profileName,
    };
  }

  if (isConfigured(env.AWS_ACCESS_KEY_ID) && isConfigured(env.AWS_SECRET_ACCESS_KEY)) {
    return {
      state: "configured",
      source: "access_key_env",
      profileName: null,
    };
  }

  return {
    state: "missing",
    source: "none",
    profileName: null,
  };
}

function normalizeAwsProfileName(value: string): string {
  const profileName = value.trim();

  if (!AWS_PROFILE_NAME_PATTERN.test(profileName)) {
    throw new Error("AWS profile name must be 1-80 characters and contain only letters, numbers, '.', '_', '-', ':', '+', '=', '@', or ','.");
  }

  return profileName;
}

function normalizeProviderEnvEntries(entries: Readonly<Record<string, string>>): Record<string, string> {
  const normalizedEntries: Record<string, string> = {};

  for (const [key, value] of Object.entries(entries)) {
    if (!PROVIDER_ENV_KEYS.has(key)) {
      throw new Error(`Unsupported provider environment key: ${key}`);
    }

    const normalizedValue = value.trim();

    if (normalizedValue.length === 0) {
      throw new Error(`Provider environment value is required for ${key}.`);
    }

    if (normalizedValue.length > PROVIDER_ENV_VALUE_MAX_LENGTH) {
      throw new Error(`Provider environment value is too long for ${key}.`);
    }

    normalizedEntries[key] = normalizedValue;
  }

  if (Object.keys(normalizedEntries).length === 0) {
    throw new Error("At least one provider environment variable is required.");
  }

  return normalizedEntries;
}

async function defaultRunCommand(
  file: string,
  args: readonly string[],
  options: {
    direct?: boolean;
    timeout: number;
    windowsHide: boolean;
  },
): Promise<{
  stdout?: string;
  stderr?: string;
}> {
  if (process.platform === "win32") {
    if (options.direct === true) {
      return execFileAsync(file, [...args], {
        timeout: options.timeout,
        windowsHide: options.windowsHide,
      });
    }

    const commandLine = [file, ...args].map(windowsShellQuote).join(" ");

    return execFileAsync(windowsSystemExecutable("cmd.exe", process.env), ["/d", "/c", commandLine], {
      env: buildWindowsLocalToolEnv(),
      timeout: options.timeout,
      windowsHide: options.windowsHide,
    });
  }

  return execFileAsync(file, [...args], {
    timeout: options.timeout,
    windowsHide: options.windowsHide,
  });
}

function spawnLocalCommand(
  file: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): ChildProcessWithoutNullStreams {
  if (process.platform === "win32") {
    const commandLine = [file, ...args].map(windowsShellQuote).join(" ");

    return spawn(windowsSystemExecutable("cmd.exe", env), ["/d", "/c", commandLine], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  }

  return spawn(file, [...args], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
}

function childProcessEnv(env: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = process.platform === "win32"
    ? buildWindowsLocalToolEnv()
    : { ...process.env };

  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      childEnv[key] = value;
    }
  }

  return childEnv;
}

function normalizeCommandOutput(stdout: string | undefined, stderr: string | undefined): string {
  return [stdout, stderr]
    .filter((value): value is string => value !== undefined)
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)[0] ?? "";
}

function extractAwsCliVersion(output: string): string | null {
  const match = /^aws-cli\/([^\s]+)/.exec(output);

  return match?.[1] ?? null;
}

function extractGcloudCliVersion(output: string): string | null {
  const match = /^Google Cloud SDK\s+([^\s]+)/.exec(output);

  return match?.[1] ?? null;
}

function extractVersion(output: string, pattern: RegExp): string | null {
  const fallback = /([0-9]+\.[0-9]+(?:\.[0-9]+)?[^\s]*)/.exec(output);

  if (fallback?.[1] !== undefined) {
    return fallback[1];
  }

  const match = pattern.exec(output);

  if (match?.[1] !== undefined) {
    return match[1];
  }

  return null;
}

function isCommandMissingError(caught: unknown): boolean {
  const message = caught instanceof Error ? caught.message : "";
  const stderr = typeof caught === "object" &&
    caught !== null &&
    "stderr" in caught &&
    typeof (caught as { stderr?: unknown }).stderr === "string"
      ? (caught as { stderr: string }).stderr
      : "";
  const output = `${message}\n${stderr}`;

  return (
    typeof caught === "object" &&
    caught !== null &&
    "code" in caught &&
    (caught as { code?: unknown }).code === "ENOENT"
  ) || /is not recognized as an internal or external command|command not found|not found/i.test(output);
}

function normalizeGcloudValue(value: string): string | null {
  const normalized = trimToNull(value);

  if (normalized === null || normalized === "(unset)" || normalized === "None") {
    return null;
  }

  return normalized;
}

function maskAccountIdentifier(value: string): string {
  const normalized = value.trim();
  const atIndex = normalized.indexOf("@");

  if (atIndex <= 0) {
    return normalized.length <= 4 ? "configured account" : `${normalized.slice(0, 2)}***`;
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const domainParts = domain.split(".");
  const rootDomain = domainParts[0] ?? "";
  const suffix = domainParts.length > 1 ? `.${domainParts[domainParts.length - 1]}` : "";

  return `${local.slice(0, 1)}***@${rootDomain.slice(0, 1)}***${suffix}`;
}

function maskProjectIdentifier(value: string): string {
  const normalized = value.trim();

  if (normalized.length <= 6) {
    return "configured project";
  }

  return `${normalized.slice(0, 3)}***${normalized.slice(-2)}`;
}

function windowsShellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, "\\\"")}"`;
}

function buildWindowsLocalToolEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
  };
  const currentPath = env.Path ?? env.PATH ?? "";
  const path = buildWindowsLocalToolPath(currentPath, env, process.execPath);

  env.Path = path;
  env.PATH = path;

  return env;
}

function appendUniqueWindowsPathSegments(currentPath: string, candidates: readonly (string | null)[]): string {
  const segments = currentPath
    .split(WINDOWS_PATH_DELIMITER)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const seen = new Set(segments.map(normalizeWindowsPathSegment));

  for (const candidate of candidates) {
    const segment = trimToNull(candidate ?? undefined);

    if (segment === null) {
      continue;
    }

    const key = normalizeWindowsPathSegment(segment);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    segments.push(segment);
  }

  return segments.join(WINDOWS_PATH_DELIMITER);
}

function normalizeWindowsPathSegment(value: string): string {
  return value.replace(/[\\/]+$/, "").toLowerCase();
}

function joinIfBase(base: string | undefined, ...segments: string[]): string | null {
  const normalizedBase = trimToNull(base);

  return normalizedBase === null ? null : win32.join(normalizedBase, ...segments);
}

function localPathHint(path: string, homeDir: string): string {
  const normalizedHome = normalizePathForHint(homeDir);
  const normalizedPath = normalizePathForHint(path);

  if (normalizedPath === normalizedHome) {
    return "~";
  }

  if (normalizedPath.startsWith(`${normalizedHome}/`)) {
    return `~${path.slice(homeDir.length)}`;
  }

  return path;
}

function windowsSystemExecutable(fileName: string, env: Record<string, string | undefined>): string {
  const windowsRoot = trimToNull(env.SystemRoot) ?? trimToNull(env.WINDIR) ?? "C:\\Windows";

  return win32.join(windowsRoot, "System32", fileName);
}

function normalizePathForHint(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length === 0 ? null : trimmed;
}

function isConfigured(value: string | undefined): boolean {
  return trimToNull(value) !== null;
}

function readHomeDir(env: Record<string, string | undefined>): string {
  return trimToNull(env.USERPROFILE) ?? trimToNull(env.HOME) ?? homedir();
}

function latestIsoValue(left: string | null, right: string): string {
  return left === null || right.localeCompare(left) > 0 ? right : left;
}

function increment(values: Map<string, number>, key: string): void {
  values.set(key, (values.get(key) ?? 0) + 1);
}

function topEntries(values: ReadonlyMap<string, number>): string[] {
  return [...values.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([key]) => key);
}
