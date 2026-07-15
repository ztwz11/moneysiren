"use client";

import { ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Locale, Messages } from "../lib/i18n";
import type { OperationsProvider } from "../lib/operations-data";
import { ConnectionDiagnosticsToggle } from "./ConnectionDiagnosticsToggle";
import { CredentialControls } from "./CredentialControls";
import { ProviderIcon } from "./ProviderIcon";
import { ServiceRemediationPanel } from "./ServiceRemediation";

export function ConnectionCard({
  locale,
  messages,
  provider,
}: {
  locale: Locale;
  messages: Messages;
  provider: OperationsProvider;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <article className={expanded ? "connection-card" : "connection-card connection-card-collapsed"} id={provider.providerKey}>
      <header className="connection-card-header">
        <div className="provider-title-block">
          <ProviderIcon
            className={`provider-mark provider-mark-${provider.providerKey}`}
            providerKey={provider.providerKey}
          />
          <div>
            <div className="connection-title-line">
              <h2 className="connection-card-title">{provider.displayName}</h2>
              <SetupGuideLink provider={provider} messages={messages} />
            </div>
            <div className="metric-meta">{provider.authMethod}</div>
          </div>
        </div>
        <div className="badge-row">
          <StatusBadge messages={messages} state={provider.connectionState} />
          <StatusBadge messages={messages} state={provider.readOnlyTestState} />
          <button
            aria-controls={`${provider.providerKey}-connection-body`}
            aria-expanded={expanded}
            aria-label={expanded ? messages.app.closeMenu : messages.app.menu}
            className="connection-collapse-button"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            <ChevronUp aria-hidden="true" className="collapse-icon" size={16} />
          </button>
        </div>
      </header>
      <div className="connection-card-body" hidden={!expanded} id={`${provider.providerKey}-connection-body`}>
        <div className="connection-action-panel">
          <CredentialControls
            providerKey={provider.providerKey}
            connections={provider.connections}
            labels={{
              savedConnections: messages.settings.savedConnections,
              connectionLabel: messages.settings.connectionLabel,
              connectionId: messages.settings.connectionId,
              requiredEnv: messages.settings.requiredEnv,
              credentialSecret: messages.settings.credentialSecret,
              accountIds: messages.settings.accountIds,
              openAiAdminKeyHint: messages.settings.openAiAdminKeyHint,
              envOnlySecrets: messages.settings.envOnlySecrets,
              credentialSaveError: messages.settings.credentialSaveError,
              credentialDeleteError: messages.settings.credentialDeleteError,
              saveCredential: messages.settings.saveCredential,
              saveCredentialAndSync: messages.settings.saveCredentialAndSync,
              openAiFirstSyncRunning: messages.settings.openAiFirstSyncRunning,
              openAiFirstSyncSuccess: messages.settings.openAiFirstSyncSuccess,
              openAiFirstSyncPartial: messages.settings.openAiFirstSyncPartial,
              openAiFirstSyncValidationError: messages.settings.openAiFirstSyncValidationError,
              openAiFirstSyncSaveError: messages.settings.openAiFirstSyncSaveError,
              openAiFirstSyncUnknown: messages.settings.openAiFirstSyncUnknown,
              retryFirstSync: messages.settings.retryFirstSync,
              removeCredential: messages.settings.removeCredential,
              startOAuth: messages.settings.startOAuth,
              toolLoadingTitle: messages.settings.toolLoadingTitle,
              toolLoadingCheckingCli: messages.settings.toolLoadingCheckingCli,
              toolLoadingCheckingCredentials: messages.settings.toolLoadingCheckingCredentials,
              toolLoadingReadingUsage: messages.settings.toolLoadingReadingUsage,
              toolLoadingPreparingView: messages.settings.toolLoadingPreparingView,
              awsManaged: messages.settings.awsManaged,
              awsCliTitle: messages.settings.awsCliTitle,
              awsCliInstalled: messages.settings.awsCliInstalled,
              awsCliMissing: messages.settings.awsCliMissing,
              awsCliError: messages.settings.awsCliError,
              awsCliVersion: messages.settings.awsCliVersion,
              awsCredentialChain: messages.settings.awsCredentialChain,
              awsCredentialConfigured: messages.settings.awsCredentialConfigured,
              awsCredentialMissing: messages.settings.awsCredentialMissing,
              installAwsCli: messages.settings.installAwsCli,
              configureAwsSso: messages.settings.configureAwsSso,
              refreshAwsCliStatus: messages.settings.refreshAwsCliStatus,
              awsCliCommandHint: messages.settings.awsCliCommandHint,
              awsProfileName: messages.settings.awsProfileName,
              registerAwsProfileGlobally: messages.settings.registerAwsProfileGlobally,
              awsProfilePersistHint: messages.settings.awsProfilePersistHint,
              awsProfilePersistSuccess: messages.settings.awsProfilePersistSuccess,
              awsProfilePersistError: messages.settings.awsProfilePersistError,
              gcpManaged: messages.settings.gcpManaged,
              gcpCliTitle: messages.settings.gcpCliTitle,
              gcpCliInstalled: messages.settings.gcpCliInstalled,
              gcpCliMissing: messages.settings.gcpCliMissing,
              gcpCliError: messages.settings.gcpCliError,
              gcpAccount: messages.settings.gcpAccount,
              gcpProject: messages.settings.gcpProject,
              gcpAdc: messages.settings.gcpAdc,
              gcpConfigured: messages.settings.gcpConfigured,
              gcpMissing: messages.settings.gcpMissing,
              installGcloudCli: messages.settings.installGcloudCli,
              configureGcloudAuth: messages.settings.configureGcloudAuth,
              configureGcloudAdc: messages.settings.configureGcloudAdc,
              refreshGcpCliStatus: messages.settings.refreshGcpCliStatus,
              gcpCliCommandHint: messages.settings.gcpCliCommandHint,
              localCliTitle: messages.settings.localCliTitle,
              localCliInstalled: messages.settings.localCliInstalled,
              localCliMissing: messages.settings.localCliMissing,
              localCliCheckFailed: messages.settings.localCliCheckFailed,
              localCliUsageSource: messages.settings.localCliUsageSource,
              localCliLatestActivity: messages.settings.localCliLatestActivity,
              localCliSessionsTurns: messages.settings.localCliSessionsTurns,
              localCliNoUsage: messages.settings.localCliNoUsage,
              localCliStatusLine: messages.settings.localCliStatusLine,
              localCliContextWindow: messages.settings.localCliContextWindow,
              localCliFiveHourLimit: messages.settings.localCliFiveHourLimit,
              localCliWeeklyLimit: messages.settings.localCliWeeklyLimit,
              localCliFiveHourWindow: messages.settings.localCliFiveHourWindow,
              localCliWeeklyWindow: messages.settings.localCliWeeklyWindow,
              localCliRemaining: messages.settings.localCliRemaining,
              localCliResetAt: messages.settings.localCliResetAt,
              localCliUsageResetCredits: messages.settings.localCliUsageResetCredits,
              localCliUsageResetCredit: messages.settings.localCliUsageResetCredit,
              localCliLearnMore: messages.settings.localCliLearnMore,
              localCliLastRequest: messages.settings.localCliLastRequest,
              localCliSessionTokens: messages.settings.localCliSessionTokens,
              localCliCurrentUsage: messages.settings.localCliCurrentUsage,
              localCliReasoning: messages.settings.localCliReasoning,
              localCliLogFiles: messages.settings.localCliLogFiles,
              refreshLocalCliStatus: messages.settings.refreshLocalCliStatus,
            }}
          />
        </div>
        <ConnectionDiagnosticsToggle locale={locale} provider={provider} />
        <div className="connection-requirements">
          <span className="metric-label">{messages.settings.requiredEnv}</span>
          <RequirementLinks provider={provider} messages={messages} />
        </div>
        <ServiceRemediationPanel locale={locale} service={provider} />
      </div>
    </article>
  );
}

function SetupGuideLink({ provider, messages }: { provider: OperationsProvider; messages: Messages }) {
  const link = provider.setupLinks[0];

  if (link === undefined) {
    return null;
  }

  return (
    <a className="connection-guide-link" href={link.href} rel="noreferrer" target="_blank">
      <span>{messages.settings.setupLinks}</span>
      <ExternalLink aria-hidden="true" size={12} strokeWidth={1.9} />
    </a>
  );
}

function RequirementLinks({ provider, messages }: { provider: OperationsProvider; messages: Messages }) {
  return (
    <div className="requirements-cell" aria-label={messages.settings.requiredValueLinks}>
      <div>{provider.requiredEnvKeys.join(", ")}</div>
      {provider.setupLinks.length === 0 ? null : (
        <div className="setup-link-list">
          <div className="metric-label">{messages.settings.setupLinks}</div>
          {provider.setupLinks.map((link) => (
            <a className="inline-link" href={link.href} key={link.href} rel="noreferrer" target="_blank">
              <span>{link.label}</span>
              <span className="metric-meta">{link.valueHints.join(", ")}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ messages, state }: { messages: Messages; state: string }) {
  return <span className={`badge ${badgeClassFor(state)}`}>{messages.states[state] ?? state}</span>;
}

function badgeClassFor(state: string): string {
  if (state === "ok" || state === "fresh" || state === "live" || state === "low" || state === "read_only_ready") {
    return "badge-ok";
  }

  if (state === "critical" || state === "down" || state === "error" || state === "invalid") {
    return "badge-critical";
  }

  if (
    state === "warning" ||
    state === "stale" ||
    state === "missing" ||
    state === "not_configured" ||
    state === "locked" ||
    state === "expired" ||
    state === "emergency_planned"
  ) {
    return "badge-warn";
  }

  if (state === "provisional" || state === "daily_bucket" || state === "month_to_date" || state === "current_period") {
    return "badge-live";
  }

  return "badge-neutral";
}
