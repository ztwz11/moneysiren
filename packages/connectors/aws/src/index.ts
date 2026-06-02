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
  message: "AWS Cost Explorer request failed before normalized snapshots were collected.";
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
      } catch {
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
              message: "AWS Cost Explorer request failed before normalized snapshots were collected.",
            },
          ],
          errors: ["AWS Cost Explorer request failed."],
        };
      }
    },
  };
}
