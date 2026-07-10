import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanCodexLocalUsage } from "./local-usage";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (path) => {
    await rm(path, { force: true, recursive: true });
  }));
});

describe("scanCodexLocalUsage", () => {
  it("combines parser, dedupe, arithmetic, and coverage without returning file paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moneysiren-codex-scan-"));
    const first = join(directory, "app.jsonl");
    const second = join(directory, "cli.jsonl");
    const event = {
      timestamp: "2030-01-02T00:00:00.000Z",
      request_id: "FAKE-shared-event",
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
        },
      },
    };

    temporaryDirectories.push(directory);
    await writeFile(first, `${JSON.stringify(event)}\n`, "utf8");
    await writeFile(second, `${JSON.stringify(event)}\n{malformed\n`, "utf8");

    const result = await scanCodexLocalUsage({
      files: [{ path: first }, { path: second }],
      eligibleFileCount: 3,
      periodStart: "2030-01-01T00:00:00.000Z",
      periodEnd: "2030-02-01T00:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(result.data.models[0]).toMatchObject({
      canonicalModelId: "gpt-5.6-sol",
      totalTokens: 120,
    });
    expect(result.data.coverage).toMatchObject({
      eligibleFileCount: 3,
      scannedFileCount: 2,
      duplicateRecordCount: 1,
      malformedRecordCount: 1,
      truncated: true,
    });
    expect(result.accuracy).toBe("bounded");
    expect(serialized).not.toContain(directory);
    expect(serialized).not.toContain("FAKE-shared-event");
    expect(serialized).not.toContain("{malformed");
  });
});
