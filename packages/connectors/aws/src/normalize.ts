const UNBLENDED_COST_METRIC = "UnblendedCost";
const STACKSPEND_COST_METRIC = "unblended_cost";

export interface AwsCostExplorerGetCostAndUsageOutput {
  ResultsByTime?: readonly AwsCostExplorerResultByTime[];
}

export interface AwsCostExplorerResultByTime {
  TimePeriod?: AwsCostExplorerTimePeriod;
  Total?: AwsCostExplorerMetrics;
  Groups?: readonly AwsCostExplorerGroup[];
  Estimated?: boolean;
}

export interface AwsCostExplorerTimePeriod {
  Start?: string;
  End?: string;
}

export type AwsCostExplorerMetrics = Record<string, AwsCostExplorerMetricAmount | undefined>;

export interface AwsCostExplorerMetricAmount {
  Amount?: string;
  Unit?: string;
}

export interface AwsCostExplorerGroup {
  Keys?: readonly string[];
  Metrics?: AwsCostExplorerMetrics;
}

export interface AwsNormalizedSnapshotBundle {
  usage: readonly AwsUsageSnapshot[];
  billing: readonly AwsBillingSnapshot[];
  serviceHealth: readonly AwsServiceHealthSnapshot[];
  costEstimates: readonly AwsCostEstimate[];
}

export interface AwsUsageSnapshot {
  provider: "aws";
  collectedAt: string;
  service: string;
  metric: typeof STACKSPEND_COST_METRIC;
  unit: string;
  value: number;
}

export interface AwsBillingSnapshot {
  provider: "aws";
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: "estimated" | "final";
}

export interface AwsServiceHealthSnapshot {
  provider: "aws";
  collectedAt: string;
  service: string;
  status: "ok" | "degraded" | "down" | "unknown";
}

export interface AwsCostEstimate {
  provider: "aws";
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "medium" | "high";
}

export interface NormalizeCostExplorerResponseInput {
  response: AwsCostExplorerGetCostAndUsageOutput;
  collectedAt: string;
}

export function normalizeCostExplorerResponse(
  input: NormalizeCostExplorerResponseInput,
): AwsNormalizedSnapshotBundle {
  const usage: AwsUsageSnapshot[] = [];
  const billing: AwsBillingSnapshot[] = [];
  const costEstimates: AwsCostEstimate[] = [];

  for (const result of input.response.ResultsByTime ?? []) {
    const period = requireTimePeriod(result.TimePeriod);
    const totalMetric = requireMetric(result.Total, UNBLENDED_COST_METRIC, "Cost Explorer total");
    const currency = requireMetricCurrency(totalMetric, "Cost Explorer total");
    const amountMinor = decimalAmountToMinorUnits(requireMetricAmount(totalMetric, "Cost Explorer total"));
    const status = result.Estimated === true ? "estimated" : "final";

    billing.push({
      provider: "aws",
      collectedAt: input.collectedAt,
      periodStart: period.Start,
      periodEnd: period.End,
      amountMinor,
      currency,
      status,
    });

    costEstimates.push({
      provider: "aws",
      collectedAt: input.collectedAt,
      periodStart: period.Start,
      periodEnd: period.End,
      estimatedAmountMinor: amountMinor,
      currency,
      confidence: result.Estimated === true ? "medium" : "high",
    });

    for (const group of result.Groups ?? []) {
      const service = requireServiceName(group);
      const groupMetric = requireMetric(group.Metrics, UNBLENDED_COST_METRIC, `Cost Explorer service ${service}`);
      const groupCurrency = requireMetricCurrency(groupMetric, `Cost Explorer service ${service}`);

      if (groupCurrency !== currency) {
        throw new Error(`Cost Explorer currency mismatch for service ${service}.`);
      }

      usage.push({
        provider: "aws",
        collectedAt: input.collectedAt,
        service,
        metric: STACKSPEND_COST_METRIC,
        unit: groupCurrency,
        value: decimalAmountToMinorUnits(requireMetricAmount(groupMetric, `Cost Explorer service ${service}`)) / 100,
      });
    }
  }

  return {
    usage,
    billing,
    serviceHealth: [],
    costEstimates,
  };
}

export function decimalAmountToMinorUnits(amount: string): number {
  const trimmed = amount.trim();
  const sign = trimmed.startsWith("-") ? -1n : 1n;
  const unsigned = sign === -1n ? trimmed.slice(1) : trimmed;

  if (!/^\d+(\.\d+)?$/.test(unsigned)) {
    throw new Error(`AWS currency amount must be a decimal string: ${amount}`);
  }

  const [wholePart = "0", fractionPart = ""] = unsigned.split(".");
  const minorDigits = `${fractionPart}00`.slice(0, 2);
  const roundingDigit = Number(`${fractionPart}000`.slice(2, 3));
  let minorUnits = BigInt(wholePart) * 100n + BigInt(minorDigits);

  if (roundingDigit >= 5) {
    minorUnits += 1n;
  }

  const signedMinorUnits = minorUnits * sign;
  const asNumber = Number(signedMinorUnits);

  if (!Number.isSafeInteger(asNumber)) {
    throw new Error(`AWS currency amount is outside safe integer range: ${amount}`);
  }

  return asNumber;
}

function requireTimePeriod(period: AwsCostExplorerTimePeriod | undefined): Required<AwsCostExplorerTimePeriod> {
  if (period?.Start === undefined || period.End === undefined) {
    throw new Error("Cost Explorer result is missing TimePeriod Start or End.");
  }

  return {
    Start: period.Start,
    End: period.End,
  };
}

function requireMetric(
  metrics: AwsCostExplorerMetrics | undefined,
  metricName: string,
  context: string,
): AwsCostExplorerMetricAmount {
  const metric = metrics?.[metricName];

  if (metric === undefined) {
    throw new Error(`${context} is missing ${metricName}.`);
  }

  return metric;
}

function requireMetricAmount(metric: AwsCostExplorerMetricAmount, context: string): string {
  if (metric.Amount === undefined || metric.Amount.trim().length === 0) {
    throw new Error(`${context} is missing amount.`);
  }

  return metric.Amount;
}

function requireMetricCurrency(metric: AwsCostExplorerMetricAmount, context: string): string {
  if (metric.Unit === undefined || metric.Unit.trim().length === 0) {
    throw new Error(`${context} is missing currency unit.`);
  }

  return metric.Unit;
}

function requireServiceName(group: AwsCostExplorerGroup): string {
  const service = group.Keys?.[0]?.trim();

  if (service === undefined || service.length === 0) {
    throw new Error("Cost Explorer service group is missing a service key.");
  }

  return service;
}
