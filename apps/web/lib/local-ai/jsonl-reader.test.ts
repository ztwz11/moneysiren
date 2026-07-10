import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBoundedJsonl } from "./jsonl-reader";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (path) => {
    await rm(path, { force: true, recursive: true });
  }));
});

describe("readBoundedJsonl", () => {
  it("streams valid records and counts malformed input without returning content", async () => {
    const path = await fixture([
      JSON.stringify({ type: "usage", value: 1 }),
      "{malformed",
      "",
      JSON.stringify({ type: "usage", value: 2 }),
    ].join("\n"));
    const values: unknown[] = [];

    const result = await readBoundedJsonl(path, (value) => values.push(value));

    expect(values).toEqual([
      { type: "usage", value: 1 },
      { type: "usage", value: 2 },
    ]);
    expect(result).toMatchObject({
      parsedRecordCount: 2,
      malformedRecordCount: 1,
      unreadable: false,
      truncated: false,
    });
    expect(JSON.stringify(result)).not.toContain("malformed");
  });

  it("drops oversized lines and never passes their content to the callback", async () => {
    const sensitiveMarker = "prompt-body-that-must-not-leave-reader";
    const path = await fixture([
      JSON.stringify({ content: sensitiveMarker.repeat(8) }),
      JSON.stringify({ safe: true }),
    ].join("\n"));
    const values: unknown[] = [];

    const result = await readBoundedJsonl(path, (value) => values.push(value), {
      maxLineBytes: 64,
    });

    expect(values).toEqual([{ safe: true }]);
    expect(result.oversizedLineCount).toBe(1);
    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result)).not.toContain(sensitiveMarker);
  });

  it("stops at byte and line caps", async () => {
    const path = await fixture([
      JSON.stringify({ index: 1 }),
      JSON.stringify({ index: 2 }),
      JSON.stringify({ index: 3 }),
    ].join("\n"));
    const lineLimited: unknown[] = [];
    const byteLimited: unknown[] = [];

    const lineResult = await readBoundedJsonl(path, (value) => lineLimited.push(value), {
      maxLines: 2,
    });
    const byteResult = await readBoundedJsonl(path, (value) => byteLimited.push(value), {
      maxBytes: 5,
    });

    expect(lineLimited).toHaveLength(2);
    expect(lineResult.truncated).toBe(true);
    expect(byteLimited).toHaveLength(0);
    expect(byteResult).toMatchObject({ bytesRead: 5, truncated: true });
  });

  it("returns only an unreadable flag for missing files", async () => {
    const result = await readBoundedJsonl(join(tmpdir(), "missing-moneysiren-fixture.jsonl"), () => {
      throw new Error("callback must not run");
    });

    expect(result).toMatchObject({
      parsedRecordCount: 0,
      unreadable: true,
    });
  });
});

async function fixture(content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "moneysiren-jsonl-"));
  const path = join(directory, "usage.jsonl");

  temporaryDirectories.push(directory);
  await writeFile(path, content, "utf8");

  return path;
}
