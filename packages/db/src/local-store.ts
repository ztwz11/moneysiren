import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { runMigrations, type MigrationRunResult } from "./migrate.js";
import { resolveSqliteBin, SQLITE_BIN_ENV_KEY } from "./sqlite-bin.js";

const EMPTY_METADATA_JSON = "{}";
const requireNodeModule = createRequire(import.meta.url);

export interface LocalProviderRecord {
  id: string;
  key: string;
  displayName: string;
  connectorVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalUsageSnapshotRecord {
  id: string;
  providerKey: string;
  collectedAt: string;
  service: string;
  metric: string;
  unit: string;
  value: number;
  providerAccountRef?: string;
  metadataJson: Record<string, never>;
}

export interface LocalBillingSnapshotRecord {
  id: string;
  providerKey: string;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: string;
  providerAccountRef?: string;
  metadataJson: Record<string, never>;
}

export interface LocalServiceHealthSnapshotRecord {
  id: string;
  providerKey: string;
  collectedAt: string;
  service: string;
  region?: string;
  status: "ok" | "degraded" | "down" | "unknown";
  message?: string;
  metadataJson: Record<string, never>;
}

export interface LocalCostEstimateRecord {
  id: string;
  providerKey: string;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "low" | "medium" | "high";
  providerAccountRef?: string;
  metadataJson: Record<string, never>;
}

export interface LocalAlertRecord {
  id: string;
  providerKey?: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
  category: string;
  title: string;
  message: string;
  metadataJson: Record<string, never>;
}

export interface LocalReportRunRecord {
  id: string;
  createdAt: string;
  reportDate: string;
  language: "ko" | "en";
  deliveryTarget: "stdout" | "local-file" | "slack";
  status: "rendered" | "sent" | "error";
  metadataJson: Record<string, never>;
}

export interface LocalEmergencyActionRunRecord {
  id: string;
  providerKey: string;
  actionKey: string;
  mode: "requirements_only" | "manual" | "dry_run";
  readiness: string;
  requestedAt: string;
  confirmedAt?: string;
  status: "viewed" | "dry_run" | "blocked" | "error";
  reasonCode: string;
  targetLabelRedacted?: string;
  targetHash?: string;
  resultSummary: string;
  errorCode?: string;
  localOnly: true;
  secretsReturned: false;
  metadataJson: Record<string, never>;
}

export type LocalProviderSyncStatus = "ok" | "partial" | "error";

export type LocalProviderSyncErrorCode =
  | "SYNC_PARTIAL"
  | "SYNC_COLLECTION"
  | "SYNC_NO_USABLE_DATA"
  | "SYNC_CONFIGURATION"
  | "SYNC_EXECUTION";

export interface LocalProviderSyncRunRecord {
  id: string;
  providerKey: string;
  attemptedAt: string;
  completedAt?: string;
  status: LocalProviderSyncStatus;
  snapshotCount: number;
  usageCount: number;
  billingCount: number;
  healthCount: number;
  estimateCount: number;
  alertCount: number;
  errorCode?: LocalProviderSyncErrorCode;
  sanitizedMessage?: string;
  dataThrough?: string;
  metadataJson: Record<string, never>;
}

export interface LocalStore {
  appliedMigrationIds: string[];
  providers: LocalProviderRecord[];
  usageSnapshots: LocalUsageSnapshotRecord[];
  billingSnapshots: LocalBillingSnapshotRecord[];
  serviceHealthSnapshots: LocalServiceHealthSnapshotRecord[];
  costEstimates: LocalCostEstimateRecord[];
  alerts: LocalAlertRecord[];
  reportRuns: LocalReportRunRecord[];
  emergencyActionRuns: LocalEmergencyActionRunRecord[];
  providerSyncRuns: LocalProviderSyncRunRecord[];
}

export interface LocalStoreOptions {
  dbPath: string;
}

export interface LocalProviderCollectionInput {
  dbPath: string;
  provider: {
    key: string;
    displayName: string;
    connectorVersion: string;
  };
  collectedAt: string;
  status: "ok" | "partial" | "error";
  snapshots: {
    usage: readonly LocalUsageSnapshotInput[];
    billing: readonly LocalBillingSnapshotInput[];
    serviceHealth: readonly LocalServiceHealthSnapshotInput[];
    costEstimates: readonly LocalCostEstimateInput[];
  };
  alerts: readonly LocalAlertInput[];
}

export interface LocalProviderSyncRunInput {
  dbPath: string;
  providerKey: string;
  attemptedAt: string;
  completedAt?: string;
  status: LocalProviderSyncStatus;
  usageCount: number;
  billingCount: number;
  healthCount: number;
  estimateCount: number;
  alertCount: number;
  dataThrough?: string;
  errorCode?: LocalProviderSyncErrorCode;
}

export interface LocalUsageSnapshotInput {
  provider: string;
  collectedAt: string;
  service?: string;
  metric: string;
  unit: string;
  value: number;
  providerAccountRef?: string;
}

export interface LocalBillingSnapshotInput {
  provider: string;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: string;
  providerAccountRef?: string;
}

export interface LocalServiceHealthSnapshotInput {
  provider: string;
  collectedAt: string;
  service: string;
  region?: string;
  status: "ok" | "degraded" | "down" | "unknown";
  message?: string;
}

export interface LocalCostEstimateInput {
  provider: string;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "low" | "medium" | "high";
  providerAccountRef?: string;
}

export interface LocalAlertInput {
  provider?: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
  category: string;
  title: string;
  message: string;
}

export interface LocalReportRunInput {
  dbPath: string;
  createdAt: string;
  reportDate: string;
  language: "ko" | "en";
  deliveryTarget: "stdout" | "local-file" | "slack";
  status: "rendered" | "sent" | "error";
}

export interface LocalEmergencyActionRunInput {
  dbPath: string;
  providerKey: string;
  actionKey: string;
  mode: "requirements_only" | "manual" | "dry_run";
  readiness: string;
  requestedAt: string;
  confirmedAt?: string;
  status: "viewed" | "dry_run" | "blocked" | "error";
  reasonCode: string;
  targetLabelRedacted?: string;
  targetHash?: string;
  resultSummary: string;
  errorCode?: string;
  localOnly: true;
  secretsReturned: false;
}

const FORBIDDEN_KEY_PATTERN = /^(raw|rawPayload|rawResponse|providerPayload|providerResponse|billingProfile)$/i;
const FORBIDDEN_STRING_PATTERN = /acct_|project_|invoice_|sk-|hooks\.slack|@/i;
const SYNC_ERROR_MESSAGES: Readonly<Record<LocalProviderSyncErrorCode, string>> = {
  SYNC_PARTIAL: "Provider sync completed with partial data.",
  SYNC_COLLECTION: "Provider sync failed before usable data was collected.",
  SYNC_NO_USABLE_DATA: "Provider sync returned no usable data.",
  SYNC_CONFIGURATION: "Provider sync configuration is unavailable.",
  SYNC_EXECUTION: "Provider sync could not be completed.",
};

export async function initializeLocalStore(options: LocalStoreOptions): Promise<MigrationRunResult> {
  const dbPath = normalizeDbPath(options.dbPath);
  await mkdir(dirname(dbPath), { recursive: true });

  return runMigrations({
    async getAppliedMigrationIds() {
      return getAppliedMigrationIds(dbPath);
    },
    async execute(sql) {
      await executeSqlite(dbPath, sql);
    },
    async recordMigration(id) {
      await executeSqlite(
        dbPath,
        `INSERT INTO schema_migrations (id) VALUES (${sqlString(id)}) ON CONFLICT(id) DO NOTHING;`,
      );
    },
  });
}

export async function readLocalStore(options: LocalStoreOptions): Promise<LocalStore> {
  const dbPath = normalizeDbPath(options.dbPath);

  return {
    appliedMigrationIds: getAppliedMigrationIds(dbPath),
    providers: readProviders(dbPath),
    usageSnapshots: readUsageSnapshots(dbPath),
    billingSnapshots: readBillingSnapshots(dbPath),
    serviceHealthSnapshots: readServiceHealthSnapshots(dbPath),
    costEstimates: readCostEstimates(dbPath),
    alerts: readAlerts(dbPath),
    reportRuns: readReportRuns(dbPath),
    emergencyActionRuns: readEmergencyActionRuns(dbPath),
    providerSyncRuns: readProviderSyncRuns(dbPath),
  };
}

export async function saveLocalProviderCollection(input: LocalProviderCollectionInput): Promise<void> {
  assertSafeForPersistence(input);
  await initializeLocalStore({ dbPath: input.dbPath });

  const dbPath = normalizeDbPath(input.dbPath);
  const providerId = providerIdFor(input.provider.key);
  const providerAccountRefs = collectProviderAccountRefs(input);
  const dataThrough = latestCollectionTimestamp(input);
  const statements: string[] = [
    upsertProviderSql({
      id: providerId,
      key: input.provider.key,
      displayName: input.provider.displayName,
      connectorVersion: input.provider.connectorVersion,
      timestamp: input.collectedAt,
    }),
  ];

  if (input.status === "ok") {
    statements.push(deleteProviderSyncAlertsSql(providerId));
  }

  for (const providerAccountRef of providerAccountRefs) {
    statements.push(upsertProviderAccountSql(providerId, input.provider.key, providerAccountRef, input.collectedAt));
  }

  for (const snapshot of input.snapshots.usage) {
    statements.push(insertUsageSnapshotSql(providerId, input.provider.key, snapshot));
  }

  for (const snapshot of input.snapshots.billing) {
    statements.push(insertBillingSnapshotSql(providerId, input.provider.key, snapshot));
  }

  for (const snapshot of input.snapshots.serviceHealth) {
    statements.push(insertServiceHealthSnapshotSql(providerId, snapshot));
  }

  for (const snapshot of input.snapshots.costEstimates) {
    statements.push(insertCostEstimateSql(providerId, input.provider.key, snapshot));
  }

  for (const alert of input.alerts) {
    statements.push(insertAlertSql(alert));
  }

  statements.push(insertProviderSyncRunSql({
    dbPath: input.dbPath,
    providerKey: input.provider.key,
    attemptedAt: input.collectedAt,
    completedAt: input.collectedAt,
    status: input.status,
    usageCount: input.snapshots.usage.length,
    billingCount: input.snapshots.billing.length,
    healthCount: input.snapshots.serviceHealth.length,
    estimateCount: input.snapshots.costEstimates.length,
    alertCount: input.alerts.length,
    ...(dataThrough === undefined ? {} : { dataThrough }),
  }));

  executeSqliteTransaction(dbPath, statements);
}

export async function recordLocalProviderSyncRun(input: LocalProviderSyncRunInput): Promise<void> {
  assertSafeForPersistence(input);
  validateProviderSyncRunInput(input);
  await initializeLocalStore({ dbPath: input.dbPath });

  executeSqliteTransaction(normalizeDbPath(input.dbPath), [
    insertProviderSyncRunSql(input),
  ]);
}

export async function recordLocalReportRun(input: LocalReportRunInput): Promise<void> {
  assertSafeForPersistence(input);
  await initializeLocalStore({ dbPath: input.dbPath });

  executeSqliteTransaction(normalizeDbPath(input.dbPath), [
    `
    INSERT INTO report_runs (id, created_at, report_date, language, delivery_target, status, metadata_json)
    VALUES (
      ${sqlString(randomUUID())},
      ${sqlString(input.createdAt)},
      ${sqlString(input.reportDate)},
      ${sqlString(input.language)},
      ${sqlString(input.deliveryTarget)},
      ${sqlString(input.status)},
      ${sqlString(EMPTY_METADATA_JSON)}
    );
    `,
  ]);
}

export async function recordEmergencyActionRun(input: LocalEmergencyActionRunInput): Promise<void> {
  assertSafeForPersistence(input);
  const rawInput = input as { mode?: unknown; status?: unknown; executedAt?: unknown };

  if (input.localOnly !== true || input.secretsReturned !== false) {
    throw new Error("Emergency action audit records must be local-only and secret-free.");
  }

  if (rawInput.mode === "execute" || rawInput.status === "executed" || rawInput.executedAt !== undefined) {
    throw new Error("Emergency provider write execution is disabled in this build.");
  }

  await initializeLocalStore({ dbPath: input.dbPath });

  executeSqliteTransaction(normalizeDbPath(input.dbPath), [
    insertEmergencyActionRunSql(input),
  ]);
}

function getAppliedMigrationIds(dbPath: string): string[] {
  const schemaMigrationTables = querySqliteRowsSync<{ name: string }>(
    dbPath,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations';",
  );

  if (schemaMigrationTables.length === 0) {
    return [];
  }

  return querySqliteRowsSync<{ id: string }>(dbPath, "SELECT id FROM schema_migrations ORDER BY id;").map(
    (row) => row.id,
  );
}

function readProviders(dbPath: string): LocalProviderRecord[] {
  return querySqliteRowsSync<ProviderRow>(
    dbPath,
    `
    SELECT
      id,
      provider_key AS key,
      display_name AS displayName,
      connector_version AS connectorVersion,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM providers
    ORDER BY provider_key;
    `,
  );
}

function readUsageSnapshots(dbPath: string): LocalUsageSnapshotRecord[] {
  return querySqliteRowsSync<UsageSnapshotRow>(
    dbPath,
    `
    SELECT
      usage_snapshots.id AS id,
      providers.provider_key AS providerKey,
      provider_accounts.account_ref AS providerAccountRef,
      usage_snapshots.collected_at AS collectedAt,
      usage_snapshots.service AS service,
      usage_snapshots.metric AS metric,
      usage_snapshots.unit AS unit,
      usage_snapshots.value AS value,
      usage_snapshots.metadata_json AS metadataJson
    FROM usage_snapshots
    JOIN providers ON providers.id = usage_snapshots.provider_id
    LEFT JOIN provider_accounts ON provider_accounts.id = usage_snapshots.provider_account_id
    ORDER BY usage_snapshots.collected_at, usage_snapshots.id;
    `,
  ).map((row) => ({
    id: row.id,
    providerKey: row.providerKey,
    collectedAt: row.collectedAt,
    service: row.service,
    metric: row.metric,
    unit: row.unit,
    value: row.value,
    metadataJson: emptyMetadata(row.metadataJson),
    ...(row.providerAccountRef === null ? {} : { providerAccountRef: row.providerAccountRef }),
  }));
}

function readBillingSnapshots(dbPath: string): LocalBillingSnapshotRecord[] {
  return querySqliteRowsSync<BillingSnapshotRow>(
    dbPath,
    `
    SELECT
      billing_snapshots.id AS id,
      providers.provider_key AS providerKey,
      provider_accounts.account_ref AS providerAccountRef,
      billing_snapshots.collected_at AS collectedAt,
      billing_snapshots.period_start AS periodStart,
      billing_snapshots.period_end AS periodEnd,
      billing_snapshots.amount_minor AS amountMinor,
      billing_snapshots.currency AS currency,
      billing_snapshots.status AS status,
      billing_snapshots.metadata_json AS metadataJson
    FROM billing_snapshots
    JOIN providers ON providers.id = billing_snapshots.provider_id
    LEFT JOIN provider_accounts ON provider_accounts.id = billing_snapshots.provider_account_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM billing_snapshots AS newer_billing_snapshot
      WHERE newer_billing_snapshot.provider_id = billing_snapshots.provider_id
        AND newer_billing_snapshot.provider_account_id IS billing_snapshots.provider_account_id
        AND newer_billing_snapshot.period_start = billing_snapshots.period_start
        AND newer_billing_snapshot.period_end = billing_snapshots.period_end
        AND newer_billing_snapshot.currency = billing_snapshots.currency
        AND (
          newer_billing_snapshot.collected_at > billing_snapshots.collected_at
          OR (
            newer_billing_snapshot.collected_at = billing_snapshots.collected_at
            AND newer_billing_snapshot.id > billing_snapshots.id
          )
        )
    )
    ORDER BY billing_snapshots.collected_at, billing_snapshots.id;
    `,
  ).map((row) => ({
    id: row.id,
    providerKey: row.providerKey,
    collectedAt: row.collectedAt,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    metadataJson: emptyMetadata(row.metadataJson),
    ...(row.providerAccountRef === null ? {} : { providerAccountRef: row.providerAccountRef }),
  }));
}

function readServiceHealthSnapshots(dbPath: string): LocalServiceHealthSnapshotRecord[] {
  return querySqliteRowsSync<ServiceHealthSnapshotRow>(
    dbPath,
    `
    SELECT
      service_health_snapshots.id AS id,
      providers.provider_key AS providerKey,
      service_health_snapshots.collected_at AS collectedAt,
      service_health_snapshots.service AS service,
      service_health_snapshots.region AS region,
      service_health_snapshots.status AS status,
      service_health_snapshots.message AS message,
      service_health_snapshots.metadata_json AS metadataJson
    FROM service_health_snapshots
    JOIN providers ON providers.id = service_health_snapshots.provider_id
    ORDER BY service_health_snapshots.collected_at, service_health_snapshots.id;
    `,
  ).map((row) => ({
    id: row.id,
    providerKey: row.providerKey,
    collectedAt: row.collectedAt,
    service: row.service,
    status: row.status,
    metadataJson: emptyMetadata(row.metadataJson),
    ...(row.region === null ? {} : { region: row.region }),
    ...(row.message === null ? {} : { message: row.message }),
  }));
}

function readCostEstimates(dbPath: string): LocalCostEstimateRecord[] {
  return querySqliteRowsSync<CostEstimateRow>(
    dbPath,
    `
    SELECT
      cost_estimates.id AS id,
      providers.provider_key AS providerKey,
      provider_accounts.account_ref AS providerAccountRef,
      cost_estimates.collected_at AS collectedAt,
      cost_estimates.period_start AS periodStart,
      cost_estimates.period_end AS periodEnd,
      cost_estimates.estimated_amount_minor AS estimatedAmountMinor,
      cost_estimates.currency AS currency,
      cost_estimates.confidence AS confidence,
      cost_estimates.metadata_json AS metadataJson
    FROM cost_estimates
    JOIN providers ON providers.id = cost_estimates.provider_id
    LEFT JOIN provider_accounts ON provider_accounts.id = cost_estimates.provider_account_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM cost_estimates AS newer_cost_estimate
      WHERE newer_cost_estimate.provider_id = cost_estimates.provider_id
        AND newer_cost_estimate.provider_account_id IS cost_estimates.provider_account_id
        AND newer_cost_estimate.period_start = cost_estimates.period_start
        AND newer_cost_estimate.period_end = cost_estimates.period_end
        AND newer_cost_estimate.currency = cost_estimates.currency
        AND (
          newer_cost_estimate.collected_at > cost_estimates.collected_at
          OR (
            newer_cost_estimate.collected_at = cost_estimates.collected_at
            AND newer_cost_estimate.id > cost_estimates.id
          )
        )
    )
    ORDER BY cost_estimates.collected_at, cost_estimates.id;
    `,
  ).map((row) => ({
    id: row.id,
    providerKey: row.providerKey,
    collectedAt: row.collectedAt,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    estimatedAmountMinor: row.estimatedAmountMinor,
    currency: row.currency,
    confidence: row.confidence,
    metadataJson: emptyMetadata(row.metadataJson),
    ...(row.providerAccountRef === null ? {} : { providerAccountRef: row.providerAccountRef }),
  }));
}

function readAlerts(dbPath: string): LocalAlertRecord[] {
  return querySqliteRowsSync<AlertRow>(
    dbPath,
    `
    SELECT
      alerts.id AS id,
      providers.provider_key AS providerKey,
      alerts.created_at AS createdAt,
      alerts.severity AS severity,
      alerts.category AS category,
      alerts.title AS title,
      alerts.message AS message,
      alerts.metadata_json AS metadataJson
    FROM alerts
    LEFT JOIN providers ON providers.id = alerts.provider_id
    ORDER BY alerts.created_at, alerts.id;
    `,
  ).map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    severity: row.severity,
    category: row.category,
    title: row.title,
    message: row.message,
    metadataJson: emptyMetadata(row.metadataJson),
    ...(row.providerKey === null ? {} : { providerKey: row.providerKey }),
  }));
}

function readReportRuns(dbPath: string): LocalReportRunRecord[] {
  return querySqliteRowsSync<ReportRunRow>(
    dbPath,
    `
    SELECT
      id,
      created_at AS createdAt,
      report_date AS reportDate,
      language,
      delivery_target AS deliveryTarget,
      status,
      metadata_json AS metadataJson
    FROM report_runs
    ORDER BY created_at, id;
    `,
  ).map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    reportDate: row.reportDate,
    language: row.language,
    deliveryTarget: row.deliveryTarget,
    status: row.status,
    metadataJson: emptyMetadata(row.metadataJson),
  }));
}

function readEmergencyActionRuns(dbPath: string): LocalEmergencyActionRunRecord[] {
  if (!tableExists(dbPath, "emergency_action_runs")) {
    return [];
  }

  return querySqliteRowsSync<EmergencyActionRunRow>(
    dbPath,
    `
    SELECT
      id,
      provider_key AS providerKey,
      action_key AS actionKey,
      mode,
      readiness,
      requested_at AS requestedAt,
      confirmed_at AS confirmedAt,
      executed_at AS executedAt,
      status,
      reason_code AS reasonCode,
      target_label_redacted AS targetLabelRedacted,
      target_hash AS targetHash,
      result_summary AS resultSummary,
      error_code AS errorCode,
      local_only AS localOnly,
      secrets_returned AS secretsReturned,
      metadata_json AS metadataJson
    FROM emergency_action_runs
    ORDER BY requested_at, id;
    `,
  ).map((row) => {
    if (row.localOnly !== 1 || row.secretsReturned !== 0) {
      throw new Error("Emergency action audit record flags are invalid.");
    }

    return {
      id: row.id,
      providerKey: row.providerKey,
      actionKey: row.actionKey,
      mode: row.mode,
      readiness: row.readiness,
      requestedAt: row.requestedAt,
      status: row.status,
      reasonCode: row.reasonCode,
      resultSummary: row.resultSummary,
      localOnly: true,
      secretsReturned: false,
      metadataJson: emptyMetadata(row.metadataJson),
      ...(row.confirmedAt === null ? {} : { confirmedAt: row.confirmedAt }),
      ...(row.targetLabelRedacted === null ? {} : { targetLabelRedacted: row.targetLabelRedacted }),
      ...(row.targetHash === null ? {} : { targetHash: row.targetHash }),
      ...(row.errorCode === null ? {} : { errorCode: row.errorCode }),
    };
  });
}

function readProviderSyncRuns(dbPath: string): LocalProviderSyncRunRecord[] {
  if (!tableExists(dbPath, "provider_sync_runs")) {
    return [];
  }

  return querySqliteRowsSync<ProviderSyncRunRow>(
    dbPath,
    `
    SELECT
      id,
      provider_key AS providerKey,
      attempted_at AS attemptedAt,
      completed_at AS completedAt,
      status,
      usage_count AS usageCount,
      billing_count AS billingCount,
      health_count AS healthCount,
      estimate_count AS estimateCount,
      alert_count AS alertCount,
      error_code AS errorCode,
      error_message AS sanitizedMessage,
      data_through AS dataThrough,
      metadata_json AS metadataJson
    FROM provider_sync_runs
    ORDER BY attempted_at, id;
    `,
  ).map((row) => ({
    id: row.id,
    providerKey: row.providerKey,
    attemptedAt: row.attemptedAt,
    status: row.status,
    snapshotCount: row.usageCount + row.billingCount + row.healthCount + row.estimateCount,
    usageCount: row.usageCount,
    billingCount: row.billingCount,
    healthCount: row.healthCount,
    estimateCount: row.estimateCount,
    alertCount: row.alertCount,
    metadataJson: emptyMetadata(row.metadataJson),
    ...(row.completedAt === null ? {} : { completedAt: row.completedAt }),
    ...(row.errorCode === null ? {} : { errorCode: row.errorCode }),
    ...(row.sanitizedMessage === null ? {} : { sanitizedMessage: row.sanitizedMessage }),
    ...(row.dataThrough === null ? {} : { dataThrough: row.dataThrough }),
  }));
}

function upsertProviderSql(input: {
  id: string;
  key: string;
  displayName: string;
  connectorVersion: string;
  timestamp: string;
}): string {
  return `
  INSERT INTO providers (id, provider_key, display_name, connector_version, created_at, updated_at)
  VALUES (
    ${sqlString(input.id)},
    ${sqlString(input.key)},
    ${sqlString(input.displayName)},
    ${sqlString(input.connectorVersion)},
    ${sqlString(input.timestamp)},
    ${sqlString(input.timestamp)}
  )
  ON CONFLICT(provider_key) DO UPDATE SET
    display_name = excluded.display_name,
    connector_version = excluded.connector_version,
    updated_at = excluded.updated_at;
  `;
}

function upsertProviderAccountSql(
  providerId: string,
  providerKey: string,
  providerAccountRef: string,
  timestamp: string,
): string {
  return `
  INSERT INTO provider_accounts (id, provider_id, account_label, account_ref, created_at, updated_at)
  VALUES (
    ${sqlString(providerAccountIdFor(providerKey, providerAccountRef))},
    ${sqlString(providerId)},
    ${sqlString("redacted-provider-account")},
    ${sqlString(providerAccountDigest(providerAccountRef))},
    ${sqlString(timestamp)},
    ${sqlString(timestamp)}
  )
  ON CONFLICT(provider_id, account_ref) DO UPDATE SET
    updated_at = excluded.updated_at;
  `;
}

function insertUsageSnapshotSql(providerId: string, providerKey: string, snapshot: LocalUsageSnapshotInput): string {
  return `
  INSERT INTO usage_snapshots (
    id, provider_id, provider_account_id, collected_at, service, metric, unit, value, metadata_json
  )
  VALUES (
    ${sqlString(randomUUID())},
    ${sqlString(providerId)},
    ${sqlProviderAccountId(providerKey, snapshot.providerAccountRef)},
    ${sqlString(snapshot.collectedAt)},
    ${sqlString(snapshot.service ?? "unknown")},
    ${sqlString(snapshot.metric)},
    ${sqlString(snapshot.unit)},
    ${sqlNumber(snapshot.value)},
    ${sqlString(EMPTY_METADATA_JSON)}
  );
  `;
}

function insertBillingSnapshotSql(providerId: string, providerKey: string, snapshot: LocalBillingSnapshotInput): string {
  return `
  INSERT INTO billing_snapshots (
    id, provider_id, provider_account_id, collected_at, period_start, period_end, amount_minor, currency, status,
    metadata_json
  )
  VALUES (
    ${sqlString(randomUUID())},
    ${sqlString(providerId)},
    ${sqlProviderAccountId(providerKey, snapshot.providerAccountRef)},
    ${sqlString(snapshot.collectedAt)},
    ${sqlString(snapshot.periodStart)},
    ${sqlString(snapshot.periodEnd)},
    ${sqlInteger(snapshot.amountMinor)},
    ${sqlString(snapshot.currency)},
    ${sqlString(snapshot.status)},
    ${sqlString(EMPTY_METADATA_JSON)}
  );
  `;
}

function insertServiceHealthSnapshotSql(providerId: string, snapshot: LocalServiceHealthSnapshotInput): string {
  return `
  INSERT INTO service_health_snapshots (
    id, provider_id, collected_at, service, region, status, message, metadata_json
  )
  VALUES (
    ${sqlString(randomUUID())},
    ${sqlString(providerId)},
    ${sqlString(snapshot.collectedAt)},
    ${sqlString(snapshot.service)},
    ${sqlNullableString(snapshot.region)},
    ${sqlString(snapshot.status)},
    ${sqlNullableString(snapshot.message)},
    ${sqlString(EMPTY_METADATA_JSON)}
  );
  `;
}

function insertCostEstimateSql(providerId: string, providerKey: string, snapshot: LocalCostEstimateInput): string {
  return `
  INSERT INTO cost_estimates (
    id, provider_id, provider_account_id, collected_at, period_start, period_end, estimated_amount_minor, currency,
    confidence, metadata_json
  )
  VALUES (
    ${sqlString(randomUUID())},
    ${sqlString(providerId)},
    ${sqlProviderAccountId(providerKey, snapshot.providerAccountRef)},
    ${sqlString(snapshot.collectedAt)},
    ${sqlString(snapshot.periodStart)},
    ${sqlString(snapshot.periodEnd)},
    ${sqlInteger(snapshot.estimatedAmountMinor)},
    ${sqlString(snapshot.currency)},
    ${sqlString(snapshot.confidence)},
    ${sqlString(EMPTY_METADATA_JSON)}
  );
  `;
}

function insertAlertSql(alert: LocalAlertInput): string {
  return `
  INSERT INTO alerts (id, provider_id, created_at, severity, category, title, message, metadata_json)
  VALUES (
    ${sqlString(randomUUID())},
    ${alert.provider === undefined ? "NULL" : sqlString(providerIdFor(alert.provider))},
    ${sqlString(alert.createdAt)},
    ${sqlString(alert.severity)},
    ${sqlString(alert.category)},
    ${sqlString(alert.title)},
    ${sqlString(alert.message)},
    ${sqlString(EMPTY_METADATA_JSON)}
  );
  `;
}

function insertProviderSyncRunSql(input: LocalProviderSyncRunInput): string {
  validateProviderSyncRunInput(input);
  const status = normalizedSyncStatus(input);
  const errorCode = syncErrorCodeFor(input);
  const sanitizedMessage = errorCode === undefined ? undefined : SYNC_ERROR_MESSAGES[errorCode];

  return `
  INSERT INTO provider_sync_runs (
    id, provider_key, attempted_at, completed_at, status, usage_count, billing_count, health_count,
    estimate_count, alert_count, error_code, error_message, data_through, metadata_json
  )
  VALUES (
    ${sqlString(randomUUID())},
    ${sqlString(input.providerKey)},
    ${sqlString(input.attemptedAt)},
    ${sqlNullableString(input.completedAt)},
    ${sqlString(status)},
    ${sqlInteger(input.usageCount)},
    ${sqlInteger(input.billingCount)},
    ${sqlInteger(input.healthCount)},
    ${sqlInteger(input.estimateCount)},
    ${sqlInteger(input.alertCount)},
    ${sqlNullableString(errorCode)},
    ${sqlNullableString(sanitizedMessage)},
    ${sqlNullableString(input.dataThrough)},
    ${sqlString(EMPTY_METADATA_JSON)}
  );
  `;
}

function insertEmergencyActionRunSql(input: LocalEmergencyActionRunInput): string {
  return `
  INSERT INTO emergency_action_runs (
    id, provider_key, action_key, mode, readiness, requested_at, confirmed_at, executed_at, status,
    reason_code, target_label_redacted, target_hash, result_summary, error_code, local_only, secrets_returned,
    metadata_json
  )
  VALUES (
    ${sqlString(randomUUID())},
    ${sqlString(input.providerKey)},
    ${sqlString(input.actionKey)},
    ${sqlString(input.mode)},
    ${sqlString(input.readiness)},
    ${sqlString(input.requestedAt)},
    ${sqlNullableString(input.confirmedAt)},
    NULL,
    ${sqlString(input.status)},
    ${sqlString(input.reasonCode)},
    ${sqlNullableString(input.targetLabelRedacted)},
    ${sqlNullableString(input.targetHash)},
    ${sqlString(input.resultSummary)},
    ${sqlNullableString(input.errorCode)},
    ${sqlBoolean(input.localOnly)},
    ${sqlBoolean(input.secretsReturned)},
    ${sqlString(EMPTY_METADATA_JSON)}
  );
  `;
}

function deleteProviderSyncAlertsSql(providerId: string): string {
  return `
  DELETE FROM alerts
  WHERE provider_id = ${sqlString(providerId)}
    AND category = 'provider-sync';
  `;
}

function latestCollectionTimestamp(input: LocalProviderCollectionInput): string | undefined {
  const timestamps = [
    ...input.snapshots.usage.map((snapshot) => snapshot.collectedAt),
    ...input.snapshots.billing.map((snapshot) => snapshot.collectedAt),
    ...input.snapshots.serviceHealth.map((snapshot) => snapshot.collectedAt),
    ...input.snapshots.costEstimates.map((snapshot) => snapshot.collectedAt),
  ];

  return timestamps.sort().at(-1);
}

function syncErrorCodeFor(input: LocalProviderSyncRunInput): LocalProviderSyncErrorCode | undefined {
  const status = normalizedSyncStatus(input);

  if (status === "ok") {
    return undefined;
  }

  if (input.status === "partial" && snapshotCountForSyncRun(input) === 0) {
    return "SYNC_NO_USABLE_DATA";
  }

  return input.errorCode ?? (status === "partial" ? "SYNC_PARTIAL" : "SYNC_COLLECTION");
}

function normalizedSyncStatus(input: LocalProviderSyncRunInput): LocalProviderSyncStatus {
  return input.status === "partial" && snapshotCountForSyncRun(input) === 0
    ? "error"
    : input.status;
}

function snapshotCountForSyncRun(input: LocalProviderSyncRunInput): number {
  return input.usageCount + input.billingCount + input.healthCount + input.estimateCount;
}

function validateProviderSyncRunInput(input: LocalProviderSyncRunInput): void {
  const counts = [
    input.usageCount,
    input.billingCount,
    input.healthCount,
    input.estimateCount,
    input.alertCount,
  ];

  if (counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error("Provider sync-run counts must be non-negative safe integers.");
  }

  if (input.status === "ok" && input.errorCode !== undefined) {
    throw new Error("Successful provider sync runs cannot contain an error code.");
  }
}

function collectProviderAccountRefs(input: LocalProviderCollectionInput): string[] {
  const refs = new Set<string>();
  const collect = (providerAccountRef: string | undefined) => {
    if (providerAccountRef !== undefined) {
      refs.add(providerAccountRef);
    }
  };

  for (const snapshot of input.snapshots.usage) {
    collect(snapshot.providerAccountRef);
  }

  for (const snapshot of input.snapshots.billing) {
    collect(snapshot.providerAccountRef);
  }

  for (const snapshot of input.snapshots.costEstimates) {
    collect(snapshot.providerAccountRef);
  }

  return [...refs].sort();
}

function executeSqliteTransaction(dbPath: string, statements: readonly string[]): void {
  if (statements.length === 0) {
    return;
  }

  executeSqliteSync(dbPath, ["BEGIN;", ...statements, "COMMIT;"].join("\n"));
}

async function executeSqlite(dbPath: string, sql: string): Promise<void> {
  try {
    executeSqliteWithCli(dbPath, sql);
  } catch (caught) {
    if (!shouldFallbackToNodeSqlite(caught)) {
      throw caught;
    }

    executeSqliteWithNodeSync(dbPath, sql);
  }
}

function executeSqliteSync(dbPath: string, sql: string): void {
  try {
    executeSqliteWithCli(dbPath, sql);
  } catch (caught) {
    if (!shouldFallbackToNodeSqlite(caught)) {
      throw caught;
    }

    executeSqliteWithNodeSync(dbPath, sql);
  }
}

function querySqliteRowsSync<T>(dbPath: string, sql: string): T[] {
  try {
    return querySqliteRowsWithCli<T>(dbPath, sql);
  } catch (caught) {
    if (!shouldFallbackToNodeSqlite(caught)) {
      throw caught;
    }

    return querySqliteRowsWithNodeSync<T>(dbPath, sql);
  }
}

function executeSqliteWithCli(dbPath: string, sql: string): void {
  execFileSync(resolveSqliteBin(), [dbPath], {
    input: sqliteInput(sql),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function querySqliteRowsWithCli<T>(dbPath: string, sql: string): T[] {
  const output = execFileSync(resolveSqliteBin(), ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  }).trim();

  return parseSqliteJsonRows<T>(output);
}

function executeSqliteWithNodeSync(dbPath: string, sql: string): void {
  const database = createNodeSqliteDatabase(dbPath);

  try {
    database.exec(sqliteInput(sql));
  } finally {
    database.close();
  }
}

function querySqliteRowsWithNodeSync<T>(dbPath: string, sql: string): T[] {
  const database = createNodeSqliteDatabase(dbPath);

  try {
    database.exec("PRAGMA foreign_keys = ON;");
    return database.prepare(sql).all() as T[];
  } finally {
    database.close();
  }
}

function createNodeSqliteDatabase(dbPath: string): NodeSqliteDatabase {
  try {
    const nodeSqlite = requireNodeModule("node:sqlite") as {
      DatabaseSync: new (path: string) => NodeSqliteDatabase;
    };

    return new nodeSqlite.DatabaseSync(dbPath);
  } catch (caught) {
    throw new Error(
      `SQLite is unavailable. Install sqlite3 and put it on PATH, set ${SQLITE_BIN_ENV_KEY}, or run MoneySiren with a Node.js version that includes node:sqlite. ${
        caught instanceof Error ? caught.message : "node:sqlite could not be loaded."
      }`,
    );
  }
}

function tableExists(dbPath: string, tableName: string): boolean {
  const rows = querySqliteRowsSync<{ name: string }>(
    dbPath,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${sqlString(tableName)};`,
  );

  return rows.length > 0;
}

function parseSqliteJsonRows<T>(output: string): T[] {
  if (output.length === 0) {
    return [];
  }

  return JSON.parse(output) as T[];
}

function sqliteInput(sql: string): string {
  return `PRAGMA foreign_keys = ON;\n${sql.trim()}\n`;
}

function shouldFallbackToNodeSqlite(caught: unknown): boolean {
  if (process.env[SQLITE_BIN_ENV_KEY]?.trim()) {
    return false;
  }

  const error = caught as { code?: unknown; message?: unknown };
  const message = typeof error.message === "string" ? error.message : "";

  return error.code === "ENOENT" || /spawnSync .*ENOENT/i.test(message);
}

function normalizeDbPath(dbPath: string): string {
  const normalized = dbPath.trim();

  if (normalized.length === 0) {
    throw new Error("dbPath must not be blank.");
  }

  return normalized;
}

function providerIdFor(providerKey: string): string {
  return `provider:${providerKey}`;
}

function providerAccountIdFor(providerKey: string, providerAccountRef: string): string {
  return `provider-account:${providerKey}:${providerAccountDigest(providerAccountRef).slice(0, 32)}`;
}

function providerAccountDigest(providerAccountRef: string): string {
  return createHash("sha256").update(providerAccountRef).digest("hex");
}

function sqlProviderAccountId(providerKey: string, providerAccountRef: string | undefined): string {
  if (providerAccountRef === undefined) {
    return "NULL";
  }

  return sqlString(providerAccountIdFor(providerKey, providerAccountRef));
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullableString(value: string | undefined): string {
  return value === undefined ? "NULL" : sqlString(value);
}

function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("SQLite numeric value must be finite.");
  }

  return String(value);
}

function sqlInteger(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new Error("SQLite integer value must be a safe integer.");
  }

  return String(value);
}

function sqlBoolean(value: boolean): string {
  return value ? "1" : "0";
}

function emptyMetadata(metadataJson: string): Record<string, never> {
  if (metadataJson !== EMPTY_METADATA_JSON) {
    const parsed = JSON.parse(metadataJson) as unknown;
    assertSafeForPersistence(parsed);
  }

  return {};
}

function assertSafeForPersistence(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertSafeForPersistence(item);
    }
    return;
  }

  if (!isRecord(value)) {
    if (typeof value === "string" && FORBIDDEN_STRING_PATTERN.test(value)) {
      throw new Error("Sensitive provider value cannot be persisted.");
    }
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      throw new Error(`Raw provider payload field cannot be persisted: ${key}`);
    }
    assertSafeForPersistence(nestedValue);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface ProviderRow {
  id: string;
  key: string;
  displayName: string;
  connectorVersion: string;
  createdAt: string;
  updatedAt: string;
}

interface UsageSnapshotRow {
  id: string;
  providerKey: string;
  providerAccountRef: string | null;
  collectedAt: string;
  service: string;
  metric: string;
  unit: string;
  value: number;
  metadataJson: string;
}

interface BillingSnapshotRow {
  id: string;
  providerKey: string;
  providerAccountRef: string | null;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: string;
  metadataJson: string;
}

interface ServiceHealthSnapshotRow {
  id: string;
  providerKey: string;
  collectedAt: string;
  service: string;
  region: string | null;
  status: "ok" | "degraded" | "down" | "unknown";
  message: string | null;
  metadataJson: string;
}

interface CostEstimateRow {
  id: string;
  providerKey: string;
  providerAccountRef: string | null;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "low" | "medium" | "high";
  metadataJson: string;
}

interface AlertRow {
  id: string;
  providerKey: string | null;
  createdAt: string;
  severity: "info" | "warning" | "critical";
  category: string;
  title: string;
  message: string;
  metadataJson: string;
}

interface ReportRunRow {
  id: string;
  createdAt: string;
  reportDate: string;
  language: "ko" | "en";
  deliveryTarget: "stdout" | "local-file" | "slack";
  status: "rendered" | "sent" | "error";
  metadataJson: string;
}

interface ProviderSyncRunRow {
  id: string;
  providerKey: string;
  attemptedAt: string;
  completedAt: string | null;
  status: LocalProviderSyncStatus;
  usageCount: number;
  billingCount: number;
  healthCount: number;
  estimateCount: number;
  alertCount: number;
  errorCode: LocalProviderSyncErrorCode | null;
  sanitizedMessage: string | null;
  dataThrough: string | null;
  metadataJson: string;
}

interface EmergencyActionRunRow {
  id: string;
  providerKey: string;
  actionKey: string;
  mode: "requirements_only" | "manual" | "dry_run";
  readiness: string;
  requestedAt: string;
  confirmedAt: string | null;
  executedAt: string | null;
  status: "viewed" | "dry_run" | "blocked" | "error";
  reasonCode: string;
  targetLabelRedacted: string | null;
  targetHash: string | null;
  resultSummary: string;
  errorCode: string | null;
  localOnly: 0 | 1;
  secretsReturned: 0 | 1;
  metadataJson: string;
}

interface NodeSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    all(): unknown[];
  };
  close(): void;
}
