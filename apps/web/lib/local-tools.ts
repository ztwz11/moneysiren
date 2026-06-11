import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const AWS_CLI_TIMEOUT_MS = 10_000;
const AWS_PROFILE_PERSIST_TIMEOUT_MS = 10_000;
const GCLOUD_CLI_TIMEOUT_MS = 10_000;
const LOCAL_CLI_TIMEOUT_MS = 3_000;
const MAX_LOCAL_USAGE_FILES = 400;
const LOCAL_AI_CLI_STATUS_CACHE_MS = 5_000;
const AWS_PROFILE_NAME_PATTERN = /^[A-Za-z0-9_.:@+=,-]{1,80}$/;
const WINDOWS_PATH_DELIMITER = ";";

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
export type LocalAiCliProviderKey = "codex-cli" | "claude-cli";
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
  source: "codex_sessions" | "claude_projects" | "not_found";
  period: "current_month";
  providerKind: "codex" | "claude";
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
    trimToNull(nodeExecutable) === null ? null : dirname(nodeExecutable),
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
    joinIfBase(env["ProgramFiles"], "Google", "Cloud SDK", "google-cloud-sdk", "bin"),
    joinIfBase(env["ProgramFiles(x86)"], "Google", "Cloud SDK", "google-cloud-sdk", "bin"),
  ]);
}

let localAiCliStatusCache: {
  expiresAt: number;
  key: string;
  payload: LocalAiCliStatusPayload;
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
    throw new Error("Persisting AWS_PROFILE from StackSpend is currently supported on Windows only.");
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
    restartHint: "New terminals inherit the saved AWS_PROFILE. The current StackSpend server process was updated immediately.",
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
  const providerKeys = options.providerKeys ?? (["codex-cli", "claude-cli"] as const);
  const cacheKey = localAiCliStatusCacheKey(env, homeDir, providerKeys);
  const cacheTtlMs = options.cacheTtlMs ?? LOCAL_AI_CLI_STATUS_CACHE_MS;
  const cacheNow = now().getTime();

  if (options.runCommand === undefined && cacheTtlMs > 0 && localAiCliStatusCache?.key === cacheKey && localAiCliStatusCache.expiresAt > cacheNow) {
    return localAiCliStatusCache.payload;
  }

  const payload: LocalAiCliStatusPayload = {
    generatedAt: now().toISOString(),
    localOnly: true,
    secretsReturned: false,
    providers: await Promise.all(providerKeys.map((providerKey) =>
      readLocalAiCliProviderStatus(providerKey, {
        env,
        homeDir,
        now: now(),
        runCommand,
      })
    )),
  };

  if (options.runCommand === undefined && cacheTtlMs > 0) {
    localAiCliStatusCache = {
      expiresAt: cacheNow + cacheTtlMs,
      key: cacheKey,
      payload,
    };
  }

  return payload;
}

async function readLocalAiCliProviderStatus(
  providerKey: LocalAiCliProviderKey,
  context: {
    env: Record<string, string | undefined>;
    homeDir: string;
    now: Date;
    runCommand: LocalCommandRunner;
  },
): Promise<LocalAiCliProviderStatus> {
  const definition = localCliDefinition(providerKey);
  const [cli, usage] = await Promise.all([
    readLocalCliStatus(definition.command, definition.versionPattern, context.runCommand),
    providerKey === "codex-cli"
      ? readCodexCliUsage(context)
      : readClaudeCliUsage(context),
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
    claudeFiveHourLimit: trimToNull(env.STACKSPEND_CLAUDE_FIVE_HOUR_TOKEN_LIMIT),
    claudeWeeklyLimit: trimToNull(env.STACKSPEND_CLAUDE_WEEKLY_TOKEN_LIMIT),
    codexHome: trimToNull(env.CODEX_HOME),
    codexSessionsDir: trimToNull(env.STACKSPEND_CODEX_SESSIONS_DIR),
    codexFiveHourLimit: trimToNull(env.STACKSPEND_CODEX_FIVE_HOUR_TOKEN_LIMIT),
    codexWeeklyLimit: trimToNull(env.STACKSPEND_CODEX_WEEKLY_TOKEN_LIMIT),
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

function localCliDefinition(providerKey: LocalAiCliProviderKey): {
  command: string;
  displayName: string;
  versionPattern: RegExp;
} {
  if (providerKey === "codex-cli") {
    return {
      command: "codex",
      displayName: "Codex CLI",
      versionPattern: /codex(?:-cli)?\s+([^\s]+)/i,
    };
  }

  return {
    command: "claude",
    displayName: "Claude CLI",
    versionPattern: /(?:claude(?: code)?|claude-code)\s+([^\s]+)/i,
  };
}

async function readCodexCliUsage(context: {
  env: Record<string, string | undefined>;
  homeDir: string;
  now: Date;
}): Promise<LocalCliUsageSummary> {
  const sessionsRoot = trimToNull(context.env.STACKSPEND_CODEX_SESSIONS_DIR) ??
    join(trimToNull(context.env.CODEX_HOME) ?? join(context.homeDir, ".codex"), "sessions");
  const result = await readJsonlUsageFiles({
    env: context.env,
    root: sessionsRoot,
    searchedPathHint: localPathHint(sessionsRoot, context.homeDir),
    now: context.now,
    providerKind: "codex",
    source: "codex_sessions",
    missingMessage: "Codex session logs were not found.",
  });

  return result.logFileCount === 0
    ? result
    : {
        ...result,
        message: "Codex CLI usage is estimated from local session status metadata.",
      };
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

async function readJsonlUsageFiles(options: {
  env: Record<string, string | undefined>;
  root: string;
  searchedPathHint: string;
  now: Date;
  providerKind: LocalCliUsageSummary["providerKind"];
  source: LocalCliUsageSummary["source"];
  missingMessage: string;
}): Promise<LocalCliUsageSummary> {
  const periodStart = new Date(Date.UTC(options.now.getUTCFullYear(), options.now.getUTCMonth(), 1));
  const files = (await listJsonlFiles(options.root, periodStart))
    .sort((left, right) => right.modifiedAt.getTime() - left.modifiedAt.getTime())
    .slice(0, MAX_LOCAL_USAGE_FILES);
  const accumulator = createUsageAccumulator(options.providerKind, options.env, options.now);

  for (const file of files) {
    accumulator.logFileCount += 1;
    accumulator.sessionIds.add(file.path);
    accumulator.latestActivityAt = latestIsoValue(accumulator.latestActivityAt, file.modifiedAt.toISOString());
    await readJsonlUsageFile(file.path, accumulator);
  }

  if (accumulator.logFileCount === 0) {
    return emptyLocalCliUsage(options.source, options.missingMessage, options.searchedPathHint);
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
      accumulateLimitMetadataFromValue(value, accumulator.statusLine);
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

function accumulateLimitMetadataFromValue(value: unknown, statusLine: MutableLocalCliStatusLineUsage): void {
  const record = asRecord(value);

  if (record !== null) {
    accumulateLimitMetadata(record, statusLine);
  }
}

function accumulateLimitMetadata(
  record: Record<string, unknown>,
  statusLine: MutableLocalCliStatusLineUsage,
  path: readonly string[] = [],
): void {
  for (const [key, nested] of Object.entries(record)) {
    const nextPath = [...path, key];
    const window = usageLimitWindowFromPath(nextPath);

    if (window !== null) {
      applyUsageLimitMetadata(nextPath, nested, window, statusLine);
    }

    const nestedRecord = asRecord(nested);

    if (nestedRecord !== null) {
      accumulateLimitMetadata(nestedRecord, statusLine, nextPath);
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
  statusLine: MutableLocalCliStatusLineUsage,
): void {
  const normalizedPath = path.map((item) => item.toLowerCase()).join(".");
  const numericValue = readNumber(value);

  if (numericValue !== null && numericValue >= 0) {
    const hasTokenHint = normalizedPath.includes("token");

    if (
      normalizedPath.includes("percent") ||
      normalizedPath.includes("percentage") ||
      normalizedPath.includes("pct")
    ) {
      setUsageLimitPercent(statusLine, window, numericValue);
      return;
    }

    if (
      hasTokenHint &&
      (
        normalizedPath.includes("limit") ||
        normalizedPath.includes("quota") ||
        normalizedPath.includes("max")
      )
    ) {
      setUsageLimitTokenLimit(statusLine, window, numericValue);
      return;
    }

    if (
      hasTokenHint &&
      (
        normalizedPath.includes("used") ||
        normalizedPath.includes("usage") ||
        normalizedPath.includes("current") ||
        normalizedPath.includes("consumed")
      )
    ) {
      setUsageLimitTokenUsage(statusLine, window, numericValue);
    }
  }

  if (typeof value === "string" && normalizedPath.includes("reset")) {
    const resetAt = readTimestampValue(value);

    if (resetAt !== null) {
      setUsageLimitResetAt(statusLine, window, resetAt.toISOString());
    }
  }
}

function setUsageLimitPercent(
  statusLine: MutableLocalCliStatusLineUsage,
  window: "fiveHour" | "weekly",
  value: number,
): void {
  if (window === "fiveHour") {
    statusLine.fiveHourLimitPercent = maxNullable(statusLine.fiveHourLimitPercent, value);
    return;
  }

  statusLine.weeklyLimitPercent = maxNullable(statusLine.weeklyLimitPercent, value);
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
  statusLine: MutableLocalCliStatusLineUsage,
  window: "fiveHour" | "weekly",
  value: number,
): void {
  if (window === "fiveHour") {
    statusLine.fiveHourUsedTokens = maxNullable(statusLine.fiveHourUsedTokens, value);
    return;
  }

  statusLine.weeklyUsedTokens = maxNullable(statusLine.weeklyUsedTokens, value);
}

function setUsageLimitResetAt(
  statusLine: MutableLocalCliStatusLineUsage,
  window: "fiveHour" | "weekly",
  value: string,
): void {
  if (window === "fiveHour") {
    statusLine.fiveHourResetAt = statusLine.fiveHourResetAt ?? value;
    return;
  }

  statusLine.weeklyResetAt = statusLine.weeklyResetAt ?? value;
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
}

type MutableLocalCliStatusLineUsage = LocalCliStatusLineUsage;

function createUsageAccumulator(
  providerKind: LocalCliUsageSummary["providerKind"],
  env: Record<string, string | undefined>,
  now: Date,
): UsageAccumulator {
  const statusLine = emptyStatusLineUsage();
  const fiveHourLimit = readConfiguredTokenLimit(
    env[providerKind === "codex" ? "STACKSPEND_CODEX_FIVE_HOUR_TOKEN_LIMIT" : "STACKSPEND_CLAUDE_FIVE_HOUR_TOKEN_LIMIT"],
  );
  const weeklyLimit = readConfiguredTokenLimit(
    env[providerKind === "codex" ? "STACKSPEND_CODEX_WEEKLY_TOKEN_LIMIT" : "STACKSPEND_CLAUDE_WEEKLY_TOKEN_LIMIT"],
  );

  statusLine.fiveHourLimitTokens = fiveHourLimit;
  statusLine.weeklyLimitTokens = weeklyLimit;

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
  };
}

function readConfiguredTokenLimit(value: unknown): number | null {
  const numberValue = readNumber(value);

  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function emptyLocalCliUsage(
  source: LocalCliUsageSummary["source"],
  message: string,
  searchedPathHint: string,
): LocalCliUsageSummary {
  return {
    source,
    period: "current_month",
    providerKind: source === "codex_sessions" ? "codex" : "claude",
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
    statusLine: emptyStatusLineUsage(),
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

    return execFileAsync("cmd.exe", ["/d", "/c", commandLine], {
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

  return normalizedBase === null ? null : join(normalizedBase, ...segments);
}

function localPathHint(path: string, homeDir: string): string {
  const normalizedHome = normalizeWindowsPathSegment(homeDir);
  const normalizedPath = normalizeWindowsPathSegment(path);

  if (normalizedPath === normalizedHome) {
    return "~";
  }

  if (normalizedPath.startsWith(`${normalizedHome}\\`)) {
    return `~${path.slice(homeDir.length)}`;
  }

  return path;
}

function windowsSystemExecutable(fileName: string, env: Record<string, string | undefined>): string {
  const windowsRoot = trimToNull(env.SystemRoot) ?? trimToNull(env.WINDIR) ?? "C:\\Windows";

  return join(windowsRoot, "System32", fileName);
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
