import { describe, expect, it } from "vitest";
import {
  buildSlackReportPayload,
  sendSlackReport,
  type SlackReportTransportRequest,
} from "./slack.js";

const TEST_WEBHOOK_URL = "fake-stackspend-slack-webhook-secret";

describe("Slack report delivery", () => {
  it("builds a Slack-readable text payload without dense key/value formatting", () => {
    const payload = buildSlackReportPayload(
      [
        "*StackSpend 일일 리포트*",
        "- 날짜 2026-06-02",
        "",
        "---",
        "*Mock Provider*",
        "- 예상 비용 USD 15.00",
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
      text: "*StackSpend 일일 리포트*\n- 날짜 2026-06-02",
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
    expect(requests).toEqual([
      {
        webhookUrl: TEST_WEBHOOK_URL,
        payload: {
          text: "*StackSpend 일일 리포트*\n- 날짜 2026-06-02",
          mrkdwn: true,
        },
      },
    ]);
  });

  it("redacts the webhook URL from transport errors", async () => {
    let message = "";

    try {
      await sendSlackReport({
        webhookUrl: TEST_WEBHOOK_URL,
        text: "*StackSpend 일일 리포트*\n- 날짜 2026-06-02",
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
});
