import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  buildEmergencyActionPlan,
  type EmergencyActionCandidate,
  type EmergencySafeCommand,
} from "../lib/emergency-actions";
import {
  officialLinksForEmergencyCandidate,
  type EmergencyOfficialLink,
} from "../lib/emergency-official-links";
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
      <p className="metric-meta">{emergencySafetyCopy(locale)}</p>
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
              locale={locale}
              messages={messages}
              provider={provider}
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
  locale,
  messages,
  provider,
}: {
  candidate: EmergencyActionCandidate;
  locale: Locale;
  messages: Messages;
  provider: OperationsProvider;
}) {
  const officialLinks = officialLinksForEmergencyCandidate(provider, candidate);

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
      {officialLinks.length === 0 ? null : (
        <OfficialLinksList links={officialLinks} locale={locale} />
      )}
    </article>
  );
}

function OfficialLinksList({ links, locale }: { links: readonly EmergencyOfficialLink[]; locale: Locale }) {
  return (
    <div>
      <div className="metric-label">{officialLinksHeading(locale)}</div>
      <p className="metric-meta">{officialLinksSafetyCopy(locale)}</p>
      <div className="setup-link-list">
        {links.map((link) => (
          <a className="inline-link" href={link.href} key={link.href} rel="noreferrer" target="_blank">
            <span>
              {link.label}
              <ExternalLink aria-hidden="true" size={12} strokeWidth={1.9} />
            </span>
            <span className="metric-meta">{link.description}</span>
          </a>
        ))}
      </div>
    </div>
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

function emergencySafetyCopy(locale: Locale): string {
  if (locale === "ko") {
    return "긴급조치 준비도는 사용자를 공식 provider 화면으로 안내할 뿐, MoneySiren이 클라우드 리소스나 키를 직접 변경하지 않습니다.";
  }

  if (locale === "ja") {
    return "緊急対応の準備状況は公式プロバイダー画面への案内のみを行い、MoneySiren がクラウドリソースやキーを直接変更することはありません。";
  }

  return "Emergency readiness links only guide you to official provider pages. MoneySiren does not directly change cloud resources or keys.";
}

function officialLinksHeading(locale: Locale): string {
  if (locale === "ko") {
    return "공식 provider 링크";
  }

  if (locale === "ja") {
    return "公式プロバイダーリンク";
  }

  return "Official provider links";
}

function officialLinksSafetyCopy(locale: Locale): string {
  if (locale === "ko") {
    return "링크는 새 브라우저 탭에서 공식 콘솔이나 문서를 엽니다. 실제 변경은 해당 provider 화면에서 사용자가 직접 확인해야 합니다.";
  }

  if (locale === "ja") {
    return "リンクは新しいブラウザータブで公式コンソールまたはドキュメントを開きます。実際の変更は各プロバイダー画面でユーザーが確認して行います。";
  }

  return "Links open official consoles or documentation in a new browser tab. Any real change must be reviewed and performed on the provider site.";
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
