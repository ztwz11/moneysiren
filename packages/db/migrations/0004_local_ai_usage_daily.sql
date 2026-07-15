CREATE TABLE IF NOT EXISTS local_ai_usage_daily (
  provider_key TEXT NOT NULL CHECK (provider_key IN ('codex-cli', 'codex-app', 'claude-cli', 'claude-app')),
  usage_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  source_scope TEXT NOT NULL CHECK (source_scope IN ('dedicated', 'shared_fallback')),
  observed_at TEXT NOT NULL,
  first_activity_at TEXT,
  latest_activity_at TEXT,
  activity_count INTEGER NOT NULL CHECK (activity_count >= 0),
  session_count INTEGER NOT NULL CHECK (session_count >= 0),
  turn_count INTEGER NOT NULL CHECK (turn_count >= 0),
  tool_call_count INTEGER NOT NULL CHECK (tool_call_count >= 0),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  cache_tokens INTEGER CHECK (cache_tokens IS NULL OR cache_tokens >= 0),
  reasoning_tokens INTEGER CHECK (reasoning_tokens IS NULL OR reasoning_tokens >= 0),
  total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
  coverage TEXT NOT NULL CHECK (coverage IN ('complete', 'partial')),
  parser_version TEXT NOT NULL,
  local_only INTEGER NOT NULL DEFAULT 1 CHECK (local_only = 1),
  secrets_returned INTEGER NOT NULL DEFAULT 0 CHECK (secrets_returned = 0),
  PRIMARY KEY (provider_key, usage_date, timezone, source_scope)
);

CREATE INDEX IF NOT EXISTS idx_local_ai_usage_daily_period
  ON local_ai_usage_daily(usage_date, provider_key, timezone);
