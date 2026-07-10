import { describe, expect, it } from "vitest";
import { parseCodexUsageValue } from "./parser";

describe("parseCodexUsageValue", () => {
  it("prefers last_token_usage over cumulative total_token_usage", () => {
    const result = parseCodexUsageValue({
      timestamp: "2030-01-02T03:04:05.000Z",
      request_id: "FAKE-request",
      model: "gpt-5.6",
      payload: {
        info: {
          last_token_usage: {
            input_tokens: 100,
            cached_input_tokens: 40,
            output_tokens: 20,
            reasoning_output_tokens: 5,
            total_tokens: 120,
          },
          total_token_usage: {
            input_tokens: 900,
            output_tokens: 100,
            total_tokens: 1000,
          },
        },
      },
    });

    expect(result).toMatchObject({
      kind: "record",
      record: {
        semantics: "incremental",
        observedModelId: "gpt-5.6",
        inputTokens: 100,
        cachedInputTokens: 40,
        outputTokens: 20,
        reasoningTokens: 5,
        explicitTotalTokens: 120,
      },
    });
  });

  it("uses total_token_usage as cumulative when no last usage exists", () => {
    const result = parseCodexUsageValue({
      timestamp: "2030-01-02T03:04:05.000Z",
      session_id: "FAKE-session",
      model_slug: "gpt-5.6-terra",
      payload: {
        info: {
          total_token_usage: {
            input_tokens: 200,
            cache_creation_input_tokens: 20,
            output_tokens: 30,
            total_tokens: 230,
          },
        },
      },
    });

    expect(result).toMatchObject({
      kind: "record",
      record: {
        semantics: "cumulative",
        observedModelId: "gpt-5.6-terra",
        cacheWriteTokens: 20,
      },
    });
    expect(result.kind === "record" ? result.record.seriesKey : null).toMatch(/^series-[a-f0-9]{24}$/);
  });

  it("hashes identifiers and never returns prompt, command, or raw IDs", () => {
    const sensitive = "FAKE-sensitive-marker";
    const result = parseCodexUsageValue({
      schemaVersion: 1,
      eventKey: sensitive,
      seriesKey: sensitive,
      occurredAt: "2030-01-02T00:00:00.000Z",
      observedModelId: "gpt-5.6-luna",
      semantics: "incremental",
      inputTokens: 10,
      cachedInputTokens: 0,
      cacheWriteTokens: null,
      outputTokens: 2,
      reasoningTokens: 0,
      explicitTotalTokens: 12,
      requestCount: 1,
      prompt: sensitive,
      command: sensitive,
    });
    const serialized = JSON.stringify(result);

    expect(result.kind).toBe("record");
    expect(serialized).not.toContain(sensitive);
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("command");
  });

  it("does not recursively discover arbitrary nested usage objects", () => {
    expect(parseCodexUsageValue({
      timestamp: "2030-01-02T00:00:00.000Z",
      model: "gpt-5.6-sol",
      arbitrary: {
        nested: {
          usage: {
            input_tokens: 999,
            output_tokens: 999,
          },
        },
      },
    })).toEqual({ kind: "unknown-schema" });
  });

  it("replaces unsafe model values with a non-identifying unknown label", () => {
    const result = parseCodexUsageValue({
      timestamp: "2030-01-02T00:00:00.000Z",
      model: "C:\\Users\\person\\private-session",
      type: "assistant",
      message: {
        usage: {
          input_tokens: 10,
          output_tokens: 2,
        },
      },
    });

    expect(result).toMatchObject({
      kind: "record",
      record: { observedModelId: "unknown" },
    });
    expect(JSON.stringify(result)).not.toContain("private-session");
  });

  it("classifies candidate records with invalid counters or timestamps as malformed", () => {
    expect(parseCodexUsageValue({
      timestamp: "not-a-date",
      model: "gpt-5.6-sol",
      token_usage: { input_tokens: -1 },
    })).toEqual({ kind: "malformed-record" });
  });
});
