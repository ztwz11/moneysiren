import { describe, expect, it } from "vitest";
import {
  buildSlackReportPayload,
  sendSlackReport,
  type SlackReportTransportRequest,
} from "./slack.js";

const TEST_WEBHOOK_URL = "fake-moneysiren-slack-webhook-secret";
const REPORT_TEXT = "*MoneySiren daily report*\n- Date 2026-06-02";

describe("Slack report delivery", () => {
  it("builds a Slack-readable text payload without dense key/value formatting", () => {
    const payload = buildSlackReportPayload(
      [
        "*MoneySiren daily report*",
        "- Date 2026-06-02",
        "",
        "---",
        "*Mock Provider*",
        "- Estimated cost USD 15.00",
      ].join("\n"),
    );

    expect(payload).toEqual({
      text: expect.stringContaining("---"),
      mrkdwn: true,
    });
    expect(payload.text).not.toMatch(/^[^-*\n][^\n]+: .+$/m);
  });

  it("uses an injectable transport so tests do not call Slack", async () => {
    const requests: SlackReportTransportRequest[] = [];

    const result = await sendSlackReport({
      webhookUrl: TEST_WEBHOOK_URL,
      text: REPORT_TEXT,
      transport: async (request) => {
        requests.push(request);
        return {
          ok: true,
          status: 200,
          body: "ok",
        };
      },
    });

    expect(result).toEqual({
      status: "sent",
      statusCode: 200,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.webhookUrl).toBe(TEST_WEBHOOK_URL);
    expect(requests[0]?.payload).toEqual({
      text: REPORT_TEXT,
      mrkdwn: true,
    });
    expect(requests[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("redacts the webhook URL from transport errors", async () => {
    let message = "";

    try {
      await sendSlackReport({
        webhookUrl: TEST_WEBHOOK_URL,
        text: REPORT_TEXT,
        transport: async ({ webhookUrl }) => {
          throw new Error(`POST ${webhookUrl} failed`);
        },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("[REDACTED:webhook_url]");
    expect(message).not.toContain(TEST_WEBHOOK_URL);
  });

  it("times out hanging transports and aborts the request signal", async () => {
    let message = "";
    let aborted = false;

    try {
      await sendSlackReport({
        webhookUrl: TEST_WEBHOOK_URL,
        text: REPORT_TEXT,
        timeoutMs: 10,
        transport: async ({ signal }) => {
          signal.addEventListener("abort", () => {
            aborted = signal.aborted;
          }, { once: true });

          return await new Promise<never>(() => undefined);
        },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(aborted).toBe(true);
    expect(message).toContain("Slack report delivery timed out after 10ms.");
    expect(message.length).toBeLessThanOrEqual(500);
    expect(message).not.toContain(TEST_WEBHOOK_URL);
  });

  it("bounds and redacts non-OK Slack response details", async () => {
    let message = "";

    try {
      await sendSlackReport({
        webhookUrl: TEST_WEBHOOK_URL,
        text: REPORT_TEXT,
        transport: async () => ({
          ok: false,
          status: 500,
          body: `failed ${TEST_WEBHOOK_URL} sk-fake-token ${"x".repeat(1_000)}`,
        }),
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Slack report delivery failed with HTTP 500.");
    expect(message).toContain("[REDACTED:webhook_url]");
    expect(message).toContain("[REDACTED:token]");
    expect(message).toContain("[truncated]");
    expect(message.length).toBeLessThanOrEqual(500);
    expect(message).not.toContain(TEST_WEBHOOK_URL);
    expect(message).not.toContain("sk-fake-token");
  });
});
