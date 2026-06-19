import { describe, expect, it } from "vitest";
import { resetCreditErrorRemediation } from "./remediation";
import type { ResetCreditErrorCode } from "./types";

const ERROR_CODES = [
  "LOCAL_CODEX_AUTH_UNAVAILABLE",
  "AUTH_FILE_NOT_FOUND",
  "AUTH_FILE_PERMISSION_DENIED",
  "AUTH_FILE_INVALID_JSON",
  "ACCESS_TOKEN_NOT_FOUND",
  "ACCOUNT_ID_NOT_FOUND",
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
    expect(remediation.actions.every((action) => action.length > 0)).toBe(true);
  });

  it("guides expired login tokens to codex login", () => {
    const remediation = resetCreditErrorRemediation("UPSTREAM_UNAUTHORIZED");

    expect(remediation.actions.join("\n")).toContain("codex login");
  });

  it("explains API key behavior for browser and scripted API calls", () => {
    const remediation = resetCreditErrorRemediation("API_UNAUTHORIZED");
    const actions = remediation.actions.join("\n");

    expect(actions).toContain("Authorization: Bearer");
    expect(actions).toContain("RESET_CREDIT_API_KEY");
  });
});
