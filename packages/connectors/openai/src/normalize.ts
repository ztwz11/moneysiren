const OPENAI_PROVIDER = "openai";

export interface OpenAiUsageCostsPayload {
  usage: OpenAiUsagePage;
  costs: OpenAiCostsPage;
}

export interface OpenAiUsagePage {
  object?: string;
  data?: readonly OpenAiUsageBucket[];
  has_more?: boolean;
  next_page?: string | null;
}

export interface OpenAiUsageBucket {
  object?: string;
  start_time?: number;
  end_time?: number;
  results?: readonly OpenAiUsageResult[];
}

export interface OpenAiUsageResult {
  object?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  num_model_requests?: number;
}

export interface OpenAiCostsPage {
  object?: string;
  data?: readonly OpenAiCostsBucket[];
  has_more?: boolean;
  next_page?: string | null;
}

export interface OpenAiCostsBucket {
  object?: string;
  start_time?: number;
  end_time?: number;
  results?: readonly OpenAiCostsResult[];
}

export interface OpenAiCostsResult {
  object?: string;
  amount?: OpenAiCostAmount;
  line_item?: string;
}

export interface OpenAiCostAmount {
  currency?: string;
  value?: number | string;
}

export interface OpenAiNormalizedSnapshotBundle {
  usage: readonly OpenAiUsageSnapshot[];
  billing: readonly OpenAiBillingSnapshot[];
  serviceHealth: readonly OpenAiServiceHealthSnapshot[];
  costEstimates: readonly OpenAiCostEstimate[];
}

export interface OpenAiUsageSnapshot {
  provider: typeof OPENAI_PROVIDER;
  collectedAt: string;
  service: string;
  metric: "input_tokens" | "output_tokens" | "model_requests";
  unit: "tokens" | "requests";
  value: number;
}

export interface OpenAiBillingSnapshot {
  provider: typeof OPENAI_PROVIDER;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: "estimated";
}

export interface OpenAiServiceHealthSnapshot {
  provider: typeof OPENAI_PROVIDER;
  collectedAt: string;
  service: string;
  status: "ok" | "degraded" | "down" | "unknown";
}

export interface OpenAiCostEstimate {
  provider: typeof OPENAI_PROVIDER;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "medium";
}

export interface NormalizeOpenAiUsageCostsInput {
  payload: OpenAiUsageCostsPayload;
  collectedAt: string;
}

export function normalizeOpenAiUsageCosts(
  input: NormalizeOpenAiUsageCostsInput,
): OpenAiNormalizedSnapshotBundle {
  return {
    usage: normalizeUsage(input.payload.usage, input.collectedAt),
    billing: normalizeBilling(input.payload.costs, input.collectedAt),
    serviceHealth: [],
    costEstimates: normalizeCostEstimates(input.payload.costs, input.collectedAt),
  };
}

export function openAiAmountToMinorUnits(amount: number | string): number {
  const rawAmount = typeof amount === "number" ? String(requireFiniteNumber(amount, "OpenAI cost amount")) : amount;
  const trimmed = rawAmount.trim();
  const sign = trimmed.startsWith("-") ? -1n : 1n;
  const unsigned = sign === -1n ? trimmed.slice(1) : trimmed;

  if (!/^\d+(\.\d+)?$/.test(unsigned)) {
    throw new Error(`OpenAI currency amount must be a decimal string or finite number: ${rawAmount}`);
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
    throw new Error(`OpenAI currency amount is outside safe integer range: ${rawAmount}`);
  }

  return asNumber;
}

function normalizeUsage(page: OpenAiUsagePage, collectedAt: string): OpenAiUsageSnapshot[] {
  const usage: OpenAiUsageSnapshot[] = [];

  for (const bucket of page.data ?? []) {
    for (const result of bucket.results ?? []) {
      const service = `${usageServicePrefix(result)}:${requireModel(result)}`;
      const inputTokens = readOptionalFiniteNumber(result.input_tokens, `${service} input_tokens`);
      const outputTokens = readOptionalFiniteNumber(result.output_tokens, `${service} output_tokens`);
      const modelRequests = readOptionalFiniteNumber(result.num_model_requests, `${service} num_model_requests`);

      if (inputTokens !== undefined) {
        usage.push({
          provider: OPENAI_PROVIDER,
          collectedAt,
          service,
          metric: "input_tokens",
          unit: "tokens",
          value: inputTokens,
        });
      }

      if (outputTokens !== undefined) {
        usage.push({
          provider: OPENAI_PROVIDER,
          collectedAt,
          service,
          metric: "output_tokens",
          unit: "tokens",
          value: outputTokens,
        });
      }

      if (modelRequests !== undefined) {
        usage.push({
          provider: OPENAI_PROVIDER,
          collectedAt,
          service,
          metric: "model_requests",
          unit: "requests",
          value: modelRequests,
        });
      }
    }
  }

  return usage;
}

function normalizeBilling(page: OpenAiCostsPage, collectedAt: string): OpenAiBillingSnapshot[] {
  return normalizeCostBuckets(page, collectedAt).map((bucket) => ({
    provider: OPENAI_PROVIDER,
    collectedAt,
    periodStart: bucket.periodStart,
    periodEnd: bucket.periodEnd,
    amountMinor: bucket.amountMinor,
    currency: bucket.currency,
    status: "estimated",
  }));
}

function normalizeCostEstimates(page: OpenAiCostsPage, collectedAt: string): OpenAiCostEstimate[] {
  return normalizeCostBuckets(page, collectedAt).map((bucket) => ({
    provider: OPENAI_PROVIDER,
    collectedAt,
    periodStart: bucket.periodStart,
    periodEnd: bucket.periodEnd,
    estimatedAmountMinor: bucket.amountMinor,
    currency: bucket.currency,
    confidence: "medium",
  }));
}

interface NormalizedCostBucket {
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
}

function normalizeCostBuckets(page: OpenAiCostsPage, collectedAt: string): NormalizedCostBucket[] {
  const buckets: NormalizedCostBucket[] = [];

  for (const bucket of page.data ?? []) {
    const results = bucket.results ?? [];

    if (results.length === 0) {
      continue;
    }

    let amountMinor = 0;
    let currency: string | undefined;

    for (const result of results) {
      const amount = requireAmount(result);
      const resultCurrency = requireCurrency(amount);

      if (currency !== undefined && currency !== resultCurrency) {
        throw new Error("OpenAI costs bucket contains multiple currencies.");
      }

      currency = resultCurrency;
      amountMinor += openAiAmountToMinorUnits(requireAmountValue(amount));
    }

    if (currency === undefined) {
      continue;
    }

    buckets.push({
      periodStart: unixSecondsToDateString(requireUnixSeconds(bucket.start_time, "OpenAI costs bucket start_time")),
      periodEnd: unixSecondsToDateString(requireUnixSeconds(bucket.end_time, "OpenAI costs bucket end_time")),
      amountMinor,
      currency,
    });
  }

  return buckets;
}

function usageServicePrefix(result: OpenAiUsageResult): "completions" | "embeddings" {
  const objectName = result.object ?? "";

  if (objectName.includes(".embeddings.")) {
    return "embeddings";
  }

  return "completions";
}

function requireModel(result: OpenAiUsageResult): string {
  const model = result.model?.trim();

  if (model === undefined || model.length === 0) {
    throw new Error("OpenAI usage result is missing model.");
  }

  return model;
}

function requireAmount(result: OpenAiCostsResult): OpenAiCostAmount {
  if (result.amount === undefined) {
    throw new Error("OpenAI costs result is missing amount.");
  }

  return result.amount;
}

function requireCurrency(amount: OpenAiCostAmount): string {
  const currency = amount.currency?.trim();

  if (currency === undefined || currency.length === 0) {
    throw new Error("OpenAI costs amount is missing currency.");
  }

  return currency.toUpperCase();
}

function requireAmountValue(amount: OpenAiCostAmount): number | string {
  if (amount.value === undefined) {
    throw new Error("OpenAI costs amount is missing value.");
  }

  return amount.value;
}

function readOptionalFiniteNumber(value: number | undefined, context: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireFiniteNumber(value, context);
}

function requireFiniteNumber(value: number, context: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number.`);
  }

  return value;
}

function requireUnixSeconds(value: number | undefined, context: string): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite Unix timestamp in seconds.`);
  }

  return value;
}

function unixSecondsToDateString(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}
