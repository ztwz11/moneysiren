import {
  createCurrentBillingPeriod,
  createGetCostAndUsageInput,
  defaultAwsCostExplorerCommandAdapter,
  type AwsCostExplorerClientAdapter,
  type AwsCostExplorerCommandAdapter,
} from "./cost-explorer.js";
import { normalizeCostExplorerResponse, type AwsNormalizedSnapshotBundle } from "./normalize.js";

export {
  createCurrentBillingPeriod,
  createGetCostAndUsageInput,
  createStaticCostExplorerClient,
  defaultAwsCostExplorerCommandAdapter,
  type AwsCostExplorerClientAdapter,
  type AwsCostExplorerCommand,
  type AwsCostExplorerCommandAdapter,
  type AwsGetCostAndUsageInput,
} from "./cost-explorer.js";
export {
  createAwsSdkCostExplorerClient,
  type CreateAwsSdkCostExplorerClientOptions,
} from "./sdk-client.js";
export {
  decimalAmountToMinorUnits,
  normalizeCostExplorerResponse,
  type AwsBillingSnapshot,
  type AwsCostEstimate,
  type AwsCostExplorerGetCostAndUsageOutput,
  type AwsCostExplorerGroup,
  type AwsCostExplorerMetricAmount,
  type AwsCostExplorerMetrics,
  type AwsCostExplorerResultByTime,
  type AwsCostExplorerTimePeriod,
  type AwsNormalizedSnapshotBundle,
  type AwsServiceHealthSnapshot,
  type AwsUsageSnapshot,
} from "./normalize.js";

export interface AwsProviderCollectionContext {
  now(): Date;
}

export interface AwsProviderConnector {
  kind: "aws";
  displayName: "AWS Cost Explorer";
  access: "read-only";
  collect(context: AwsProviderCollectionContext): Promise<AwsProviderCollectionResult>;
}

export interface AwsProviderCollectionResult {
  collectedAt: string;
  status: "ok" | "error";
  snapshots: AwsNormalizedSnapshotBundle;
  alerts: readonly AwsProviderAlert[];
  errors?: readonly string[];
}

export interface AwsProviderAlert {
  provider: "aws";
  createdAt: string;
  severity: "warning";
  category: "provider-sync";
  title: "AWS Cost Explorer sync failed";
  message: string;
}

export interface AwsCostExplorerConnectorOptions {
  costExplorerClient: AwsCostExplorerClientAdapter;
  commandAdapter?: AwsCostExplorerCommandAdapter;
}

const EMPTY_AWS_SNAPSHOTS: AwsNormalizedSnapshotBundle = {
  usage: [],
  billing: [],
  serviceHealth: [],
  costEstimates: [],
};

export function createAwsCostExplorerConnector(options: AwsCostExplorerConnectorOptions): AwsProviderConnector {
  const commandAdapter = options.commandAdapter ?? defaultAwsCostExplorerCommandAdapter;

  return {
    kind: "aws",
    displayName: "AWS Cost Explorer",
    access: "read-only",
    async collect(context) {
      const collectedAt = context.now().toISOString();
      const period = createCurrentBillingPeriod(context.now());
      const command = commandAdapter.createGetCostAndUsageCommand(createGetCostAndUsageInput(period));

      try {
        const response = await options.costExplorerClient.send(command);

        return {
          collectedAt,
          status: "ok",
          snapshots: normalizeCostExplorerResponse({
            response,
            collectedAt,
          }),
          alerts: [],
        };
      } catch (caught) {
        const message = `AWS Cost Explorer request failed: ${safeAwsErrorMessage(caught)}`;

        return {
          collectedAt,
          status: "error",
          snapshots: EMPTY_AWS_SNAPSHOTS,
          alerts: [
            {
              provider: "aws",
              createdAt: collectedAt,
              severity: "warning",
              category: "provider-sync",
              title: "AWS Cost Explorer sync failed",
              message,
            },
          ],
          errors: [message],
        };
      }
    },
  };
}

function safeAwsErrorMessage(caught: unknown): string {
  const rawMessage = caught instanceof Error && caught.message.trim().length > 0
    ? caught.message
    : "unknown AWS SDK error";

  return rawMessage
    .replace(/\b(AKIA[A-Z0-9]{16}|ASIA[A-Z0-9]{16})\b/g, "[redacted]")
    .replace(/\b\d{12}\b/g, "[redacted]")
    .replace(/\barn:aws[^\s,;)]*/gi, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .slice(0, 240);
}
