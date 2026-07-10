export const REQUIRED_TABLES = [
  "providers",
  "provider_accounts",
  "usage_snapshots",
  "billing_snapshots",
  "service_health_snapshots",
  "cost_estimates",
  "alerts",
  "report_runs",
  "emergency_action_runs",
  "provider_sync_runs",
] as const;

export type RequiredTable = (typeof REQUIRED_TABLES)[number];

export const INITIAL_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  connector_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_accounts (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  account_label TEXT NOT NULL,
  account_ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, account_ref)
);

CREATE TABLE IF NOT EXISTS usage_snapshots (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  provider_account_id TEXT REFERENCES provider_accounts(id) ON DELETE SET NULL,
  collected_at TEXT NOT NULL,
  service TEXT NOT NULL,
  metric TEXT NOT NULL,
  unit TEXT NOT NULL,
  value REAL NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS billing_snapshots (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  provider_account_id TEXT REFERENCES provider_accounts(id) ON DELETE SET NULL,
  collected_at TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS service_health_snapshots (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  collected_at TEXT NOT NULL,
  service TEXT NOT NULL,
  region TEXT,
  status TEXT NOT NULL,
  message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS cost_estimates (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  provider_account_id TEXT REFERENCES provider_accounts(id) ON DELETE SET NULL,
  collected_at TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  estimated_amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  confidence TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS report_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  report_date TEXT NOT NULL,
  language TEXT NOT NULL,
  delivery_target TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_collected_at ON usage_snapshots(collected_at);
CREATE INDEX IF NOT EXISTS idx_billing_snapshots_period ON billing_snapshots(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_service_health_snapshots_collected_at ON service_health_snapshots(collected_at);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_period ON cost_estimates(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
`.trim();

export const READ_MODEL_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_billing_snapshots_latest_logical
  ON billing_snapshots(provider_id, provider_account_id, period_start, period_end, currency, collected_at, id);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_latest_logical
  ON cost_estimates(provider_id, provider_account_id, period_start, period_end, currency, collected_at, id);
`.trim();

export const PROVIDER_SYNC_RUNS_SQL = `
CREATE TABLE IF NOT EXISTS provider_sync_runs (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'partial', 'error')),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  billing_count INTEGER NOT NULL DEFAULT 0 CHECK (billing_count >= 0),
  health_count INTEGER NOT NULL DEFAULT 0 CHECK (health_count >= 0),
  estimate_count INTEGER NOT NULL DEFAULT 0 CHECK (estimate_count >= 0),
  error_code TEXT,
  error_message TEXT,
  data_through TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_provider_sync_runs_provider_attempted
  ON provider_sync_runs(provider_key, attempted_at, id);
`.trim();

export const EMERGENCY_ACTION_RUNS_SQL = `
CREATE TABLE IF NOT EXISTS emergency_action_runs (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  action_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('requirements_only', 'manual', 'dry_run')),
  readiness TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  confirmed_at TEXT,
  executed_at TEXT CHECK (executed_at IS NULL),
  status TEXT NOT NULL CHECK (status IN ('viewed', 'dry_run', 'blocked', 'error')),
  reason_code TEXT NOT NULL,
  target_label_redacted TEXT,
  target_hash TEXT,
  result_summary TEXT NOT NULL,
  error_code TEXT,
  local_only INTEGER NOT NULL DEFAULT 1 CHECK (local_only = 1),
  secrets_returned INTEGER NOT NULL DEFAULT 0 CHECK (secrets_returned = 0),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_emergency_action_runs_requested_at
  ON emergency_action_runs(requested_at, provider_key, action_key);
`.trim();
