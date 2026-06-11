"use client";

import { ExternalLink, Gauge, RefreshCw, Terminal } from "lucide-react";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { findAvailableProvider, type ProviderKey } from "../lib/provider-catalog";

interface CredentialControlLabels {
  savedConnections: string;
  connectionLabel: string;
  connectionId: string;
  requiredEnv: string;
  credentialSecret: string;
  accountIds: string;
  openAiAdminKeyHint: string;
  envOnlySecrets: string;
  credentialSaveError: string;
  credentialDeleteError: string;
  saveCredential: string;
  removeCredential: string;
  startOAuth: string;
  toolLoadingTitle: string;
  toolLoadingCheckingCli: string;
  toolLoadingCheckingCredentials: string;
  toolLoadingReadingUsage: string;
  toolLoadingPreparingView: string;
  awsManaged: string;
  awsCliTitle: string;
  awsCliInstalled: string;
  awsCliMissing: string;
  awsCliError: string;
  awsCliVersion: string;
  awsCredentialChain: string;
  awsCredentialConfigured: string;
  awsCredentialMissing: string;
  installAwsCli: string;
  configureAwsSso: string;
  refreshAwsCliStatus: string;
  awsCliCommandHint: string;
  awsProfileName: string;
  registerAwsProfileGlobally: string;
  awsProfilePersistHint: string;
  awsProfilePersistSuccess: string;
  awsProfilePersistError: string;
  gcpManaged: string;
  gcpCliTitle: string;
  gcpCliInstalled: string;
  gcpCliMissing: string;
  gcpCliError: string;
  gcpAccount: string;
  gcpProject: string;
  gcpAdc: string;
  gcpConfigured: string;
  gcpMissing: string;
  installGcloudCli: string;
  configureGcloudAuth: string;
  configureGcloudAdc: string;
  refreshGcpCliStatus: string;
  gcpCliCommandHint: string;
  localCliTitle: string;
  localCliInstalled: string;
  localCliMissing: string;
  localCliCheckFailed: string;
  localCliUsageSource: string;
  localCliLatestActivity: string;
  localCliSessionsTurns: string;
  localCliNoUsage: string;
  localCliStatusLine: string;
  localCliContextWindow: string;
  localCliFiveHourLimit: string;
  localCliWeeklyLimit: string;
  localCliFiveHourWindow: string;
  localCliWeeklyWindow: string;
  localCliRemaining: string;
  localCliResetAt: string;
  localCliLearnMore: string;
  localCliLastRequest: string;
  localCliSessionTokens: string;
  localCliCurrentUsage: string;
  localCliReasoning: string;
  localCliLogFiles: string;
  refreshLocalCliStatus: string;
}

interface CredentialConnectionView {
  connectionId: string;
  label: string;
  readOnlyTestState: string;
  active: boolean;
  updatedAt?: string;
}

interface AwsLocalSetupStatusPayload {
  awsCli: {
    state: "installed" | "missing" | "error";
    version: string | null;
    detail: string | null;
  };
  credentialChain: {
    state: "configured" | "missing";
    source: "AWS_PROFILE" | "access_key_env" | "none";
    profileName: string | null;
  };
  docs: {
    installUrl: string;
    ssoUrl: string;
  };
  commands: readonly string[];
}

interface AwsProfilePersistPayload {
  profileName: string;
  restartHint: string;
}

interface GcpLocalSetupStatusPayload {
  gcloudCli: {
    state: "installed" | "missing" | "error";
    version: string | null;
    detail: string | null;
  };
  account: {
    state: "configured" | "missing";
    activeAccountHint: string | null;
  };
  project: {
    state: "configured" | "missing";
    projectIdHint: string | null;
  };
  adc: {
    state: "configured" | "missing";
    source: "GOOGLE_APPLICATION_CREDENTIALS" | "application_default_credentials" | "none";
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

interface LocalAiCliStatusPayload {
  providers: readonly LocalAiCliProviderStatusPayload[];
}

interface LocalAiCliProviderStatusPayload {
  providerKey: "codex-cli" | "claude-cli";
  displayName: string;
  command: string;
  cli: {
    state: "installed" | "missing" | "error";
    version: string | null;
    detail: string | null;
  };
  usage: {
    source: string;
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
    statusLine: {
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
    };
    message: string;
  };
}

export function CredentialControls({
  providerKey,
  connections,
  labels,
}: {
  providerKey: ProviderKey;
  connections: readonly CredentialConnectionView[];
  labels: CredentialControlLabels;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const catalog = findAvailableProvider(providerKey);

  if (providerKey === "aws") {
    return <AwsSetupPanel labels={labels} />;
  }

  if (providerKey === "gcp") {
    return <GcpSetupPanel labels={labels} />;
  }

  if (isLocalAiCliProvider(providerKey)) {
    return <LocalCliSetupPanel labels={labels} providerKey={providerKey} />;
  }

  return (
    <div className="credential-panel">
      {connections.length === 0 ? null : (
        <div className="credential-list">
          <div className="metric-label">{labels.savedConnections}</div>
          {connections.map((connection) => (
            <div className="credential-list-item" key={connection.connectionId}>
              <div>
                <strong>{connection.label}</strong>
                <div className="metric-meta">{labels.connectionId}: {shortConnectionId(connection.connectionId)}</div>
                <div className="credential-status-line">
                  <span className="connection-dot" aria-hidden="true" />
                  <span>{connection.readOnlyTestState}</span>
                </div>
              </div>
              <button
                className="ghost-button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const session = await createSessionOrThrow(labels.credentialDeleteError);
                    const response = await fetch(
                      `/api/connections/${providerKey}/credentials?connectionId=${encodeURIComponent(connection.connectionId)}`,
                      {
                        method: "DELETE",
                        headers: {
                          "x-stackspend-csrf": session.csrfToken,
                        },
                      },
                    );

                    if (response.ok) {
                      window.location.reload();
                      return;
                    }

                    setError(await responseError(response, labels.credentialDeleteError));
                  });
                }}
                type="button"
              >
                {labels.removeCredential}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="credential-form" role="note">
        <p className="credential-hint">{labels.envOnlySecrets}</p>
        {(catalog?.requiredEnvKeys.length ?? 0) === 0 ? null : (
          <div className="credential-field">
            <span className="metric-label">{labels.requiredEnv}</span>
            <div className="aws-command-strip" aria-label={labels.requiredEnv}>
              {catalog?.requiredEnvKeys.map((envKey) => <code key={envKey}>{envKey}</code>)}
            </div>
          </div>
        )}
        {providerKey === "openai" ? (
          <p className="credential-hint">{labels.openAiAdminKeyHint}</p>
        ) : null}
        {error === null ? null : <p className="credential-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

function LocalCliSetupPanel({
  labels,
  providerKey,
}: {
  labels: CredentialControlLabels;
  providerKey: "codex-cli" | "claude-cli";
}) {
  const [provider, setProvider] = useState<LocalAiCliProviderStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingProgress = useToolLoadingProgress(loading, [
    labels.toolLoadingCheckingCli,
    labels.toolLoadingReadingUsage,
    labels.toolLoadingPreparingView,
  ]);

  async function refreshStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/local-tools/ai-cli", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Local AI CLI status unavailable.");
      }

      const payload = await response.json() as LocalAiCliStatusPayload;
      setProvider(payload.providers.find((item) => item.providerKey === providerKey) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Local AI CLI status unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  const cliState = provider?.cli.state ?? null;
  const hasUsage = provider !== null && provider.usage.logFileCount > 0;
  const remainingRows = localCliRemainingRows(provider, labels);
  const usageRows = localCliUsageRows(provider, labels);
  const learnMoreHref = findAvailableProvider(providerKey)?.setupLinks[0]?.href;

  return (
    <div className="aws-setup-panel">
      <div className="aws-setup-header">
        <div>
          <div className="aws-setup-title">
            <Terminal aria-hidden="true" size={15} strokeWidth={2} />
            <strong>{labels.localCliTitle}</strong>
          </div>
          <p className="credential-hint">
            {provider?.usage.message ?? labels.localCliNoUsage}
          </p>
        </div>
        <span className={`badge ${cliState === null ? "badge-neutral" : badgeClassForLocalCli(cliState)}`}>
          {cliState === null && loading ? "..." : localCliStateLabel(cliState ?? "error", labels)}
        </span>
      </div>
      <ToolLoadingProgress
        active={loading}
        label={labels.toolLoadingTitle}
        percent={loadingProgress.percent}
        task={loadingProgress.task}
      />
      {remainingRows.length === 0 ? null : (
        <section className="local-cli-usage-menu" aria-label={labels.localCliRemaining}>
          <div className="local-cli-usage-header">
            <span>
              <Gauge aria-hidden="true" size={14} strokeWidth={1.9} />
              <strong>{labels.localCliRemaining}</strong>
            </span>
          </div>
          <div className="local-cli-usage-rows">
            {remainingRows.map((row) => (
              <div className="local-cli-usage-row" key={row.label}>
                <span>{row.label}</span>
                <span className="local-cli-usage-value">{row.percent}</span>
                <span className="local-cli-usage-reset">{row.resetAt}</span>
              </div>
            ))}
          </div>
          {learnMoreHref === undefined ? null : (
            <a className="local-cli-learn-more" href={learnMoreHref} rel="noreferrer" target="_blank">
              <span>{labels.localCliLearnMore}</span>
              <ExternalLink aria-hidden="true" size={13} strokeWidth={1.9} />
            </a>
          )}
        </section>
      )}
      <div className="aws-setup-grid">
        <div className="aws-setup-item">
          <span className="metric-label">{labels.awsCliVersion}</span>
          <strong>{provider?.cli.version ?? (loading ? "..." : "-")}</strong>
          {provider?.cli.detail === null || provider?.cli.detail === undefined ? null : (
            <span className="metric-meta">{provider.cli.detail}</span>
          )}
        </div>
        {usageRows.map((row) => (
          <div className="aws-setup-item" key={row.label}>
            <span className="metric-label">{row.label}</span>
            <strong>{row.value}</strong>
            <span className="metric-meta">{row.meta}</span>
          </div>
        ))}
        {provider === null || usageRows.length > 0 ? null : (
          <div className="aws-setup-item">
            <span className="metric-label">{labels.localCliStatusLine}</span>
            <strong>{hasUsage ? labels.localCliUsageSource : labels.localCliNoUsage}</strong>
            <span className="metric-meta">{provider.usage.source}</span>
          </div>
        )}
      </div>
      <div className="credential-actions aws-setup-actions">
        <button className="ghost-button" disabled={loading} onClick={() => void refreshStatus()} type="button">
          <RefreshCw aria-hidden="true" size={13} strokeWidth={2} />
          <span>{labels.refreshLocalCliStatus}</span>
        </button>
      </div>
      {error === null ? null : <p className="credential-error" role="alert">{error}</p>}
    </div>
  );
}

function ToolLoadingProgress({
  active,
  label,
  percent,
  task,
}: {
  active: boolean;
  label: string;
  percent: number;
  task: string;
}) {
  if (!active) {
    return null;
  }

  const value = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="tool-loading-panel" role="status" aria-live="polite">
      <div className="tool-loading-header">
        <span className="metric-label">{label}</span>
        <strong>{value}%</strong>
      </div>
      <div
        aria-label={task}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={value}
        className="tool-loading-track"
        role="progressbar"
      >
        <span className="tool-loading-bar" style={{ width: `${value}%` }} />
      </div>
      <p className="tool-loading-task">{task}</p>
    </div>
  );
}

function useToolLoadingProgress(active: boolean, tasks: readonly string[]): { percent: number; task: string } {
  const taskKey = tasks.join("\u001f");
  const [progress, setProgress] = useState(() => ({
    percent: active ? 10 : 100,
    task: tasks[0] ?? "",
  }));

  useEffect(() => {
    const taskList = taskKey.split("\u001f").filter((task) => task.length > 0);

    if (!active) {
      setProgress({
        percent: 100,
        task: taskList[taskList.length - 1] ?? "",
      });
      return;
    }

    let tick = 0;
    setProgress({
      percent: 10,
      task: taskList[0] ?? "",
    });

    const interval = window.setInterval(() => {
      tick += 1;

      const percent = Math.min(92, 10 + tick * 11);
      const taskIndex = taskList.length === 0
        ? 0
        : Math.min(taskList.length - 1, Math.floor((percent / 100) * taskList.length));

      setProgress({
        percent,
        task: taskList[taskIndex] ?? "",
      });
    }, 450);

    return () => window.clearInterval(interval);
  }, [active, taskKey]);

  return progress;
}

function isLocalAiCliProvider(providerKey: ProviderKey): providerKey is "codex-cli" | "claude-cli" {
  return providerKey === "codex-cli" || providerKey === "claude-cli";
}

function localCliUsageRows(
  provider: LocalAiCliProviderStatusPayload | null,
  labels: CredentialControlLabels,
): Array<{ label: string; value: string; meta: string }> {
  if (provider === null) {
    return [];
  }

  const usage = provider.usage;
  const statusLine = usage.statusLine;
  const rows: Array<{ label: string; value: string; meta: string }> = [];

  rows.push({
    label: labels.localCliContextWindow,
    value: formatTokenWindow(statusLine.contextWindowTokens, statusLine.contextWindowLimit, statusLine.contextWindowPercent),
    meta: provider.providerKey === "codex-cli" ? labels.localCliLastRequest : labels.localCliCurrentUsage,
  });

  if (provider.providerKey === "codex-cli") {
    rows.push({
      label: labels.localCliLastRequest,
      value: formatTokens(statusLine.lastTotalTokens),
      meta: tokenParts([
        ["in", statusLine.lastInputTokens],
        ["out", statusLine.lastOutputTokens],
        ["cache", statusLine.lastCacheTokens],
      ]),
    });
    rows.push({
      label: labels.localCliSessionTokens,
      value: formatTokens(statusLine.totalTokens ?? usage.totalTokens),
      meta: tokenParts([
        ["in", statusLine.totalInputTokens ?? usage.inputTokens],
        ["out", statusLine.totalOutputTokens ?? usage.outputTokens],
        ["cache", statusLine.totalCacheTokens ?? usage.cacheTokens],
      ]),
    });
    rows.push({
      label: labels.localCliReasoning,
      value: formatTokens(statusLine.totalReasoningTokens ?? usage.reasoningOutputTokens),
      meta: `${labels.localCliLastRequest}: ${formatTokens(statusLine.lastReasoningTokens)}`,
    });
  } else {
    rows.push({
      label: labels.localCliCurrentUsage,
      value: tokenParts([
        ["in", statusLine.lastInputTokens],
        ["out", statusLine.lastOutputTokens],
        ["cache", statusLine.lastCacheTokens],
      ]),
      meta: labels.localCliStatusLine,
    });
    rows.push({
      label: labels.localCliSessionTokens,
      value: formatTokens(statusLine.totalTokens ?? usage.totalTokens),
      meta: tokenParts([
        ["in", statusLine.totalInputTokens ?? usage.inputTokens],
        ["out", statusLine.totalOutputTokens ?? usage.outputTokens],
        ["cache", statusLine.totalCacheTokens ?? usage.cacheTokens],
      ]),
    });
  }

  rows.push({
    label: labels.localCliLogFiles,
    value: `${usage.logFileCount}`,
    meta: usage.latestActivityAt ?? labels.localCliNoUsage,
  });

  return rows;
}

function localCliRemainingRows(
  provider: LocalAiCliProviderStatusPayload | null,
  labels: CredentialControlLabels,
): Array<{ label: string; percent: string; resetAt: string }> {
  if (provider === null) {
    return [];
  }

  const statusLine = provider.usage.statusLine;

  return [
    {
      label: labels.localCliFiveHourWindow,
      percent: formatRemainingPercent(
        statusLine.fiveHourRemainingTokens,
        statusLine.fiveHourLimitTokens,
        statusLine.fiveHourLimitPercent,
      ),
      resetAt: formatResetAt(statusLine.fiveHourResetAt),
    },
    {
      label: labels.localCliWeeklyWindow,
      percent: formatRemainingPercent(
        statusLine.weeklyRemainingTokens,
        statusLine.weeklyLimitTokens,
        statusLine.weeklyLimitPercent,
      ),
      resetAt: formatResetAt(statusLine.weeklyResetAt),
    },
  ];
}

function formatTokenWindow(tokens: number | null, limit: number | null, percent: number | null): string {
  if (tokens === null) {
    return "-";
  }

  if (limit === null) {
    return formatTokens(tokens);
  }

  const percentLabel = percent === null ? "" : ` (${formatPercent(percent)})`;

  return `${formatTokens(tokens)} / ${formatTokens(limit)}${percentLabel}`;
}

function tokenParts(parts: Array<[string, number | null]>): string {
  const values = parts
    .filter(([, value]) => value !== null && value > 0)
    .map(([label, value]) => `${label} ${formatTokens(value)}`);

  return values.length === 0 ? "-" : values.join(" · ");
}

function formatTokenWindowMeta(remaining: number | null, resetAt: string | null, labels: CredentialControlLabels): string {
  const parts = [
    remaining === null ? null : `${labels.localCliRemaining}: ${formatTokens(remaining)}`,
    resetAt === null ? null : `${labels.localCliResetAt}: ${resetAt}`,
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? labels.localCliCurrentUsage : parts.join(" · ");
}

function formatRemainingPercent(remaining: number | null, limit: number | null, usedPercent: number | null): string {
  if (remaining !== null && limit !== null && limit > 0) {
    return formatPercent((remaining / limit) * 100);
  }

  if (usedPercent !== null) {
    return formatPercent(Math.max(100 - usedPercent, 0));
  }

  return "-";
}

function formatResetAt(resetAt: string | null): string {
  if (resetAt === null || resetAt.trim().length === 0) {
    return "-";
  }

  const date = new Date(resetAt);

  if (Number.isNaN(date.getTime())) {
    return resetAt;
  }

  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "long", day: "numeric" }).format(date);
}

function formatTokens(value: number | null): string {
  if (value === null || value <= 0) {
    return "-";
  }

  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}%`;
}

function localCliStateLabel(state: LocalAiCliProviderStatusPayload["cli"]["state"], labels: CredentialControlLabels): string {
  if (state === "installed") {
    return labels.localCliInstalled;
  }

  if (state === "missing") {
    return labels.localCliMissing;
  }

  return labels.localCliCheckFailed;
}

function badgeClassForLocalCli(state: LocalAiCliProviderStatusPayload["cli"]["state"]): string {
  if (state === "installed") {
    return "badge-ok";
  }

  if (state === "missing") {
    return "badge-warn";
  }

  return "badge-critical";
}

function AwsSetupPanel({ labels }: { labels: CredentialControlLabels }) {
  const [status, setStatus] = useState<AwsLocalSetupStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const loadingProgress = useToolLoadingProgress(loading, [
    labels.toolLoadingCheckingCli,
    labels.toolLoadingCheckingCredentials,
    labels.toolLoadingPreparingView,
  ]);

  async function refreshStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/local-tools/aws", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("AWS local setup status unavailable.");
      }

      setStatus(await response.json() as AwsLocalSetupStatusPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AWS local setup status unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    const currentProfile = status?.credentialChain.profileName ?? "";

    if (currentProfile.length > 0 && profileName.trim().length === 0) {
      setProfileName(currentProfile);
    }
  }, [profileName, status?.credentialChain.profileName]);

  async function saveProfileGlobally(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileSaveError(null);
    setProfileSaveMessage(null);

    try {
      const session = await createSessionOrThrow(labels.awsProfilePersistError);
      const response = await fetch("/api/local-tools/aws/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-stackspend-csrf": session.csrfToken,
        },
        body: JSON.stringify({
          profileName,
        }),
      });

      if (!response.ok) {
        setProfileSaveError(await responseError(response, labels.awsProfilePersistError));
        return;
      }

      const payload = await response.json() as AwsProfilePersistPayload;
      setProfileName(payload.profileName);
      setProfileSaveMessage(`${labels.awsProfilePersistSuccess} ${payload.restartHint}`);
      await refreshStatus();
    } catch (caught) {
      setProfileSaveError(caught instanceof Error ? caught.message : labels.awsProfilePersistError);
    } finally {
      setSavingProfile(false);
    }
  }

  const cliState = status?.awsCli.state ?? null;
  const credentialConfigured = status?.credentialChain.state === "configured";
  const installUrl = status?.docs.installUrl ?? "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html";
  const ssoUrl = status?.docs.ssoUrl ?? "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html";

  return (
    <div className="aws-setup-panel">
      <div className="aws-setup-header">
        <div>
          <div className="aws-setup-title">
            <Terminal aria-hidden="true" size={15} strokeWidth={2} />
            <strong>{labels.awsCliTitle}</strong>
          </div>
          <p className="credential-hint">{labels.awsManaged}</p>
        </div>
        <span className={`badge ${cliState === null ? "badge-neutral" : badgeClassForAwsCli(cliState)}`}>
          {cliState === null && loading ? "..." : awsCliStateLabel(cliState ?? "error", labels)}
        </span>
      </div>
      <ToolLoadingProgress
        active={loading}
        label={labels.toolLoadingTitle}
        percent={loadingProgress.percent}
        task={loadingProgress.task}
      />
      <div className="aws-setup-grid">
        <div className="aws-setup-item">
          <span className="metric-label">{labels.awsCliVersion}</span>
          <strong>{status?.awsCli.version ?? (loading ? "..." : "-")}</strong>
          {status?.awsCli.detail === null || status?.awsCli.detail === undefined ? null : (
            <span className="metric-meta">{status.awsCli.detail}</span>
          )}
        </div>
        <div className="aws-setup-item">
          <span className="metric-label">{labels.awsCredentialChain}</span>
          <strong>{credentialConfigured ? labels.awsCredentialConfigured : labels.awsCredentialMissing}</strong>
          <span className="metric-meta">{awsCredentialDetail(status)}</span>
        </div>
      </div>
      <p className="credential-hint">{labels.awsCliCommandHint}</p>
      <div className="aws-command-strip" aria-label="AWS CLI setup commands">
        {(status?.commands ?? ["aws --version", "aws configure sso", "aws sso login --profile <profile>"]).map((command) => (
          <code key={command}>{command}</code>
        ))}
      </div>
      <form className="aws-profile-form" onSubmit={(event) => void saveProfileGlobally(event)}>
        <label className="credential-field">
          <span className="metric-label">{labels.awsProfileName}</span>
          <input
            autoComplete="off"
            className="credential-input"
            maxLength={80}
            onChange={(event) => {
              setProfileName(event.target.value);
              setProfileSaveError(null);
              setProfileSaveMessage(null);
            }}
            placeholder="stackspend-readonly"
            type="text"
            value={profileName}
          />
        </label>
        <button className="primary-button" disabled={savingProfile || profileName.trim().length === 0} type="submit">
          {labels.registerAwsProfileGlobally}
        </button>
      </form>
      <p className="credential-hint">{labels.awsProfilePersistHint}</p>
      <div className="credential-actions aws-setup-actions">
        <a className="primary-button" href={installUrl} rel="noreferrer" target="_blank">
          <span>{labels.installAwsCli}</span>
          <ExternalLink aria-hidden="true" size={13} strokeWidth={2} />
        </a>
        <a className="ghost-button" href={ssoUrl} rel="noreferrer" target="_blank">
          <span>{labels.configureAwsSso}</span>
          <ExternalLink aria-hidden="true" size={13} strokeWidth={2} />
        </a>
        <button className="ghost-button" disabled={loading} onClick={() => void refreshStatus()} type="button">
          <RefreshCw aria-hidden="true" size={13} strokeWidth={2} />
          <span>{labels.refreshAwsCliStatus}</span>
        </button>
      </div>
      {profileSaveMessage === null ? null : <p className="credential-success" role="status">{profileSaveMessage}</p>}
      {profileSaveError === null ? null : <p className="credential-error" role="alert">{profileSaveError}</p>}
      {error === null ? null : <p className="credential-error" role="alert">{error}</p>}
    </div>
  );
}

function GcpSetupPanel({ labels }: { labels: CredentialControlLabels }) {
  const [status, setStatus] = useState<GcpLocalSetupStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingProgress = useToolLoadingProgress(loading, [
    labels.toolLoadingCheckingCli,
    labels.toolLoadingCheckingCredentials,
    labels.toolLoadingPreparingView,
  ]);

  async function refreshStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/local-tools/gcp", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Google Cloud local setup status unavailable.");
      }

      setStatus(await response.json() as GcpLocalSetupStatusPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google Cloud local setup status unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  const cliState = status?.gcloudCli.state ?? null;
  const installUrl = status?.docs.installUrl ?? "https://docs.cloud.google.com/sdk/docs/install";
  const authUrl = status?.docs.authUrl ?? "https://docs.cloud.google.com/docs/authentication/gcloud";
  const adcUrl = status?.docs.adcUrl ?? "https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/login";

  return (
    <div className="aws-setup-panel">
      <div className="aws-setup-header">
        <div>
          <div className="aws-setup-title">
            <Terminal aria-hidden="true" size={15} strokeWidth={2} />
            <strong>{labels.gcpCliTitle}</strong>
          </div>
          <p className="credential-hint">{labels.gcpManaged}</p>
        </div>
        <span className={`badge ${cliState === null ? "badge-neutral" : badgeClassForGcpCli(cliState)}`}>
          {cliState === null && loading ? "..." : gcpCliStateLabel(cliState ?? "error", labels)}
        </span>
      </div>
      <ToolLoadingProgress
        active={loading}
        label={labels.toolLoadingTitle}
        percent={loadingProgress.percent}
        task={loadingProgress.task}
      />
      <div className="aws-setup-grid">
        <div className="aws-setup-item">
          <span className="metric-label">{labels.awsCliVersion}</span>
          <strong>{status?.gcloudCli.version ?? (loading ? "..." : "-")}</strong>
          {status?.gcloudCli.detail === null || status?.gcloudCli.detail === undefined ? null : (
            <span className="metric-meta">{status.gcloudCli.detail}</span>
          )}
        </div>
        <div className="aws-setup-item">
          <span className="metric-label">{labels.gcpAccount}</span>
          <strong>{stateLabel(status?.account.state, labels)}</strong>
          <span className="metric-meta">{status?.account.activeAccountHint ?? "gcloud auth login"}</span>
        </div>
        <div className="aws-setup-item">
          <span className="metric-label">{labels.gcpProject}</span>
          <strong>{stateLabel(status?.project.state, labels)}</strong>
          <span className="metric-meta">{status?.project.projectIdHint ?? "gcloud config set project <project-id>"}</span>
        </div>
        <div className="aws-setup-item">
          <span className="metric-label">{labels.gcpAdc}</span>
          <strong>{stateLabel(status?.adc.state, labels)}</strong>
          <span className="metric-meta">{gcpAdcDetail(status)}</span>
        </div>
      </div>
      <p className="credential-hint">{labels.gcpCliCommandHint}</p>
      <div className="aws-command-strip" aria-label="Google Cloud CLI setup commands">
        {(status?.commands ?? ["gcloud --version", "gcloud auth login", "gcloud auth application-default login"]).map((command) => (
          <code key={command}>{command}</code>
        ))}
      </div>
      <div className="credential-actions aws-setup-actions">
        <a className="primary-button" href={installUrl} rel="noreferrer" target="_blank">
          <span>{labels.installGcloudCli}</span>
          <ExternalLink aria-hidden="true" size={13} strokeWidth={2} />
        </a>
        <a className="ghost-button" href={authUrl} rel="noreferrer" target="_blank">
          <span>{labels.configureGcloudAuth}</span>
          <ExternalLink aria-hidden="true" size={13} strokeWidth={2} />
        </a>
        <a className="ghost-button" href={adcUrl} rel="noreferrer" target="_blank">
          <span>{labels.configureGcloudAdc}</span>
          <ExternalLink aria-hidden="true" size={13} strokeWidth={2} />
        </a>
        <button className="ghost-button" disabled={loading} onClick={() => void refreshStatus()} type="button">
          <RefreshCw aria-hidden="true" size={13} strokeWidth={2} />
          <span>{labels.refreshGcpCliStatus}</span>
        </button>
      </div>
      {error === null ? null : <p className="credential-error" role="alert">{error}</p>}
    </div>
  );
}

function gcpCliStateLabel(state: GcpLocalSetupStatusPayload["gcloudCli"]["state"], labels: CredentialControlLabels): string {
  if (state === "installed") {
    return labels.gcpCliInstalled;
  }

  if (state === "missing") {
    return labels.gcpCliMissing;
  }

  return labels.gcpCliError;
}

function stateLabel(state: "configured" | "missing" | undefined, labels: CredentialControlLabels): string {
  if (state === "configured") {
    return labels.gcpConfigured;
  }

  return labels.gcpMissing;
}

function badgeClassForGcpCli(state: GcpLocalSetupStatusPayload["gcloudCli"]["state"]): string {
  if (state === "installed") {
    return "badge-ok";
  }

  if (state === "missing") {
    return "badge-warn";
  }

  return "badge-critical";
}

function gcpAdcDetail(status: GcpLocalSetupStatusPayload | null): string {
  if (status === null) {
    return "-";
  }

  if (status.adc.source === "GOOGLE_APPLICATION_CREDENTIALS") {
    return "GOOGLE_APPLICATION_CREDENTIALS";
  }

  if (status.adc.source === "application_default_credentials") {
    return "application_default_credentials.json";
  }

  return "gcloud auth application-default login";
}

function awsCliStateLabel(state: AwsLocalSetupStatusPayload["awsCli"]["state"], labels: CredentialControlLabels): string {
  if (state === "installed") {
    return labels.awsCliInstalled;
  }

  if (state === "missing") {
    return labels.awsCliMissing;
  }

  return labels.awsCliError;
}

function awsCredentialDetail(status: AwsLocalSetupStatusPayload | null): string {
  if (status === null) {
    return "-";
  }

  if (status.credentialChain.source === "AWS_PROFILE") {
    return `AWS_PROFILE=${status.credentialChain.profileName ?? ""}`;
  }

  if (status.credentialChain.source === "access_key_env") {
    return "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY";
  }

  return "AWS_PROFILE";
}

function badgeClassForAwsCli(state: AwsLocalSetupStatusPayload["awsCli"]["state"]): string {
  if (state === "installed") {
    return "badge-ok";
  }

  if (state === "missing") {
    return "badge-warn";
  }

  return "badge-critical";
}

async function createSessionOrThrow(fallback: string): Promise<{ csrfToken: string }> {
  const sessionResponse = await fetch("/api/auth/session", {
    method: "POST",
  });

  if (!sessionResponse.ok) {
    throw new Error(await responseError(sessionResponse, fallback));
  }

  const session = await sessionResponse.json() as { csrfToken?: string };
  const csrfToken = session.csrfToken ?? "";

  if (csrfToken.length === 0) {
    throw new Error(fallback);
  }

  return {
    csrfToken,
  };
}

function shortConnectionId(connectionId: string): string {
  return connectionId.length <= 10 ? connectionId : connectionId.slice(-8);
}

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };

    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return `${fallback} ${payload.error}`;
    }
  } catch {
    // Fall through to the generic message when the response is not JSON.
  }

  return fallback;
}
