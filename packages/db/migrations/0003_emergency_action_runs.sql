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
