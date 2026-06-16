# Local API와 Shared View Model 지침

## 왜 view model을 분리해야 하는가

현재 MoneySiren는 web dashboard, CLI, desktop tray가 모두 같은 데이터를 사용해야 한다. 하지만 각 surface가 직접 DB schema나 provider connector에 접근하면 다음 문제가 생긴다.

- 중복 로직 증가
- 알림과 CLI에서 secret 유출 가능성 증가
- UI마다 freshness/confidence 해석이 달라짐
- desktop app 교체가 어려움

따라서 `packages/view-model`을 새로 두고, 모든 surface가 이 view model만 읽게 한다.

## packages/view-model

추천 exports:

```ts
export async function readOperationsOverview(options: ReadViewOptions): Promise<OperationsOverviewView>;
export async function readTodayLiveView(options: ReadViewOptions): Promise<TodayLiveView>;
export async function readServiceDetailView(providerKey: string, options: ReadViewOptions): Promise<ServiceDetailView>;
export async function readNotificationDigest(options: ReadNotificationDigestOptions): Promise<NotificationDigest>;
export async function readTrayMenuModel(options: ReadTrayMenuOptions): Promise<TrayMenuModel>;
```

## packages/local-api

로컬 HTTP API는 web, CLI, tray가 공유할 수 있다.

```ts
export interface LocalApiServerOptions {
  host: "127.0.0.1";
  port?: number;
  dbPath?: string;
  sessionTokenBackend: "keychain" | "file";
  openBrowser?: boolean;
}

export async function startLocalApiServer(options: LocalApiServerOptions): Promise<LocalApiServerHandle>;
export async function findRunningLocalApiServer(): Promise<LocalApiRuntime | null>;
```

## API Response 원칙

모든 response에 포함:

```ts
{
  "localOnly": true,
  "secretsReturned": false,
  "generatedAt": "2026-06-09T00:00:00.000Z"
}
```

금지 필드:

```text
secret
token
apiKey
webhookUrl
raw
payload
authorization
cookie
refreshToken
clientSecret
email
invoiceId
card
```

## Runtime endpoint

```text
GET /api/local/runtime
```

응답:

```json
{
  "localOnly": true,
  "secretsReturned": false,
  "generatedAt": "2026-06-09T00:00:00.000Z",
  "version": "0.1.0-alpha.0",
  "server": {
    "host": "127.0.0.1",
    "port": 47831,
    "baseUrl": "http://127.0.0.1:47831",
    "startedAt": "2026-06-09T00:00:00.000Z"
  },
  "database": {
    "state": "ready",
    "pathHint": "MoneySiren/moneysiren.sqlite"
  }
}
```

## Notification digest endpoint

```text
GET /api/local/notification-digest
```

응답:

```json
{
  "localOnly": true,
  "secretsReturned": false,
  "generatedAt": "2026-06-09T00:00:00.000Z",
  "title": "MoneySiren",
  "body": "Claude 5h 72% · Codex week 41% · High risks 1",
  "severity": "high",
  "clickUrl": "http://127.0.0.1:47831/ko/dashboard/risks",
  "items": [
    {
      "key": "claude_five_hour_percent",
      "label": "Claude 5h",
      "value": "72%",
      "rawValue": 72,
      "unit": "percent",
      "providerKey": "claude-cli",
      "severity": "medium",
      "freshness": "live",
      "confidence": "medium",
      "clickPath": "/ko/services/claude-cli"
    }
  ]
}
```

## Tray menu endpoint

```text
GET /api/local/tray-menu
```

응답:

```json
{
  "localOnly": true,
  "secretsReturned": false,
  "generatedAt": "2026-06-09T00:00:00.000Z",
  "tooltip": "MoneySiren · Claude 5h 72% · risks 1",
  "status": "warning",
  "items": [
    {
      "id": "open-dashboard",
      "label": "Open Dashboard",
      "kind": "action",
      "action": "open_url",
      "urlPath": "/ko/dashboard/overview"
    },
    {
      "id": "refresh-now",
      "label": "Refresh Now",
      "kind": "action",
      "action": "refresh_live"
    },
    {
      "id": "pause-1h",
      "label": "Pause Notifications 1h",
      "kind": "action",
      "action": "pause_notifications",
      "durationMinutes": 60
    }
  ]
}
```

## CLI와 local API 관계

CLI는 local API가 없어도 core를 직접 실행할 수 있어야 한다.

```text
moneysiren summary
  → packages/view-model 직접 호출

moneysiren serve
  → packages/local-api 서버 시작

moneysiren open
  → running server 탐색
  → 없으면 serve 시작
  → browser open

moneysiren notify once
  → packages/view-model readNotificationDigest
  → OS notification backend 또는 stdout
```

## Desktop tray와 local API 관계

desktop tray는 local API만 호출한다.

```text
apps/tray
  → find runtime lock
  → GET /api/local/health
  → GET /api/local/notification-digest
  → GET /api/local/tray-menu
  → POST /api/local/refresh-live
```

provider connector 직접 호출 금지:

```text
apps/tray → packages/connectors/aws ❌
apps/tray → packages/credentials ❌
apps/tray → raw SQLite query ❌
apps/tray → local API ✅
```
