import type { AwsCostExplorerGetCostAndUsageOutput } from "./normalize.js";

export interface AwsGetCostAndUsageInput {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Granularity: "MONTHLY";
  Metrics: readonly ["UnblendedCost"];
  GroupBy: readonly [
    {
      Type: "DIMENSION";
      Key: "SERVICE";
    },
  ];
}

export interface AwsCostExplorerCommand {
  name: "GetCostAndUsage";
  input: AwsGetCostAndUsageInput;
}

export interface AwsCostExplorerClientAdapter {
  send(command: AwsCostExplorerCommand): Promise<AwsCostExplorerGetCostAndUsageOutput>;
}

export interface AwsCostExplorerCommandAdapter {
  createGetCostAndUsageCommand(input: AwsGetCostAndUsageInput): AwsCostExplorerCommand;
}

export interface AwsBillingPeriod {
  start: string;
  end: string;
}

export const defaultAwsCostExplorerCommandAdapter: AwsCostExplorerCommandAdapter = {
  createGetCostAndUsageCommand(input) {
    return {
      name: "GetCostAndUsage",
      input,
    };
  },
};

export function createGetCostAndUsageInput(period: AwsBillingPeriod): AwsGetCostAndUsageInput {
  return {
    TimePeriod: {
      Start: period.start,
      End: period.end,
    },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
    GroupBy: [
      {
        Type: "DIMENSION",
        Key: "SERVICE",
      },
    ],
  };
}

export function createCurrentBillingPeriod(now: Date): AwsBillingPeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    start: formatAwsDate(start),
    end: formatAwsDate(end),
  };
}

export function createStaticCostExplorerClient(
  response: AwsCostExplorerGetCostAndUsageOutput,
): AwsCostExplorerClientAdapter {
  return {
    async send() {
      return response;
    },
  };
}

function formatAwsDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
