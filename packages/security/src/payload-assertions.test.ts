import { describe, expect, it } from "vitest";
import { assertNoSensitivePayloadLeaks, findSensitivePayloadLeaks } from "./payload-assertions.js";

const FAKE_API_KEY = "sk-test-fake-payload-key-1234567890";
const FAKE_REFRESH_TOKEN = "fake-refresh-token-for-tests";
const FAKE_CLIENT_SECRET = "fake-client-secret-for-tests";
const FAKE_AUTHORIZATION_TOKEN = "fake-authorization-token-for-tests";
const FAKE_ACCOUNT_ID = "acct_fake_payload_123";
const FAKE_PROJECT_ID = "project_fake_payload_456";
const FAKE_EMAIL = "fake-payload@example.invalid";
const FAKE_INVOICE_ID = "invoice_fake_payload_789";
const FAKE_CARD_REF = "card_fake_4242";
const FAKE_WEBHOOK_URL = [
  "https://hooks.slack.com",
  "services",
  "TFAKE",
  "BFAKE",
  "CFAKE",
].join("/");

describe("payload security assertions", () => {
  it("detects credential, identity, raw payload, and card leaks in output-shaped objects", () => {
    const leaks = findSensitivePayloadLeaks({
      apiKey: FAKE_API_KEY,
      refresh_token: FAKE_REFRESH_TOKEN,
      client_secret: FAKE_CLIENT_SECRET,
      headers: {
        authorization: `Bearer ${FAKE_AUTHORIZATION_TOKEN}`,
      },
      slackWebhookUrl: FAKE_WEBHOOK_URL,
      accountId: FAKE_ACCOUNT_ID,
      project_id: FAKE_PROJECT_ID,
      email: FAKE_EMAIL,
      invoiceId: FAKE_INVOICE_ID,
      card: FAKE_CARD_REF,
      rawPayload: {
        providerPayload: {
          total: 42,
        },
      },
    });

    expect(leaks.map((leak) => leak.path)).toEqual(
      expect.arrayContaining([
        "$.apiKey",
        "$.refresh_token",
        "$.client_secret",
        "$.headers.authorization",
        "$.slackWebhookUrl",
        "$.accountId",
        "$.project_id",
        "$.email",
        "$.invoiceId",
        "$.card",
        "$.rawPayload",
        "$.rawPayload.providerPayload",
      ]),
    );
    expect(() => assertNoSensitivePayloadLeaks({ authorization: "Bearer fake-token" })).toThrow(
      "Sensitive payload content detected",
    );
  });

  it("accepts sanitized local API, notification, and tray-shaped payloads", () => {
    const localApiPayload = {
      provider: "claude-cli",
      capturedAt: "2026-06-09T00:00:00.000Z",
      model: "claude-sonnet",
      quota: {
        fiveHour: {
          percent: 72,
          resetAt: "2026-06-09T04:00:00.000Z",
          source: "statusline_capture",
        },
        weekly: {
          percent: 38,
          resetAt: "2026-06-12T09:00:00.000Z",
          source: "statusline_capture",
        },
      },
      context: {
        percent: 41,
        tokens: 82000,
        limit: 200000,
      },
      secretsReturned: false,
      rawPersisted: false,
    };
    const notificationDigestPayload = {
      title: "MoneySiren daily report",
      body: "Estimated cost USD 15.00",
      delivery: {
        target: "slack",
        webhookConfigured: true,
      },
      providers: [
        {
          provider: "openai",
          status: "ok",
          amountMinor: 1500,
          currency: "USD",
        },
      ],
    };
    const trayMenuPayload = {
      app: "MoneySiren",
      items: [
        {
          id: "open-dashboard",
          label: "Open dashboard",
          enabled: true,
        },
        {
          id: "provider-openai",
          label: "OpenAI USD 15.00",
          status: "ok",
        },
      ],
    };

    expect(findSensitivePayloadLeaks(localApiPayload)).toEqual([]);
    expect(findSensitivePayloadLeaks(notificationDigestPayload)).toEqual([]);
    expect(findSensitivePayloadLeaks(trayMenuPayload)).toEqual([]);
    expect(() =>
      assertNoSensitivePayloadLeaks([localApiPayload, notificationDigestPayload, trayMenuPayload]),
    ).not.toThrow();
  });

  it("requires local API safety flags to be false", () => {
    const leaks = findSensitivePayloadLeaks({
      secretsReturned: true,
      rawPersisted: true,
    });

    expect(leaks.map((leak) => leak.category)).toEqual(
      expect.arrayContaining(["secret_disclosure_flag", "raw_persistence_flag"]),
    );
  });
});
