import { describe, expect, it } from "vitest";
import {
  buildServiceRemediation,
  serviceRemediationSummary,
  type ServiceRemediationInput,
} from "./service-remediation";

describe("service remediation", () => {
  it("returns no action for a healthy service", () => {
    const remediation = buildServiceRemediation(healthyService(), "en");

    expect(remediation.items).toHaveLength(0);
    expect(serviceRemediationSummary(healthyService(), "en")).toBe("No action needed");
  });

  it("shows credential setup actions for missing OpenAI credentials", () => {
    const service = healthyService({
      providerKey: "openai",
      displayName: "OpenAI",
      connectionState: "not_configured",
      liveFreshness: "not_configured",
      missingEnvKeys: ["OPENAI_ADMIN_KEY"],
      requiredEnvKeys: ["OPENAI_ADMIN_KEY"],
      setupLinks: [{ label: "Admin API keys", href: "https://example.invalid/openai" }],
    });
    const remediation = buildServiceRemediation(service, "en");
    const actions = remediation.items.flatMap((item) => item.actions).join("\n");

    expect(remediation.items.map((item) => item.code)).toContain("connection_not_configured");
    expect(actions).toContain("OPENAI_ADMIN_KEY");
    expect(actions).toContain("organization Admin API key");
  });

  it("shows AWS SSO and Cost Explorer actions for live errors", () => {
    const service = healthyService({
      providerKey: "aws",
      displayName: "AWS",
      liveFreshness: "error",
      healthStatus: "unknown",
      riskLevel: "warning",
      missingEnvKeys: [],
      requiredEnvKeys: ["AWS_PROFILE"],
    });
    const remediation = buildServiceRemediation(service, "en");
    const actions = remediation.items.flatMap((item) => item.actions).join("\n");

    expect(remediation.items[0]?.severity).toBe("critical");
    expect(actions).toContain("aws sso login");
    expect(actions).toContain("ce:GetCostAndUsage");
  });

  it("shows local CLI log guidance for missing Codex usage", () => {
    const service = healthyService({
      providerKey: "codex-cli",
      displayName: "Codex CLI",
      liveGranularity: "usage_only",
      currentUsageSummary: null,
      todayLiveAmountMinor: null,
      todayLiveIncluded: false,
    });
    const remediation = buildServiceRemediation(service, "en");
    const actions = remediation.items.flatMap((item) => item.actions).join("\n");

    expect(remediation.items.map((item) => item.code)).toContain("usage_missing");
    expect(actions).toContain("CODEX_HOME");
  });

  it("keeps Korean remediation available without exposing secrets", () => {
    const service = healthyService({
      providerKey: "cloudflare",
      displayName: "Cloudflare",
      connectionState: "not_configured",
      missingEnvKeys: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_IDS"],
      requiredEnvKeys: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_IDS"],
    });
    const remediation = buildServiceRemediation(service, "ko");
    const payload = JSON.stringify(remediation);

    expect(remediation.heading).toContain("\uc870\ud68c");
    expect(payload).toContain("CLOUDFLARE_API_TOKEN");
    expect(payload).not.toContain("sk-");
    expect(payload).not.toContain("Bearer ");
  });
});

function healthyService(patch: Partial<ServiceRemediationInput> = {}): ServiceRemediationInput {
  return {
    providerKey: "openai",
    displayName: "OpenAI",
    connectionState: "env_configured",
    readOnlyTestState: "read_only_ready",
    missingEnvKeys: [],
    requiredEnvKeys: [],
    canonicalFreshness: "fresh",
    liveFreshness: "live",
    liveGranularity: "daily_bucket",
    liveConfidence: "high",
    currentUsageSummary: {
      kind: "llm_subscription",
      period: "current_month",
      metrics: [],
      topServices: [],
    },
    latestCanonicalSync: "2026-06-19T00:00:00.000Z",
    latestLiveCheck: "2026-06-19T01:00:00.000Z",
    todayLiveAmountMinor: 100,
    todayLiveIncluded: true,
    healthStatus: "ok",
    riskLevel: "low",
    setupLinks: [],
    ...patch,
  };
}
