import { describe, expect, it } from "vitest";
import { resetCreditErrorRemediation } from "./remediation";
import type { ResetCreditErrorCode } from "./types";

const ERROR_CODES = [
  "UPSTREAM_UNAUTHORIZED",
  "UPSTREAM_FORBIDDEN",
  "UPSTREAM_RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_INVALID_JSON",
  "UPSTREAM_INVALID_RESPONSE",
  "API_UNAUTHORIZED",
  "CRON_SECRET_NOT_CONFIGURED",
] as const satisfies readonly ResetCreditErrorCode[];

describe("Codex reset credit error remediation", () => {
  it.each(ERROR_CODES)("returns user actions for %s", (code) => {
    const remediation = resetCreditErrorRemediation(code);
    expect(remediation.title.length).toBeGreaterThan(0);
    expect(remediation.cause.length).toBeGreaterThan(0);
    expect(remediation.actions.length).toBeGreaterThanOrEqual(2);
  });

  it("guides App Server login failures to codex login", () => {
    expect(resetCreditErrorRemediation("UPSTREAM_UNAUTHORIZED").actions.join("\n"))
      .toContain("codex login");
  });

  it("contains no direct auth-file or internal-endpoint guidance", () => {
    const text = ERROR_CODES
      .map((code) => JSON.stringify(resetCreditErrorRemediation(code)))
      .join("\n");
    expect(text).not.toContain("auth.json");
    expect(text).not.toContain("CODEX_AUTH_FILE");
    expect(text).not.toContain("CODEX_RESET_CREDIT_ENDPOINT");
    expect(text).not.toContain("backend-api");
  });
});
