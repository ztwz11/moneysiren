import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { CodexSanitizedUsageRecord } from "./types";
import { createCodexUsageAccumulator } from "./usage-accumulator";

const period = {
  periodStart: "2030-01-01T00:00:00.000Z",
  periodEnd: "2030-02-01T00:00:00.000Z",
  eligibleFileCount: 1,
  scannedFileCount: 1,
};

describe("Codex usage accumulator", () => {
  it("aggregates the synthetic Sol/Terra/Luna fixture without double counting subsets", async () => {
    const fixtureUrl = new URL("../../../../../tests/fixtures/local-ai/codex/sanitized-gpt56-usage.json", import.meta.url);
    const fixture = JSON.parse(await readFile(fixtureUrl, "utf8")) as {
      records: CodexSanitizedUsageRecord[];
    };
    const accumulator = createCodexUsageAccumulator(period);

    for (const record of fixture.records) {
      accumulator.add({ kind: "record", record });
    }

    const result = accumulator.finish();
    const sol = result.data.models.find((model) => model.canonicalModelId === "gpt-5.6-sol");

    expect(result.data.models).toHaveLength(4);
    expect(sol).toMatchObject({
      inputTokens: 150,
      cachedInputTokens: 50,
      outputTokens: 30,
      reasoningTokens: 5,
      totalTokens: 180,
      requestCount: 2,
    });
    expect(result.data.models.find((model) => model.canonicalModelId === "gpt-5.6-terra")?.totalTokens).toBe(230);
    expect(result.data.models.find((model) => model.canonicalModelId === "gpt-5.6-luna")?.totalTokens).toBe(80);
  });

  it("differences cumulative records and ignores repeated cumulative values", () => {
    const accumulator = createCodexUsageAccumulator(period);

    accumulator.add({ kind: "record", record: cumulative("first", "2030-01-02T00:00:00.000Z", 100, 20, 120) });
    accumulator.add({ kind: "record", record: cumulative("second", "2030-01-02T00:01:00.000Z", 100, 20, 120) });

    expect(accumulator.finish().data.models[0]).toMatchObject({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      requestCount: 1,
    });
  });

  it("uses a prior-month cumulative baseline for an in-month delta", () => {
    const accumulator = createCodexUsageAccumulator(period);

    accumulator.add({ kind: "record", record: cumulative("baseline", "2029-12-31T23:59:00.000Z", 100, 20, 120) });
    accumulator.add({ kind: "record", record: cumulative("inside", "2030-01-01T00:01:00.000Z", 150, 30, 180) });
    accumulator.add({ kind: "record", record: cumulative("outside", "2030-02-01T00:00:00.000Z", 999, 999, 1998) });

    expect(accumulator.finish().data.models[0]).toMatchObject({
      inputTokens: 50,
      outputTokens: 10,
      totalTokens: 60,
    });
  });

  it("deduplicates shared App and CLI records by sanitized event key", () => {
    const accumulator = createCodexUsageAccumulator({
      ...period,
      eligibleFileCount: 2,
      scannedFileCount: 2,
    });
    const record = incremental("same-event", "2030-01-02T00:00:00.000Z");

    accumulator.add({ kind: "record", record });
    accumulator.add({ kind: "record", record: { ...record } });

    const result = accumulator.finish();

    expect(result.data.models[0]?.totalTokens).toBe(120);
    expect(result.data.coverage.duplicateRecordCount).toBe(1);
  });

  it("marks file caps, malformed input, and unknown schemas bounded", () => {
    const accumulator = createCodexUsageAccumulator({
      ...period,
      eligibleFileCount: 401,
      scannedFileCount: 400,
    });

    accumulator.add({ kind: "malformed-record" });
    accumulator.add({ kind: "unknown-schema" });
    accumulator.add({ kind: "record", record: incremental("valid", "2030-01-02T00:00:00.000Z") });

    const result = accumulator.finish();

    expect(result.accuracy).toBe("bounded");
    expect(result.data.coverage).toMatchObject({
      eligibleFileCount: 401,
      scannedFileCount: 400,
      malformedRecordCount: 1,
      unknownSchemaCount: 1,
      truncated: true,
    });
  });

  it("keeps cache reads, writes, reasoning, and explicit totals separate", () => {
    const accumulator = createCodexUsageAccumulator(period);

    accumulator.add({
      kind: "record",
      record: {
        ...incremental("components", "2030-01-02T00:00:00.000Z"),
        cachedInputTokens: 40,
        cacheWriteTokens: 10,
        reasoningTokens: 5,
      },
    });

    expect(accumulator.finish().data.models[0]).toMatchObject({
      inputTokens: 100,
      cachedInputTokens: 40,
      cacheWriteTokens: 10,
      outputTokens: 20,
      reasoningTokens: 5,
      totalTokens: 120,
    });
  });

  it("returns no event keys, series keys, paths, prompts, commands, or raw lines", () => {
    const accumulator = createCodexUsageAccumulator(period);
    const marker = "FAKE-private-marker";

    accumulator.add({
      kind: "record",
      record: {
        ...incremental(marker, "2030-01-02T00:00:00.000Z"),
        seriesKey: marker,
      },
    });
    const serialized = JSON.stringify(accumulator.finish());

    expect(serialized).not.toContain(marker);
    expect(serialized).not.toMatch(/prompt|command|rawLine|fullPath|eventKey|seriesKey/i);
  });
});

function incremental(eventKey: string, occurredAt: string): CodexSanitizedUsageRecord {
  return {
    schemaVersion: 1,
    eventKey,
    seriesKey: null,
    occurredAt,
    observedModelId: "gpt-5.6",
    semantics: "incremental",
    inputTokens: 100,
    cachedInputTokens: 40,
    cacheWriteTokens: null,
    outputTokens: 20,
    reasoningTokens: 5,
    explicitTotalTokens: 120,
    requestCount: 1,
  };
}

function cumulative(
  eventKey: string,
  occurredAt: string,
  inputTokens: number,
  outputTokens: number,
  explicitTotalTokens: number,
): CodexSanitizedUsageRecord {
  return {
    ...incremental(eventKey, occurredAt),
    seriesKey: "safe-series",
    semantics: "cumulative",
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
    reasoningTokens: 0,
    explicitTotalTokens,
    requestCount: 1,
  };
}
