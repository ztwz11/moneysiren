export interface SlackReportPayload {
  text: string;
  mrkdwn: true;
}

export interface SlackReportTransportRequest {
  webhookUrl: string;
  payload: SlackReportPayload;
}

export interface SlackReportTransportResponse {
  ok: boolean;
  status: number;
  body?: string;
}

export type SlackReportTransport = (
  request: SlackReportTransportRequest,
) => Promise<SlackReportTransportResponse>;

export interface SendSlackReportOptions {
  webhookUrl: string;
  text: string;
  transport?: SlackReportTransport;
}

export interface SlackReportDeliveryResult {
  status: "sent";
  statusCode: number;
}

export class SlackReportDeliveryError extends Error {
  readonly statusCode?: number;

  constructor(message: string, options: { statusCode?: number } = {}) {
    super(message);
    this.name = "SlackReportDeliveryError";

    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
  }
}

export function buildSlackReportPayload(text: string): SlackReportPayload {
  const trimmedText = text.trim();

  if (trimmedText.length === 0) {
    throw new SlackReportDeliveryError("Slack report text must not be blank.");
  }

  return {
    text: trimmedText,
    mrkdwn: true,
  };
}

export async function sendSlackReport(options: SendSlackReportOptions): Promise<SlackReportDeliveryResult> {
  const webhookUrl = normalizeWebhookUrl(options.webhookUrl);
  const payload = buildSlackReportPayload(options.text);
  const transport = options.transport ?? fetchSlackReportTransport;
  let response: SlackReportTransportResponse;

  try {
    response = await transport({
      webhookUrl,
      payload,
    });
  } catch (error) {
    throw new SlackReportDeliveryError(
      sanitizeWebhookMessage(`Slack report delivery failed: ${errorMessage(error)}`, webhookUrl),
    );
  }

  if (!response.ok) {
    const responseDetail = response.body === undefined || response.body.trim().length === 0
      ? ""
      : ` Response: ${response.body.trim()}`;

    throw new SlackReportDeliveryError(
      sanitizeWebhookMessage(
        `Slack report delivery failed with HTTP ${response.status}.${responseDetail}`,
        webhookUrl,
      ),
      {
        statusCode: response.status,
      },
    );
  }

  return {
    status: "sent",
    statusCode: response.status,
  };
}

async function fetchSlackReportTransport(
  request: SlackReportTransportRequest,
): Promise<SlackReportTransportResponse> {
  const response = await fetch(request.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request.payload),
  });
  const body = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    ...(body.length === 0 ? {} : { body }),
  };
}

function normalizeWebhookUrl(webhookUrl: string): string {
  const trimmed = webhookUrl.trim();

  if (trimmed.length === 0) {
    throw new SlackReportDeliveryError("SLACK_WEBHOOK_URL is required for Slack delivery.");
  }

  return trimmed;
}

function sanitizeWebhookMessage(message: string, webhookUrl: string): string {
  return message
    .replaceAll(webhookUrl, "[REDACTED:webhook_url]")
    .replace(/https:\/\/hooks\.slack\.com\/services\/[^\s"')]+/gi, "[REDACTED:webhook_url]");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
