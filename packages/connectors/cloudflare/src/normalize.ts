import { createHash } from "node:crypto";

const CLOUDFLARE_PROVIDER = "cloudflare";
const ACCOUNT_ID_HASH_PREFIX = "cloudflare-account";

export interface CloudflareBillingUsagePayload {
  accounts?: readonly CloudflareAccount[];
  billableUsage?: readonly CloudflareBillableUsageRecord[];
  paygoUsage?: readonly CloudflarePaygoUsageRecord[];
  status?: readonly CloudflareStatusSignal[];
  unavailable?: readonly CloudflareUnavailableSurface[];
}

export interface CloudflareAccount {
  id?: string;
  name?: string;
}

export interface CloudflareBillableUsageRecord {
  BillingAccountId?: string;
  BillingAccountName?: string;
  BillingCurrency?: string;
  BillingPeriodStart?: string;
  BillingPeriodEnd?: string;
  ChargePeriodStart?: string;
  ChargePeriodEnd?: string;
  BilledCost?: number | string;
  Cost?: number | string;
  ConsumedQuantity?: number | string;
  ConsumedUnit?: string;
  PricingQuantity?: number | string;
  PricingUnit?: string;
  ServiceName?: string;
  x_ProductFamilyName?: string;
  x_BillableMetricId?: string;
  x_ZoneId?: string;
  x_ZoneName?: string;
  SubAccountId?: string;
  SubAccountName?: string;
  ChargeCategory?: string;
  ChargeDescription?: string;
  ChargeFrequency?: string;
}

export interface CloudflarePaygoUsageRecord {
  BillingAccountId?: string;
  BillingCurrency?: string;
  BillingPeriodStart?: string;
  BillingPeriodEnd?: string;
  ChargePeriodStart?: string;
  ChargePeriodEnd?: string;
  ContractedCost?: number | string;
  CumulatedContractedCost?: number | string;
  ConsumedQuantity?: number | string;
  ConsumedUnit?: string;
  ServiceName?: string;
  ServiceFamilyName?: string;
}

export interface CloudflareStatusSignal {
  accountId?: string;
  service?: string;
  status?: string;
  message?: string;
}

export interface CloudflareUnavailableSurface {
  surface: "billable-usage" | "paygo-usage" | "subscriptions";
  accountId?: string;
  reason?: string;
}

export interface CloudflareNormalizedSnapshotBundle {
  usage: readonly CloudflareUsageSnapshot[];
  billing: readonly CloudflareBillingSnapshot[];
  serviceHealth: readonly CloudflareServiceHealthSnapshot[];
  costEstimates: readonly CloudflareCostEstimate[];
}

export interface CloudflareUsageSnapshot {
  provider: typeof CLOUDFLARE_PROVIDER;
  collectedAt: string;
  providerAccountRef: string;
  service: string;
  metric: "billable_quantity";
  unit: string;
  value: number;
}

export interface CloudflareBillingSnapshot {
  provider: typeof CLOUDFLARE_PROVIDER;
  collectedAt: string;
  providerAccountRef: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: "estimated";
}

export interface CloudflareServiceHealthSnapshot {
  provider: typeof CLOUDFLARE_PROVIDER;
  collectedAt: string;
  service: string;
  status: "ok" | "degraded" | "down" | "unknown";
  message?: string;
}

export interface CloudflareCostEstimate {
  provider: typeof CLOUDFLARE_PROVIDER;
  collectedAt: string;
  providerAccountRef: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "low";
}

export interface NormalizeCloudflareBillingUsageInput {
  payload: CloudflareBillingUsagePayload;
  collectedAt: string;
}

interface NormalizedChargeRecord {
  providerAccountRef: string;
  service: string;
  unit: string;
  quantity: number;
  periodStart: string;
  periodEnd: string;
  currency?: string;
  amountMinor?: number;
}

interface BillingAccumulator {
  providerAccountRef: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  amountMinor: number;
}

export function normalizeCloudflareBillingUsage(
  input: NormalizeCloudflareBillingUsageInput,
): CloudflareNormalizedSnapshotBundle {
  const chargeRecords = normalizeChargeRecords(input.payload);

  return {
    usage: chargeRecords.map((record) => ({
      provider: CLOUDFLARE_PROVIDER,
      collectedAt: input.collectedAt,
      providerAccountRef: record.providerAccountRef,
      service: `${record.service}:${record.providerAccountRef}`,
      metric: "billable_quantity",
      unit: record.unit,
      value: record.quantity,
    })),
    billing: normalizeBilling(chargeRecords, input.collectedAt),
    serviceHealth: normalizeHealth(input.payload, input.collectedAt),
    costEstimates: normalizeCostEstimates(chargeRecords, input.collectedAt),
  };
}

export function redactedCloudflareAccountId(accountId: string): string {
  const trimmedAccountId = requireNonBlankString(accountId, "Cloudflare account ID");
  const digest = createHash("sha256").update(`cloudflare:${trimmedAccountId}`).digest("hex").slice(0, 16);

  return `${ACCOUNT_ID_HASH_PREFIX}:${digest}`;
}

export function cloudflareAmountToMinorUnits(amount: number | string): number {
  const rawAmount =
    typeof amount === "number" ? String(requireFiniteNumber(amount, "Cloudflare cost amount")) : amount;
  const trimmed = rawAmount.trim();
  const sign = trimmed.startsWith("-") ? -1n : 1n;
  const unsigned = sign === -1n ? trimmed.slice(1) : trimmed;

  if (!/^\d+(\.\d+)?$/.test(unsigned)) {
    throw new Error(`Cloudflare currency amount must be a decimal string or finite number: ${rawAmount}`);
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
    throw new Error(`Cloudflare currency amount is outside safe integer range: ${rawAmount}`);
  }

  return asNumber;
}

function normalizeChargeRecords(payload: CloudflareBillingUsagePayload): NormalizedChargeRecord[] {
  if ((payload.billableUsage ?? []).length > 0) {
    return (payload.billableUsage ?? []).map(normalizeBillableUsageRecord);
  }

  return (payload.paygoUsage ?? []).map(normalizePaygoUsageRecord);
}

function normalizeBillableUsageRecord(record: CloudflareBillableUsageRecord): NormalizedChargeRecord {
  const accountRef = redactedCloudflareAccountId(requireNonBlankString(record.BillingAccountId, "BillingAccountId"));
  const service = normalizeServiceName(
    readOptionalNonBlankString(record.x_ProductFamilyName) ??
      readOptionalNonBlankString(record.ServiceName) ??
      "Cloudflare usage",
  );
  const unit =
    readOptionalNonBlankString(record.PricingUnit) ??
    readOptionalNonBlankString(record.ConsumedUnit) ??
    "units";

  const currency = readOptionalNonBlankString(record.BillingCurrency)?.toUpperCase();
  const amountMinor = optionalAmountToMinorUnits(record.BilledCost ?? record.Cost);

  return {
    providerAccountRef: accountRef,
    service,
    unit,
    quantity: readOptionalFiniteNumber(record.PricingQuantity, `${service} PricingQuantity`) ??
      readOptionalFiniteNumber(record.ConsumedQuantity, `${service} ConsumedQuantity`) ??
      0,
    periodStart: normalizePeriodDate(
      readOptionalNonBlankString(record.ChargePeriodStart) ??
        readOptionalNonBlankString(record.BillingPeriodStart),
      "Cloudflare billable usage period start",
    ),
    periodEnd: normalizePeriodDate(
      readOptionalNonBlankString(record.ChargePeriodEnd) ??
        readOptionalNonBlankString(record.BillingPeriodEnd),
      "Cloudflare billable usage period end",
    ),
    ...(currency === undefined ? {} : { currency }),
    ...(amountMinor === undefined ? {} : { amountMinor }),
  };
}

function normalizePaygoUsageRecord(record: CloudflarePaygoUsageRecord): NormalizedChargeRecord {
  const accountRef = redactedCloudflareAccountId(requireNonBlankString(record.BillingAccountId, "BillingAccountId"));
  const service = normalizeServiceName(
    readOptionalNonBlankString(record.ServiceName) ??
      readOptionalNonBlankString(record.ServiceFamilyName) ??
      "Cloudflare PayGo usage",
  );
  const unit = readOptionalNonBlankString(record.ConsumedUnit) ?? "units";

  const currency = readOptionalNonBlankString(record.BillingCurrency)?.toUpperCase();
  const amountMinor = optionalAmountToMinorUnits(record.ContractedCost);

  return {
    providerAccountRef: accountRef,
    service,
    unit,
    quantity: readOptionalFiniteNumber(record.ConsumedQuantity, `${service} ConsumedQuantity`) ?? 0,
    periodStart: normalizePeriodDate(
      readOptionalNonBlankString(record.ChargePeriodStart) ??
        readOptionalNonBlankString(record.BillingPeriodStart),
      "Cloudflare PayGo usage period start",
    ),
    periodEnd: normalizePeriodDate(
      readOptionalNonBlankString(record.ChargePeriodEnd) ??
        readOptionalNonBlankString(record.BillingPeriodEnd),
      "Cloudflare PayGo usage period end",
    ),
    ...(currency === undefined ? {} : { currency }),
    ...(amountMinor === undefined ? {} : { amountMinor }),
  };
}

function normalizeBilling(
  records: readonly NormalizedChargeRecord[],
  collectedAt: string,
): CloudflareBillingSnapshot[] {
  return aggregateBillingRecords(records).map((record) => ({
    provider: CLOUDFLARE_PROVIDER,
    collectedAt,
    providerAccountRef: record.providerAccountRef,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    amountMinor: record.amountMinor,
    currency: record.currency,
    status: "estimated",
  }));
}

function normalizeCostEstimates(
  records: readonly NormalizedChargeRecord[],
  collectedAt: string,
): CloudflareCostEstimate[] {
  return aggregateBillingRecords(records).map((record) => ({
    provider: CLOUDFLARE_PROVIDER,
    collectedAt,
    providerAccountRef: record.providerAccountRef,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    estimatedAmountMinor: record.amountMinor,
    currency: record.currency,
    confidence: "low",
  }));
}

function aggregateBillingRecords(records: readonly NormalizedChargeRecord[]): BillingAccumulator[] {
  const accumulators = new Map<string, BillingAccumulator>();

  for (const record of records) {
    if (record.amountMinor === undefined || record.currency === undefined) {
      continue;
    }

    const key = [
      record.providerAccountRef,
      record.periodStart,
      record.periodEnd,
      record.currency,
    ].join("|");
    const existing = accumulators.get(key);

    if (existing === undefined) {
      accumulators.set(key, {
        providerAccountRef: record.providerAccountRef,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        currency: record.currency,
        amountMinor: record.amountMinor,
      });
      continue;
    }

    existing.amountMinor += record.amountMinor;
  }

  return [...accumulators.values()].sort((left, right) =>
    `${left.periodStart}:${left.providerAccountRef}:${left.currency}`.localeCompare(
      `${right.periodStart}:${right.providerAccountRef}:${right.currency}`,
    ),
  );
}

function normalizeHealth(
  payload: CloudflareBillingUsagePayload,
  collectedAt: string,
): CloudflareServiceHealthSnapshot[] {
  const snapshots: CloudflareServiceHealthSnapshot[] = [];
  const seen = new Set<string>();

  for (const signal of payload.status ?? []) {
    const accountId = readOptionalNonBlankString(signal.accountId);
    const service = normalizeHealthServiceName(readOptionalNonBlankString(signal.service));

    if (accountId === undefined) {
      continue;
    }

    pushHealthSnapshot(snapshots, seen, {
      provider: CLOUDFLARE_PROVIDER,
      collectedAt,
      service: `${service}:${redactedCloudflareAccountId(accountId)}`,
      status: mapCloudflareStatus(readOptionalNonBlankString(signal.status)),
      message: safeStatusMessage(readOptionalNonBlankString(signal.status)),
    });
  }

  for (const unavailable of payload.unavailable ?? []) {
    const accountId = readOptionalNonBlankString(unavailable.accountId);

    if (accountId === undefined) {
      continue;
    }

    pushHealthSnapshot(snapshots, seen, {
      provider: CLOUDFLARE_PROVIDER,
      collectedAt,
      service: `${surfaceServiceName(unavailable.surface)}:${redactedCloudflareAccountId(accountId)}`,
      status: "degraded",
      message: "Cloudflare billing usage API unavailable for this account.",
    });
  }

  return snapshots;
}

function pushHealthSnapshot(
  snapshots: CloudflareServiceHealthSnapshot[],
  seen: Set<string>,
  snapshot: CloudflareServiceHealthSnapshot,
): void {
  if (seen.has(snapshot.service)) {
    return;
  }

  seen.add(snapshot.service);
  snapshots.push(snapshot);
}

function normalizeServiceName(serviceName: string): string {
  return serviceName.replaceAll(/\s+/g, " ").trim();
}

function normalizeHealthServiceName(serviceName: string | undefined): string {
  return serviceName?.replaceAll(/[^a-z0-9]+/gi, "_").replaceAll(/^_+|_+$/g, "").toLowerCase() ??
    "billing_usage_api";
}

function surfaceServiceName(surface: CloudflareUnavailableSurface["surface"]): string {
  if (surface === "billable-usage") {
    return "billable_usage_api";
  }

  if (surface === "paygo-usage") {
    return "paygo_usage_api";
  }

  return "subscriptions_api";
}

function mapCloudflareStatus(status: string | undefined): CloudflareServiceHealthSnapshot["status"] {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "ok" || normalized === "available" || normalized === "healthy" || normalized === "active") {
    return "ok";
  }

  if (
    normalized === "restricted" ||
    normalized === "unavailable" ||
    normalized === "degraded" ||
    normalized === "limited"
  ) {
    return "degraded";
  }

  if (normalized === "down" || normalized === "error" || normalized === "failed") {
    return "down";
  }

  return "unknown";
}

function safeStatusMessage(status: string | undefined): string {
  const mappedStatus = mapCloudflareStatus(status);

  if (mappedStatus === "ok") {
    return "Cloudflare billing usage API available.";
  }

  if (mappedStatus === "unknown") {
    return "Cloudflare billing usage API status unknown.";
  }

  return "Cloudflare billing usage API unavailable for this account.";
}

function normalizePeriodDate(value: string | undefined, context: string): string {
  const trimmed = requireNonBlankString(value, context);
  const isoDate = /^\d{4}-\d{2}-\d{2}/.exec(trimmed)?.[0];

  if (isoDate === undefined) {
    throw new Error(`${context} must start with an ISO date.`);
  }

  return isoDate;
}

function optionalAmountToMinorUnits(amount: number | string | undefined): number | undefined {
  if (amount === undefined) {
    return undefined;
  }

  return cloudflareAmountToMinorUnits(amount);
}

function readOptionalFiniteNumber(value: number | string | undefined, context: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return requireFiniteNumber(value, context);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  return requireFiniteNumber(Number(trimmed), context);
}

function requireFiniteNumber(value: number, context: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} must be finite.`);
  }

  return value;
}

function requireNonBlankString(value: string | undefined, context: string): string {
  const trimmed = value?.trim();

  if (trimmed === undefined || trimmed.length === 0) {
    throw new Error(`${context} must not be blank.`);
  }

  return trimmed;
}

function readOptionalNonBlankString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}
