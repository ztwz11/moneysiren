"use client";

import { AlertTriangle } from "lucide-react";
import type { ResetCreditApiFailure } from "../../lib/codex-reset-credits/types";
import { resetCreditErrorRemediation } from "../../lib/codex-reset-credits/remediation";

const TEXT = {
  title: "\uc870\ud68c \uc2e4\ud328",
  likelyCause: "\uc608\uc0c1 \uc6d0\uc778",
  nextActions: "\uc870\uce58 \ubc29\ubc95",
};

export function ResetCreditError({ error }: { error: ResetCreditApiFailure["error"] }) {
  const remediation = resetCreditErrorRemediation(error.code);

  return (
    <section className="panel reset-credit-error" role="alert">
      <div className="reset-credit-error-title">
        <AlertTriangle aria-hidden="true" size={18} />
        <h2>{TEXT.title}: {remediation.title}</h2>
      </div>
      <p>{error.message}</p>
      <code>{error.code}</code>
      <div className="reset-credit-remediation">
        <div>
          <h3>{TEXT.likelyCause}</h3>
          <p>{remediation.cause}</p>
        </div>
        <div>
          <h3>{TEXT.nextActions}</h3>
          <ul>
            {remediation.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
