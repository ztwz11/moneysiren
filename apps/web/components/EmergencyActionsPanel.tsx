import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  buildEmergencyActionPlan,
  type EmergencyActionCandidate,
  type EmergencySafeCommand,
} from "../lib/emergency-actions";
import type { Locale, Messages } from "../lib/i18n";
import type { OperationsProvider } from "../lib/operations-data";

export function EmergencyActionsPanel({
  locale,
  messages,
  provider,
}: {
  locale: Locale;
  messages: Messages;
  provider: OperationsProvider;
}) {
  const plan = buildEmergencyActionPlan(provider);

  return (
    <div className="stack">
      <p className="muted">{messages.services.emergencyPlanned}</p>
      <div className="badge-row">
        <StatusBadge messages={messages} state={plan.emergencyAccessState} />
        <StatusBadge messages={messages} state={plan.emergencyCredentialState} />
        {plan.highestSeverity === "none" ? null : (
          <StatusBadge messages={messages} state={plan.highestSeverity} />
        )}
      </div>
      <div>
        <div className="metric-label">{messages.services.emergencyCandidateCount}</div>
        <div>{plan.candidateCount}</div>
      </div>
      <div>
        <div className="metric-label">{messages.services.emergencyCredentialState}</div>
        <div>{labelFor(messages, plan.emergencyCredentialState)}</div>
      </div>
      <p className="metric-meta">{messages.services.emergencyManualOnly}</p>
      {plan.candidates.length === 0 ? (
        <p className="muted">{messages.services.emergencyNoCandidates}</p>
      ) : (
        <div className="service-remediation-list">
          {plan.candidates.map((candidate) => (
            <EmergencyCandidateCard
              candidate={candidate}
              key={candidate.id}
              messages={messages}
            />
          ))}
        </div>
      )}
      <Link className="ghost-button" href={`/${locale}/settings/connections#${provider.providerKey}`}>
        {messages.services.viewRequirements}
      </Link>
    </div>
  );
}

function EmergencyCandidateCard({
  candidate,
  messages,
}: {
  candidate: EmergencyActionCandidate;
  messages: Messages;
}) {
  const providerConsoleHref = safeProviderConsoleHref(candidate.providerConsoleHref);

  return (
    <article className={`service-remediation-item service-remediation-item-${candidate.severity}`}>
      <div>
        <strong>{candidate.title}</strong>
        <p>{candidate.description}</p>
      </div>
      <div className="badge-row">
        <StatusBadge messages={messages} state={candidate.readiness} />
        <StatusBadge messages={messages} state={candidate.severity} />
        <span className="badge badge-neutral">{candidate.mode}</span>
      </div>
      <div>
        <div className="metric-label">{messages.services.emergencyChecklist}</div>
        <ul>
          {candidate.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="metric-label">{messages.services.emergencySafeCommands}</div>
        <div className="badge-row">
          {candidate.safeCommands.map((command) => (
            <span className="badge badge-neutral" key={command}>{safeCommandLabel(messages, command)}</span>
          ))}
        </div>
      </div>
      {providerConsoleHref === undefined ? null : (
        <a className="ghost-button" href={providerConsoleHref} rel="noreferrer" target="_blank">
          <span>{safeCommandLabel(messages, "open_provider_console")}</span>
          <ExternalLink aria-hidden="true" size={14} />
        </a>
      )}
    </article>
  );
}

function StatusBadge({ messages, state }: { messages: Messages; state: string }) {
  return <span className={`badge ${badgeClassFor(state)}`}>{labelFor(messages, state)}</span>;
}

function labelFor(messages: Messages, state: string): string {
  return messages.states[state] ?? state.replace(/[_-]+/g, " ");
}

function safeCommandLabel(messages: Messages, command: EmergencySafeCommand): string {
  if (command === "view_requirements") {
    return messages.services.emergencyCommandViewRequirements;
  }

  if (command === "open_runbook") {
    return messages.services.emergencyCommandOpenRunbook;
  }

  if (command === "open_provider_console") {
    return messages.services.emergencyCommandOpenProviderConsole;
  }

  return messages.services.emergencyCommandCopyManualChecklist;
}

function safeProviderConsoleHref(value: string | undefined): string | undefined {
  if (value === undefined || !value.startsWith("https://") || value.includes("[REDACTED:")) {
    return undefined;
  }

  return value;
}

function badgeClassFor(state: string): string {
  if (state === "ok" ||
    state === "fresh" ||
    state === "live" ||
    state === "low" ||
    state === "read_only_ready" ||
    state === "manual_ready" ||
    state === "dry_run_ready") {
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
    state === "emergency_planned" ||
    state === "missing_emergency_credential" ||
    state === "requires_confirmation"
  ) {
    return "badge-warn";
  }

  return "badge-neutral";
}
