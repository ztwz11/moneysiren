import { describe, expect, it } from "vitest";
import { DEFAULT_DB_PATH } from "./schema.js";
import { loadStackSpendConfig } from "./load.js";

const FAKE_SLACK_WEBHOOK_URL = [
  "https://hooks.slack.com",
  "services",
  "TFAKE",
  "BFAKE",
  "CFAKE",
].join("/");

describe("loadStackSpendConfig", () => {
  it("uses the local SQLite default path and disables telemetry", () => {
    const config = loadStackSpendConfig({});

    expect(config.dbPath).toBe(DEFAULT_DB_PATH);
    expect(config.telemetryEnabled).toBe(false);
  });

  it("loads env-only provider readiness without exposing secret values", () => {
    const config = loadStackSpendConfig({
      AWS_PROFILE: "fake-local-profile",
      OPENAI_ADMIN_KEY: "sk-fake-openai-admin-key",
      SUPABASE_ACCESS_TOKEN: "sbp_fake_supabase_token",
      CLOUDFLARE_API_TOKEN: "fake-cloudflare-token",
      CLOUDFLARE_ACCOUNT_IDS: "fake-cloudflare-account-alpha",
      SLACK_WEBHOOK_URL: FAKE_SLACK_WEBHOOK_URL,
    });

    expect(config.providers.aws.configured).toBe(true);
    expect(config.providers.openai.configured).toBe(true);
    expect(config.providers.supabase.configured).toBe(true);
    expect(config.providers.cloudflare.configured).toBe(true);
    expect(config.slack.webhookConfigured).toBe(true);
    expect(JSON.stringify(config)).not.toContain("sk-fake-openai-admin-key");
    expect(JSON.stringify(config)).not.toContain(FAKE_SLACK_WEBHOOK_URL);
  });

  it("trims a custom DB path and rejects blank paths", () => {
    expect(loadStackSpendConfig({ STACKSPEND_DB_PATH: "  ./tmp/local.sqlite  " }).dbPath).toBe(
      "./tmp/local.sqlite",
    );

    expect(() => loadStackSpendConfig({ STACKSPEND_DB_PATH: "  " })).toThrow(
      /STACKSPEND_DB_PATH/i,
    );
  });

  it("rejects telemetry opt-in during v0.1", () => {
    expect(() => loadStackSpendConfig({ STACKSPEND_TELEMETRY: "true" })).toThrow(/telemetry/i);
  });

  it("does not mark local CLI providers configured from unused required env flags", () => {
    const config = loadStackSpendConfig({
      STACKSPEND_CODEX_CLI_USAGE: "deprecated",
      STACKSPEND_CLAUDE_CLI_USAGE: "deprecated",
    });

    expect(config.providers["codex-cli"]).toMatchObject({
      configured: false,
      requiredEnvKeys: [],
      configuredEnvKeys: [],
      missingEnvKeys: [],
    });
    expect(config.providers["claude-cli"]).toMatchObject({
      configured: false,
      requiredEnvKeys: [],
      configuredEnvKeys: [],
      missingEnvKeys: [],
    });
  });
});
