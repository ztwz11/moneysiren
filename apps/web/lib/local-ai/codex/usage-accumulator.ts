import type { BoundedJsonlReadResult } from "../jsonl-reader";
import { normalizeCodexModelId } from "./model-normalize";
import type { CodexUsageParseResult } from "./parser";
import type {
  CodexLocalModelUsage,
  CodexMeasurementAccuracy,
  CodexModelUsage,
  CodexSafeModelId,
  CodexSanitizedUsageRecord,
  CodexTotalTokensBasis,
} from "./types";

export interface CodexUsageAccumulatorOptions {
  periodStart: string;
  periodEnd: string;
  eligibleFileCount: number;
  scannedFileCount: number;
  truncated?: boolean;
}

export interface CodexLocalAggregationResult {
  data: CodexLocalModelUsage;
  accuracy: Extract<CodexMeasurementAccuracy, "estimated" | "bounded">;
}

export interface CodexUsageAccumulator {
  add(result: CodexUsageParseResult): void;
  addReaderResult(result: BoundedJsonlReadResult): void;
  finish(): CodexLocalAggregationResult;
}

interface TokenPoint {
  occurredAtMs: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number | null;
  outputTokens: number;
  reasoningTokens: number;
  explicitTotalTokens: number | null;
  requestCount: number;
}

interface MutableModelUsage {
  canonicalModelId: CodexSafeModelId;
  knownModelId: CodexModelUsage["knownModelId"];
  observedModelIds: Set<CodexSafeModelId>;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  cacheWriteObserved: boolean;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  usedExplicitTotal: boolean;
  usedDerivedTotal: boolean;
  requestCount: number;
}

export function createCodexUsageAccumulator(
  options: CodexUsageAccumulatorOptions,
): CodexUsageAccumulator {
  const periodStartMs = Date.parse(options.periodStart);
  const periodEndMs = Date.parse(options.periodEnd);

  if (!Number.isFinite(periodStartMs) || !Number.isFinite(periodEndMs) || periodEndMs <= periodStartMs) {
    throw new Error("Codex usage period must be a valid increasing UTC range.");
  }

  const eventKeys = new Set<string>();
  const cumulativeSeries = new Map<string, TokenPoint>();
  const models = new Map<string, MutableModelUsage>();
  let parsedRecordCount = 0;
  let duplicateRecordCount = 0;
  let malformedRecordCount = 0;
  let unknownSchemaCount = 0;
  let truncated = options.truncated === true ||
    options.eligibleFileCount > options.scannedFileCount;

  const add = (result: CodexUsageParseResult): void => {
    if (result.kind === "malformed-record") {
      malformedRecordCount += 1;
      return;
    }

    if (result.kind === "unknown-schema") {
      unknownSchemaCount += 1;
      return;
    }

    parsedRecordCount += 1;
    const record = result.record;
    const occurredAtMs = Date.parse(record.occurredAt);

    if (!Number.isFinite(occurredAtMs)) {
      malformedRecordCount += 1;
      return;
    }

    if (eventKeys.has(record.eventKey)) {
      duplicateRecordCount += 1;
      return;
    }

    eventKeys.add(record.eventKey);
    const normalizedModel = normalizeCodexModelId(record.observedModelId);
    const current = tokenPoint(record, occurredAtMs);

    if (record.semantics === "cumulative") {
      if (record.seriesKey === null) {
        unknownSchemaCount += 1;
        truncated = true;
        return;
      }

      const seriesKey = `${normalizedModel.canonicalModelId}:${record.seriesKey}`;
      const previous = cumulativeSeries.get(seriesKey);

      if (previous !== undefined && current.occurredAtMs < previous.occurredAtMs) {
        unknownSchemaCount += 1;
        truncated = true;
        return;
      }

      cumulativeSeries.set(seriesKey, current);

      if (occurredAtMs < periodStartMs || occurredAtMs >= periodEndMs) {
        return;
      }

      if (previous === undefined) {
        truncated = true;
        addPoint(models, normalizedModel, current, "absolute");
        return;
      }

      addPoint(models, normalizedModel, deltaPoint(current, previous, () => {
        truncated = true;
      }), "delta");
      return;
    }

    if (occurredAtMs < periodStartMs || occurredAtMs >= periodEndMs) {
      return;
    }

    addPoint(models, normalizedModel, current, "absolute");
  };

  const addReaderResult = (result: BoundedJsonlReadResult): void => {
    malformedRecordCount += result.malformedRecordCount;
    truncated = truncated ||
      result.truncated ||
      result.unreadable ||
      result.oversizedLineCount > 0;
  };

  const finish = (): CodexLocalAggregationResult => {
    const modelUsage = [...models.values()]
      .map(finalizeModel)
      .sort((left, right) =>
        right.totalTokens - left.totalTokens ||
        left.canonicalModelId.localeCompare(right.canonicalModelId));

    const bounded = truncated ||
      malformedRecordCount > 0 ||
      unknownSchemaCount > 0;

    return {
      data: {
        models: modelUsage,
        coverage: {
          periodStart: new Date(periodStartMs).toISOString(),
          periodEnd: new Date(periodEndMs).toISOString(),
          eligibleFileCount: Math.max(0, Math.floor(options.eligibleFileCount)),
          scannedFileCount: Math.max(0, Math.floor(options.scannedFileCount)),
          parsedRecordCount,
          duplicateRecordCount,
          malformedRecordCount,
          unknownSchemaCount,
          truncated: bounded,
        },
      },
      accuracy: bounded ? "bounded" : "estimated",
    };
  };

  return { add, addReaderResult, finish };
}

function tokenPoint(record: CodexSanitizedUsageRecord, occurredAtMs: number): TokenPoint {
  return {
    occurredAtMs,
    inputTokens: record.inputTokens,
    cachedInputTokens: record.cachedInputTokens,
    cacheWriteTokens: record.cacheWriteTokens,
    outputTokens: record.outputTokens,
    reasoningTokens: record.reasoningTokens,
    explicitTotalTokens: record.explicitTotalTokens,
    requestCount: record.requestCount,
  };
}

function deltaPoint(
  current: TokenPoint,
  previous: TokenPoint,
  onReset: () => void,
): TokenPoint {
  return {
    occurredAtMs: current.occurredAtMs,
    inputTokens: counterDelta(current.inputTokens, previous.inputTokens, onReset),
    cachedInputTokens: counterDelta(current.cachedInputTokens, previous.cachedInputTokens, onReset),
    cacheWriteTokens: nullableCounterDelta(current.cacheWriteTokens, previous.cacheWriteTokens, onReset),
    outputTokens: counterDelta(current.outputTokens, previous.outputTokens, onReset),
    reasoningTokens: counterDelta(current.reasoningTokens, previous.reasoningTokens, onReset),
    explicitTotalTokens: nullableCounterDelta(current.explicitTotalTokens, previous.explicitTotalTokens, onReset),
    requestCount: counterDelta(current.requestCount, previous.requestCount, onReset),
  };
}

function counterDelta(current: number, previous: number, onReset: () => void): number {
  if (current >= previous) {
    return current - previous;
  }

  onReset();
  return current;
}

function nullableCounterDelta(
  current: number | null,
  previous: number | null,
  onReset: () => void,
): number | null {
  if (current === null) {
    return null;
  }

  if (previous === null) {
    onReset();
    return current;
  }

  return counterDelta(current, previous, onReset);
}

function addPoint(
  models: Map<string, MutableModelUsage>,
  normalizedModel: ReturnType<typeof normalizeCodexModelId>,
  point: TokenPoint,
  _mode: "absolute" | "delta",
): void {
  const model = models.get(normalizedModel.canonicalModelId) ?? {
    canonicalModelId: normalizedModel.canonicalModelId,
    knownModelId: normalizedModel.knownModelId,
    observedModelIds: new Set<CodexSafeModelId>(),
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    cacheWriteObserved: false,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    usedExplicitTotal: false,
    usedDerivedTotal: false,
    requestCount: 0,
  };

  model.observedModelIds.add(normalizedModel.observedModelId);
  model.inputTokens += point.inputTokens;
  model.cachedInputTokens += point.cachedInputTokens;
  model.outputTokens += point.outputTokens;
  model.reasoningTokens += point.reasoningTokens;
  model.requestCount += point.requestCount;

  if (point.cacheWriteTokens !== null) {
    model.cacheWriteObserved = true;
    model.cacheWriteTokens += point.cacheWriteTokens;
  }

  if (point.explicitTotalTokens !== null) {
    model.totalTokens += point.explicitTotalTokens;
    model.usedExplicitTotal = true;
  } else {
    model.totalTokens += point.inputTokens + point.outputTokens;
    model.usedDerivedTotal = true;
  }

  models.set(normalizedModel.canonicalModelId, model);
}

function finalizeModel(model: MutableModelUsage): CodexModelUsage {
  return {
    canonicalModelId: model.canonicalModelId,
    knownModelId: model.knownModelId,
    observedModelIds: [...model.observedModelIds].sort(),
    inputTokens: model.inputTokens,
    cachedInputTokens: model.cachedInputTokens,
    cacheWriteTokens: model.cacheWriteObserved ? model.cacheWriteTokens : null,
    outputTokens: model.outputTokens,
    reasoningTokens: model.reasoningTokens,
    totalTokens: model.totalTokens,
    totalTokensBasis: totalBasis(model),
    requestCount: model.requestCount,
  };
}

function totalBasis(model: MutableModelUsage): CodexTotalTokensBasis {
  if (model.usedExplicitTotal && model.usedDerivedTotal) {
    return "mixed";
  }

  return model.usedExplicitTotal ? "explicit" : "derived";
}
