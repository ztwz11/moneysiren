import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("LocalAiUsageHistory", () => {
  it("keeps day, week, and month controls with the local-only storage boundary", async () => {
    const source = await readFile(new URL("./LocalAiUsageHistory.tsx", import.meta.url), "utf8");

    expect(source).toContain('type Granularity = "day" | "week" | "month";');
    expect(source).toContain('day: "Daily"');
    expect(source).toContain('week: "Weekly"');
    expect(source).toContain('month: "Monthly"');
    expect(source).toContain('sync: "Scan and save"');
    expect(source).toContain("Prompts, commands, paths, auth data, and raw logs are never stored.");
  });
});
