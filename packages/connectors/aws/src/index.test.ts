import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createAwsCostExplorerConnector,
  createStaticCostExplorerClient,
  type AwsCostExplorerClientAdapter,
  type AwsCostExplorerCommand,
  type AwsCostExplorerGetCostAndUsageOutput,
} from "./index.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/providers/aws/cost-explorer-grouped-by-service.json",
);

describe("createAwsCostExplorerConnector", () => {
  it("uses an injectable read-only Cost Explorer client and command adapter", async () => {
    const response = await loadFixture();
    const sentCommands: AwsCostExplorerCommand[] = [];
    const client: AwsCostExplorerClientAdapter = {
      async send(command) {
        sentCommands.push(command);
        return response;
      },
    };
    const connector = createAwsCostExplorerConnector({ costExplorerClient: client });
    const result = await connector.collect({ now: () => new Date(FIXED_NOW) });

    expect(connector.kind).toBe("aws");
    expect(connector.access).toBe("read-only");
    expect(sentCommands).toEqual([
      {
        name: "GetCostAndUsage",
        input: {
          TimePeriod: {
            Start: "2026-06-01",
            End: "2026-07-01",
          },
          Granularity: "MONTHLY",
          Metrics: ["UnblendedCost"],
          GroupBy: [
            {
              Type: "DIMENSION",
              Key: "SERVICE",
            },
          ],
        },
      },
    ]);
    expect(result.status).toBe("ok");
    expect(result.snapshots.billing).toHaveLength(1);
    expect(result.snapshots.usage).toHaveLength(4);
  });

  it("supports fixture/test mode through a static client without AWS network calls", async () => {
    const response = await loadFixture();
    const connector = createAwsCostExplorerConnector({
      costExplorerClient: createStaticCostExplorerClient(response),
    });
    const result = await connector.collect({ now: () => new Date(FIXED_NOW) });

    expect(result.status).toBe("ok");
    expect(result.snapshots.billing[0]?.amountMinor).toBe(1234);
    expect(JSON.stringify(result)).not.toMatch(
      /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@|\b\d{12}\b/i,
    );
  });
});

async function loadFixture(): Promise<AwsCostExplorerGetCostAndUsageOutput> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as AwsCostExplorerGetCostAndUsageOutput;
}
