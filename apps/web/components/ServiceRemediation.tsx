import type { Locale } from "../lib/i18n";
import {
  buildServiceRemediation,
  hasServiceRemediation,
  serviceRemediationSummary,
  serviceRemediationTableHeader,
  type ServiceRemediationInput,
} from "../lib/service-remediation";

export function ServiceRemediationPanel({
  locale,
  service,
}: {
  locale: Locale;
  service: ServiceRemediationInput;
}) {
  const remediation = buildServiceRemediation(service, locale);

  if (remediation.items.length === 0) {
    return null;
  }

  return (
    <section className="panel service-remediation-panel">
      <div className="panel-header compact-header">
        <h2 className="panel-title">{remediation.heading}</h2>
        <span className={`badge ${badgeClassFor(remediation.items[0]?.severity ?? "info")}`}>
          {remediation.items.length}
        </span>
      </div>
      <div className="service-remediation-list">
        {remediation.items.map((item) => (
          <article className={`service-remediation-item service-remediation-item-${item.severity}`} key={item.code}>
            <div>
              <strong>{item.title}</strong>
              <p>{item.cause}</p>
            </div>
            <ul>
              {item.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ServiceRemediationSummary({
  locale,
  service,
}: {
  locale: Locale;
  service: ServiceRemediationInput;
}) {
  const hasIssue = hasServiceRemediation(service, locale);

  return (
    <span className={hasIssue ? "service-remediation-summary" : "service-remediation-summary service-remediation-summary-ok"}>
      {serviceRemediationSummary(service, locale)}
    </span>
  );
}

export function ServiceRemediationHeader({ locale }: { locale: Locale }) {
  return <>{serviceRemediationTableHeader(locale)}</>;
}

function badgeClassFor(severity: "info" | "warning" | "critical"): string {
  if (severity === "critical") {
    return "badge-critical";
  }

  if (severity === "warning") {
    return "badge-warn";
  }

  return "badge-live";
}
