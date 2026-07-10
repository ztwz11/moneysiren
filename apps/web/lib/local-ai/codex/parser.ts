import { createHash } from "node:crypto";
import { normalizeCodexModelId } from "./model-normalize";
import type { CodexSanitizedUsageRecord } from "./types";

export type CodexUsageParseResult =
  | { kind: "record"; record: CodexSanitizedUsageRecord }
  | { kind: "malformed-record" }
  | { kind: "unknown-schema" };

interface UsageCandidate {
  usage: Record<string, unknown>;
  semantics: "incremental" | "cumulative";
  scope: Record<string, unknown>;
  payload: Record<string, unknown> | null;
  info: Record<string, unknown> | null;
}

export function parseCodexUsageValue(value: unknown): CodexUsageParseResult {
  const record = asRecord(value);

  if (record === null) {
    return { kind: "unknown-schema" };
  }

  if (record.schemaVersion === 1 && hasSanitizedRecordShape(record)) {
    return parseCandidate({
      usage: record,
      semantics: record.semantics === "cumulative" ? "cumulative" : "incremental",
      scope: record,
      payload: null,
      info: null,
    });
  }

  const payload = asRecord(record.payload);
  const info = asRecord(payload?.info);
  const lastTokenUsage = asRecord(info?.last_token_usage);
  const totalTokenUsage = asRecord(info?.total_token_usage);

  if (lastTokenUsage !== null) {
    return parseCandidate({
      usage: lastTokenUsage,
      semantics: "incremental",
      scope: record,
      payload,
      info,
    });
  }

  if (totalTokenUsage !== null) {
    return parseCandidate({
      usage: totalTokenUsage,
      semantics: "cumulative",
      scope: record,
      payload,
      info,
    });
  }

  const message = asRecord(record.message);
  const recordType = stringValue(record.type);
  const payloadType = stringValue(payload?.type);
  const candidates: UsageCandidate[] = [
    ...(recordType === "assistant" && asRecord(message?.usage) !== null
      ? [{
          usage: asRecord(message?.usage) as Record<string, unknown>,
          semantics: "incremental" as const,
          scope: record,
          payload,
          info,
        }]
      : []),
    ...(recordType === "assistant" || recordType === "response_item" || recordType === "turn_context"
      ? candidateFrom(record.usage, semanticsFrom(record), record, payload, info)
      : []),
    ...candidateFrom(record.token_usage, semanticsFrom(record), record, payload, info),
    ...(payloadType === "response" || payloadType === "message" || payloadType === "function_call"
      ? candidateFrom(payload?.usage, semanticsFrom(payload), record, payload, info)
      : []),
    ...candidateFrom(payload?.token_usage, semanticsFrom(payload), record, payload, info),
  ];

  return candidates[0] === undefined
    ? { kind: "unknown-schema" }
    : parseCandidate(candidates[0]);
}

function parseCandidate(candidate: UsageCandidate): CodexUsageParseResult {
  const tokens = readTokenFields(candidate.usage);

  if (tokens === null) {
    return { kind: "malformed-record" };
  }

  const occurredAt = readTimestamp([
    candidate.scope.occurredAt,
    candidate.scope.timestamp,
    candidate.scope.created_at,
    candidate.scope.createdAt,
    candidate.scope.time,
    candidate.scope.ts,
    candidate.payload?.timestamp,
    candidate.payload?.created_at,
    candidate.payload?.createdAt,
    candidate.usage.occurredAt,
    candidate.usage.timestamp,
  ]);

  if (occurredAt === null) {
    return { kind: "malformed-record" };
  }

  const normalizedModel = normalizeCodexModelId(firstString([
    candidate.usage.observedModelId,
    candidate.usage.model,
    candidate.scope.model,
    candidate.scope.model_slug,
    candidate.payload?.model,
    candidate.payload?.model_slug,
    candidate.info?.model,
  ]));
  const eventIdentifier = firstString([
    candidate.usage.eventKey,
    candidate.scope.request_id,
    candidate.scope.requestId,
    candidate.scope.turn_id,
    candidate.scope.turnId,
    candidate.scope.id,
    candidate.payload?.request_id,
    candidate.payload?.requestId,
    candidate.payload?.turn_id,
    candidate.payload?.id,
  ]);
  const seriesIdentifier = firstString([
    candidate.usage.seriesKey,
    candidate.scope.session_id,
    candidate.scope.sessionId,
    candidate.scope.conversation_id,
    candidate.scope.thread_id,
    candidate.payload?.session_id,
    candidate.payload?.sessionId,
    candidate.payload?.conversation_id,
  ]);
  const requestCount = readNonNegativeInteger(candidate.usage.requestCount ?? candidate.usage.request_count);

  if (requestCount === null && (candidate.usage.requestCount !== undefined || candidate.usage.request_count !== undefined)) {
    return { kind: "malformed-record" };
  }

  const identityParts = [
    eventIdentifier ?? "",
    occurredAt,
    normalizedModel.canonicalModelId,
    candidate.semantics,
    tokens.inputTokens,
    tokens.cachedInputTokens,
    tokens.cacheWriteTokens ?? "",
    tokens.outputTokens,
    tokens.reasoningTokens,
    tokens.explicitTotalTokens ?? "",
    requestCount ?? (candidate.semantics === "incremental" ? 1 : 0),
  ];

  return {
    kind: "record",
    record: {
      schemaVersion: 1,
      eventKey: stableKey("event", identityParts),
      seriesKey: seriesIdentifier === null
        ? null
        : stableKey("series", [seriesIdentifier, normalizedModel.canonicalModelId]),
      occurredAt,
      observedModelId: normalizedModel.observedModelId,
      semantics: candidate.semantics,
      inputTokens: tokens.inputTokens,
      cachedInputTokens: tokens.cachedInputTokens,
      cacheWriteTokens: tokens.cacheWriteTokens,
      outputTokens: tokens.outputTokens,
      reasoningTokens: tokens.reasoningTokens,
      explicitTotalTokens: tokens.explicitTotalTokens,
      requestCount: requestCount ?? (candidate.semantics === "incremental" ? 1 : 0),
    },
  };
}

function readTokenFields(usage: Record<string, unknown>): Omit<
  CodexSanitizedUsageRecord,
  "schemaVersion" | "eventKey" | "seriesKey" | "occurredAt" | "observedModelId" | "semantics" | "requestCount"
> | null {
  const input = readAliasedMetric(usage, ["inputTokens", "input_tokens", "prompt_tokens"]);
  const cached = readAliasedMetric(usage, ["cachedInputTokens", "cached_input_tokens", "cache_read_input_tokens"]);
  const cacheWrite = readNullableAliasedMetric(usage, ["cacheWriteTokens", "cache_write_tokens", "cache_creation_input_tokens"]);
  const output = readAliasedMetric(usage, ["outputTokens", "output_tokens", "completion_tokens"]);
  const reasoning = readAliasedMetric(usage, ["reasoningTokens", "reasoning_output_tokens"]);
  const total = readNullableAliasedMetric(usage, ["explicitTotalTokens", "total_tokens"]);
  const values = [input, cached, cacheWrite, output, reasoning, total];

  if (values.every((item) => item === undefined) || values.some((item) => item === null)) {
    return null;
  }

  return {
    inputTokens: input ?? 0,
    cachedInputTokens: cached ?? 0,
    cacheWriteTokens: cacheWrite ?? null,
    outputTokens: output ?? 0,
    reasoningTokens: reasoning ?? 0,
    explicitTotalTokens: total ?? null,
  };
}

function readAliasedMetric(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | null | undefined {
  for (const key of keys) {
    if (!(key in record)) {
      continue;
    }

    return readNonNegativeInteger(record[key]);
  }

  return undefined;
}

function readNullableAliasedMetric(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | null | undefined {
  for (const key of keys) {
    if (!(key in record)) {
      continue;
    }

    return record[key] === null ? undefined : readNonNegativeInteger(record[key]);
  }

  return undefined;
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function readTimestamp(values: readonly unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const timestamp = Date.parse(value);

    if (Number.isFinite(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return null;
}

function candidateFrom(
  value: unknown,
  semantics: "incremental" | "cumulative",
  scope: Record<string, unknown>,
  payload: Record<string, unknown> | null,
  info: Record<string, unknown> | null,
): UsageCandidate[] {
  const usage = asRecord(value);

  return usage === null ? [] : [{ usage, semantics, scope, payload, info }];
}

function semanticsFrom(value: Record<string, unknown> | null): "incremental" | "cumulative" {
  return value?.semantics === "cumulative" ||
    value?.usage_semantics === "cumulative" ||
    value?.cumulative === true
    ? "cumulative"
    : "incremental";
}

function hasSanitizedRecordShape(record: Record<string, unknown>): boolean {
  return record.semantics === "incremental" || record.semantics === "cumulative";
}

function firstString(values: readonly unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stableKey(prefix: string, parts: readonly (string | number)[]): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 24);

  return `${prefix}-${digest}`;
}
