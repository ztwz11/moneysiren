# Desktop Tray / Toast Notification 설계

## 목표

사용자가 StackSpend 웹페이지를 계속 열어두지 않아도, Windows 작업표시줄 또는 macOS 메뉴바에서 중요한 사용량을 빠르게 확인하게 한다.

## Tray 메뉴

기본 메뉴:

```text
StackSpend
────────────────────────
Status: Live / Stale / Not configured

Open Dashboard
Open Today Live
Open Connections
Refresh Now

Shown Items
  ✓ OpenAI today cost
  ✓ Claude 5h limit
  ✓ Claude weekly limit
  ✓ Codex 5h limit
  ✓ AWS month forecast
  ✓ High risks

Pause Notifications
  30 minutes
  1 hour
  Until tomorrow

Start at Login: On/Off
Run Doctor
Quit StackSpend
```

## Toast 알림 유형

### 1. Digest 알림

정해진 주기마다 현재 선택된 항목을 요약한다.

예시:

```text
StackSpend
OpenAI today $3.20 · Claude 5h 72% · Codex week 41%
AWS forecast $92 · High risks 1
```

### 2. Threshold 알림

사용자가 설정한 임계치를 넘었을 때만 표시한다.

예시:

```text
Claude Code 5시간 한도 82%
설정한 80% 임계치를 넘었습니다.
```

### 3. Risk 알림

high 이상 risk가 새로 감지되면 표시한다.

예시:

```text
StackSpend risk
OpenAI usage spike: 최근 7일 평균 대비 240%
```

### 4. Connection 알림

연결 실패 또는 stale 상태가 길어지면 표시한다.

예시:

```text
StackSpend connection stale
Supabase가 48시간 동안 sync되지 않았습니다.
```

## Toast 클릭 동작

권장 기본 동작:

```text
알림 클릭 → 해당 상세 웹페이지 열기
```

알림 안의 action button은 플랫폼별 차이가 크기 때문에 v0.1에서는 필수로 두지 않는다. 대신 클릭하면 웹 상세 화면으로 이동하게 한다.

예시 mapping:

```text
claude_5h_percent → /ko/services/claude-cli
codex_weekly_percent → /ko/services/codex-cli
aws_month_forecast → /ko/services/aws
risk_high_count → /ko/dashboard/risks
connection_stale_count → /ko/settings/connections
```

## 표시 항목 widget catalog

초기 widget 후보:

```ts
export type NotificationWidgetKey =
  | "month_forecast"
  | "today_live_cost"
  | "risk_high_count"
  | "stale_connection_count"
  | "aws_month_forecast"
  | "openai_today_cost"
  | "openai_today_tokens"
  | "claude_five_hour_percent"
  | "claude_weekly_percent"
  | "codex_five_hour_percent"
  | "codex_weekly_percent"
  | "supabase_usage_health"
  | "cloudflare_month_to_date";
```

각 widget은 다음 metadata를 가진다.

```ts
export interface NotificationWidgetDefinition {
  key: NotificationWidgetKey;
  label: string;
  category: "cost" | "usage" | "quota" | "risk" | "connection" | "health";
  defaultEnabled: boolean;
  supportsThreshold: boolean;
  providerKey?: string;
}
```

## 사용자 설정

웹과 CLI에서만 설정한다.

추천 DB table:

```sql
create table if not exists notification_preferences (
  id text primary key,
  enabled integer not null default 1,
  digest_enabled integer not null default 1,
  digest_interval_minutes integer not null default 60,
  quiet_hours_enabled integer not null default 0,
  quiet_hours_start text,
  quiet_hours_end text,
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
  display_order integer not null,
  updated_at text not null
);
```

CLI 예시:

```bash
stackspend notify prefs list
stackspend notify prefs enable claude_five_hour_percent
stackspend notify prefs disable today_live_cost
stackspend notify prefs hud-enable codex_weekly_percent
stackspend notify prefs hud-disable month_forecast
stackspend notify prefs threshold claude_five_hour_percent --gte 80
stackspend notify prefs interval 60
stackspend notify prefs quiet-hours 22:00 08:00
```

## Notification digest view model

tray는 이 view model만 사용한다.

```ts
export interface NotificationDigest {
  generatedAt: string;
  locale: "ko" | "en" | "ja";
  title: string;
  body: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  clickUrl: string;
  items: NotificationDigestItem[];
  suppressedReason?: "disabled" | "quiet_hours" | "paused" | "no_change";
  secretsReturned: false;
}

export interface NotificationDigestItem {
  key: NotificationWidgetKey;
  label: string;
  value: string;
  rawValue?: number;
  unit?: "usd" | "percent" | "tokens" | "count";
  providerKey?: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  freshness: "live" | "fresh" | "stale" | "unknown";
  confidence: "high" | "medium" | "low" | "none";
  clickPath: string;
}
```

## 중복 알림 방지

알림 spam을 막기 위해 fingerprint를 저장한다.

```sql
create table if not exists notification_delivery_log (
  id text primary key,
  fingerprint text not null,
  severity text not null,
  delivered_at text not null,
  title text not null,
  body_preview text not null
);
```

fingerprint 예시:

```text
claude_five_hour_percent:gTE80:2026-06-09T10
risk:openai_usage_spike:2026-06-09
connection:supabase_stale:2026-06-09
```

동일 fingerprint는 일정 시간 안에 다시 보내지 않는다.

## macOS/Windows UX 주의사항

- Windows는 알림 센터에 알림이 남을 수 있다.
- macOS는 사용자가 알림 권한을 거절할 수 있다.
- macOS 메뉴바 아이콘은 단색 template icon이 자연스럽다.
- Windows tray icon은 `.ico`를 준비하는 것이 좋다.
- 알림 클릭 이벤트는 앱이 꺼졌다 켜지는 상황도 고려해야 한다.
- 액션 버튼은 v0.1 필수 요구사항에서 제외한다.
