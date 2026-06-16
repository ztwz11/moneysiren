# MoneySiren 3가지 사용 방식 아키텍처

## 목적

MoneySiren를 하나의 local-first core 위에서 세 가지 방식으로 사용할 수 있게 한다.

- 웹: 전체 대시보드와 연결 설정
- CLI: 빠른 확인, 자동화, 리포트, local server 제어
- 데스크톱 tray/notifier: 내가 보고 싶은 항목만 작업표시줄/메뉴바와 toast로 확인

이 구조의 핵심은 **세 제품을 따로 만드는 것이 아니라, 하나의 정규화된 로컬 view model을 세 surface가 공유하는 것**이다.

```text
Provider connectors
  ↓
packages/core
  ↓
packages/db SQLite
  ↓
packages/view-model
  ↓
┌───────────────────────┬───────────────────────┬───────────────────────┐
│ apps/web              │ apps/cli              │ apps/tray             │
│ full dashboard/setup  │ terminal automation   │ tray/toast summary    │
└───────────────────────┴───────────────────────┴───────────────────────┘
```

## 제품 구분

### 1. Local web dashboard

역할:

- 연결 설정
- credential backend 선택
- provider setup guide
- dashboard 전체 조회
- service detail
- Today Live
- risk
- forecast
- notification preference 설정

웹은 가장 풍부한 화면이다. 사용자가 새 provider를 연결하거나 Codex/Claude quota limit을 설정하는 작업은 웹 또는 CLI에서만 한다.

### 2. CLI

역할:

- `moneysiren init`
- `moneysiren doctor`
- `moneysiren sync`
- `moneysiren summary`
- `moneysiren report daily`
- `moneysiren serve`
- `moneysiren open`
- `moneysiren notify once`
- `moneysiren desktop status`

CLI는 자동화와 문제 해결의 중심이다. CI, cron, Windows Task Scheduler, launchd와 잘 맞아야 한다.

### 3. Desktop tray/notifier

역할:

- 로컬 서버 상태 확인
- 웹 대시보드 열기
- 선택한 요약 항목만 표시
- 주기적 toast 알림
- threshold 기반 알림
- refresh now
- pause notifications
- start at login
- quit

tray는 provider API를 직접 호출하지 않는다. tray는 local server나 sanitized local API에서 view model만 읽는다.

## 중요한 설계 결정

### desktop app은 thin tray controller로 시작한다

처음부터 desktop full dashboard를 만들지 않는다. 이미 Next.js 기반 웹 대시보드가 있으므로, desktop app은 다음만 담당한다.

```text
1. 로컬 서버가 떠 있는지 확인
2. 필요하면 로컬 서버 실행
3. 작업표시줄/메뉴바 아이콘 표시
4. "Open Dashboard" 클릭 시 브라우저 열기
5. notification digest view model을 읽어 toast 표시
```

이렇게 하면 다음 장점이 있다.

- 웹 UI와 desktop UI가 중복되지 않는다.
- credential 입력 화면을 두 번 만들 필요가 없다.
- desktop app에 secret handling을 넣지 않아도 된다.
- Windows/macOS 차이를 tray shell 안에만 가둘 수 있다.

## Runtime 구성

추천 패키지:

```text
packages/view-model
  summary, risk, notification digest, tray menu model

packages/local-api
  127.0.0.1 HTTP API
  read-only summary endpoints
  CSRF/session-protected write endpoints

packages/runtime
  local server port discovery
  lock file
  process management
  open browser
  single instance behavior

packages/notifier
  notification rule engine
  quiet hours
  thresholds
  digest formatting
  sensitive value validation

apps/tray
  Tauri 또는 Electron 기반 thin shell
```

## 로컬 API 설계

로컬 서버는 `127.0.0.1`에만 bind한다.

추천 endpoint:

```text
GET  /api/local/health
GET  /api/local/runtime
GET  /api/local/summary
GET  /api/local/notification-digest
GET  /api/local/notification-preferences

POST /api/local/refresh-live
POST /api/local/notification-preferences
POST /api/local/pause-notifications
POST /api/local/open-dashboard
```

read endpoint도 secret을 반환하지 않는다. write endpoint는 local session token 또는 CSRF protection을 요구한다.

## Lock file

desktop tray와 CLI가 같은 local server를 찾을 수 있게 lock file을 사용한다.

예시:

```json
{
  "pid": 12345,
  "port": 47831,
  "baseUrl": "http://127.0.0.1:47831",
  "startedAt": "2026-06-09T00:00:00.000Z",
  "tokenRef": "moneysiren/local-session",
  "version": "0.1.0-alpha.0"
}
```

저장 위치:

```text
Windows: %APPDATA%/MoneySiren/runtime.json
macOS: ~/Library/Application Support/MoneySiren/runtime.json
Linux: ~/.config/moneysiren/runtime.json
```

주의:

- lock file에 provider secret을 넣지 않는다.
- session token은 가능하면 OS keychain 또는 0600 permission 파일에 둔다.
- port는 고정값보다 사용 가능한 loopback port를 잡고 lock file로 공유하는 편이 충돌이 적다.

## 보안 원칙

tray 알림은 화면에 오래 남을 수 있다. 따라서 알림 payload는 웹 dashboard보다 더 보수적으로 만든다.

금지:

- API key
- token
- webhook URL
- raw account id
- project id
- invoice id
- email
- full path에 사용자 이름이 드러나는 파일 경로
- raw provider response
- prompt text
- CLI transcript raw line

허용:

- provider display name
- user-defined alias
- masked id
- cost amount
- usage percent
- risk severity
- freshness
- reset time
- sanitized recommendation

## 권장 구현 결정

데스크톱 shell 후보:

### Tauri

장점:

- 앱 크기가 작다.
- system tray, notification, opener, autostart plugin을 공식적으로 제공한다.
- local-first 보안 메시지와 잘 맞는다.

주의:

- Rust/Tauri toolchain이 필요하다.
- 현재 Next.js server-side 구조와 직접 통합하려면 sidecar 또는 local API 분리가 필요하다.

### Electron

장점:

- TypeScript/Node 생태계와 직접 맞는다.
- 현재 monorepo와 core package 재사용이 쉽다.
- Next.js server를 띄우거나 Node main process에서 runtime 제어하기 쉽다.

주의:

- 앱 크기가 크다.
- 보안 설정을 직접 신경 써야 한다.
- macOS notification은 code signing 영향을 받는다.

추천:

```text
v0.1 내부 dogfood: Electron도 빠르다.
오픈소스 정식 desktop target: Tauri thin tray shell을 추천한다.
```

단, Tauri로 가더라도 `apps/tray`가 provider connector를 직접 import하지 않게 한다. local API만 호출하게 만들면 desktop shell 교체가 쉬워진다.
