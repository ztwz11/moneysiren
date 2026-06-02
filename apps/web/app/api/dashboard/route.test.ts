import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route.js";

const originalDbPath = process.env.STACKSPEND_DB_PATH;

afterEach(() => {
  if (originalDbPath === undefined) {
    delete process.env.STACKSPEND_DB_PATH;
  } else {
    process.env.STACKSPEND_DB_PATH = originalDbPath;
  }
});

describe("GET /api/dashboard", () => {
  it("returns a safe empty normalized JSON payload when SQLite is missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "stackspend-web-api-"));
    process.env.STACKSPEND_DB_PATH = join(rootDir, "missing.sqlite");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toMatchObject({
      source: "empty",
      database: {
        available: false,
        reason: "missing",
      },
      providers: [],
      alerts: [],
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /providerAccountRef|metadataJson|rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i,
    );
  });
});
