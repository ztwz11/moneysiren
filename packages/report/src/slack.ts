export interface SlackReportPayload {
  text: string;
  mrkdwn: true;
}

export interface SlackReportTransportRequest {
  webhookUrl: string;
  payload: SlackReportPayload;
  signal: AbortSignal;
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
  timeoutMs?: number;
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

const DEFAULT_SLACK_REPORT_TIMEOUT_MS = 5_000;
const MAX_SLACK_ERROR_MESSAGE_LENGTH = 500;
const MAX_SLACK_RESPONSE_BODY_LENGTH = 300;
const TRUNCATED_SUFFIX = "... [truncated]";

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
  const timeoutMs = resolveSlackReportTimeoutMs(options.timeoutMs);
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let response: SlackReportTransportResponse;

  try {
    const transportPromise = transport({
      webhookUrl,
      payload,
      signal: controller.signal,
    });
    transportPromise.catch(() => undefined);

    const timeoutPromise = new Promise<SlackReportTransportResponse>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new SlackReportDeliveryError(`Slack report delivery timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    });

    response = await Promise.race([transportPromise, timeoutPromise]);
  } catch (error) {
    const message = error instanceof SlackReportDeliveryError
      ? error.message
      : `Slack report delivery failed: ${errorMessage(error)}`;
    const errorOptions = error instanceof SlackReportDeliveryError && error.statusCode !== undefined
      ? { statusCode: error.statusCode }
      : {};

    throw new SlackReportDeliveryError(
      sanitizeWebhookMessage(message, webhookUrl),
      errorOptions,
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }

  if (!response.ok) {
    const responseBody = formatResponseBodyDetail(response.body, webhookUrl);
    const responseDetail = responseBody === undefined
      ? ""
      : ` Response: ${responseBody}`;

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
    signal: request.signal,
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

function resolveSlackReportTimeoutMs(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return DEFAULT_SLACK_REPORT_TIMEOUT_MS;
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new SlackReportDeliveryError("Slack report timeout must be a positive safe integer.");
  }

  return timeoutMs;
}

function formatResponseBodyDetail(body: string | undefined, webhookUrl: string): string | undefined {
  const trimmedBody = body?.trim();

  if (trimmedBody === undefined || trimmedBody.length === 0) {
    return undefined;
  }

  return limitText(redactSensitiveText(trimmedBody, webhookUrl), MAX_SLACK_RESPONSE_BODY_LENGTH);
}

function sanitizeWebhookMessage(message: string, webhookUrl: string): string {
  return limitText(redactSensitiveText(message, webhookUrl), MAX_SLACK_ERROR_MESSAGE_LENGTH);
}

function redactSensitiveText(message: string, webhookUrl: string): string {
  return message
    .replaceAll(webhookUrl, "[REDACTED:webhook_url]")
    .replace(/https:\/\/hooks\.slack\.com\/services\/[^\s"')]+/gi, "[REDACTED:webhook_url]")
    .replace(/\bsk-[A-Za-z0-9_-]+/g, "[REDACTED:token]")
    .replace(/\bxox[baprs]-[A-Za-z0-9-]+/gi, "[REDACTED:token]");
}

function limitText(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }

  return `${message.slice(0, maxLength - TRUNCATED_SUFFIX.length)}${TRUNCATED_SUFFIX}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
