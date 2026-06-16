create table if not exists notification_preferences (
  id text primary key,
  enabled integer not null default 1,
  digest_enabled integer not null default 1,
  digest_interval_minutes integer not null default 60,
  quiet_hours_enabled integer not null default 0,
  quiet_hours_start text,
  quiet_hours_end text,
  paused_until text,
  max_items integer not null default 5,
  min_severity text not null default 'medium',
  open_dashboard_on_click integer not null default 1,
  updated_at text not null
);

create table if not exists notification_widget_preferences (
  widget_key text primary key,
  enabled integer not null,
  threshold_value real,
  threshold_operator text,
  threshold_cooldown_minutes integer,
  display_order integer not null,
  updated_at text not null
);

create table if not exists notification_delivery_log (
  id text primary key,
  fingerprint text not null,
  severity text not null,
  delivered_at text not null,
  title text not null,
  body_preview text not null
);
