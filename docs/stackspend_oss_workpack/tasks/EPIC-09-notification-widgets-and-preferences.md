# EPIC-09: Notification Widgets and Preferences

## 목표

사용자가 보고 싶은 항목만 선택해서 toast/tray에 표시하게 한다.

## 기본 widget

```ts
export const notificationWidgets = [
  "month_forecast",
  "today_live_cost",
  "risk_high_count",
  "stale_connection_count",
  "aws_month_forecast",
  "openai_today_cost",
  "openai_today_tokens",
  "claude_five_hour_percent",
  "claude_weekly_percent",
  "codex_five_hour_percent",
  "codex_weekly_percent",
  "supabase_usage_health",
  "cloudflare_month_to_date",
] as const;
```

## widget builder

```ts
export interface NotificationWidgetBuilder {
  key: NotificationWidgetKey;
  build(context: NotificationContext): NotificationDigestItem | null;
}
```

## threshold rule

```ts
export interface NotificationThresholdRule {
  widgetKey: NotificationWidgetKey;
  operator: "gte" | "lte" | "eq";
  value: number;
  cooldownMinutes: number;
}
```

예시:

```text
claude_five_hour_percent >= 80
codex_weekly_percent >= 90
risk_high_count >= 1
today_live_cost >= 10
```

## UI 요구사항

Settings > Notifications:

- 알림 전체 on/off
- digest on/off
- digest interval
- quiet hours
- widget 체크박스
- widget order
- threshold 입력
- test notification
- desktop app 상태 표시

## CLI 요구사항

```bash
stackspend notify prefs list
stackspend notify prefs enable claude_five_hour_percent
stackspend notify prefs disable openai_today_tokens
stackspend notify prefs hud-enable codex_weekly_percent
stackspend notify prefs hud-disable month_forecast
stackspend notify prefs threshold claude_five_hour_percent --gte 80 --cooldown 60
stackspend notify prefs quiet-hours 22:00 08:00
stackspend notify test
```

## Acceptance criteria

- 사용자가 선택하지 않은 widget은 digest에 나오지 않는다.
- threshold 없는 widget은 digest에만 나온다.
- threshold 있는 widget은 조건 만족 시 event 알림을 만든다.
- 알림 body는 2줄 내외로 짧게 만든다.
- 모든 값에는 freshness/confidence가 있어야 한다.
- secret scanner test 통과.
