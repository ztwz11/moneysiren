# EPIC-07: Three Runtime Modes

## 목표

StackSpend를 web, CLI, desktop tray 세 가지 방식으로 사용할 수 있게 한다.

## 결과물

- `packages/view-model`
- `packages/local-api`
- `packages/runtime`
- CLI serve/open/summary/notify 명령
- web notification settings
- desktop tray app skeleton

## 작업 분해

### TASK-07-01: shared view model 생성

담당: Core/ViewModel agent

작업:

- 기존 `apps/web/lib/operations-data.ts`, `apps/web/lib/live-today.ts`에서 재사용 가능한 부분을 `packages/view-model`로 이동한다.
- web-specific React 의존성을 제거한다.
- CLI와 local API에서 호출 가능한 순수 TypeScript API를 만든다.

Acceptance criteria:

- `readOperationsOverview()`
- `readTodayLiveView()`
- `readNotificationDigest()`
- `readTrayMenuModel()`
- 반환 payload에는 `secretsReturned: false` 포함
- secret pattern test 통과

### TASK-07-02: local API server 생성

담당: Runtime/API agent

작업:

- `packages/local-api` 생성
- 127.0.0.1 전용 server 구현
- runtime lock file 작성
- health/runtime/summary/digest/tray-menu endpoint 구현
- write endpoint는 local session token 요구

Acceptance criteria:

- `stackspend serve`로 실행 가능
- `GET /api/local/health` 응답
- 외부 host bind 금지
- CORS는 loopback만 허용
- secret pattern test 통과

### TASK-07-03: CLI commands 추가

담당: CLI agent

명령:

```bash
stackspend serve
stackspend open
stackspend summary
stackspend notify once
stackspend notify prefs list
stackspend notify prefs enable <widget>
stackspend notify prefs disable <widget>
stackspend notify prefs hud-enable <widget>
stackspend notify prefs hud-disable <widget>
stackspend notify prefs threshold <widget> --gte <value>
stackspend desktop status
```

Acceptance criteria:

- local API가 실행 중이면 재사용
- 없으면 `stackspend open`이 server 시작 후 브라우저 열기
- `stackspend notify once --dry-run`은 stdout에 sanitized digest 출력
- `stackspend summary --json`은 secret 없는 JSON 출력

### TASK-07-04: web notification settings

담당: Web agent

화면:

```text
Settings > Notifications
```

기능:

- 알림 on/off
- digest interval
- quiet hours
- 표시 widget 선택
- threshold 설정
- test notification 요청
- desktop app 설치 안내

Acceptance criteria:

- provider 연결 설정과 notification 설정이 분리됨
- secret 입력 없음
- 설정 저장 후 tray digest에 반영됨
- i18n ko/en/ja 적용

### TASK-07-05: desktop tray skeleton

담당: Desktop agent

기능:

- tray icon
- Open Dashboard
- Refresh Now
- Pause Notifications
- Start at Login
- Quit
- local API health check
- notification permission check

Acceptance criteria:

- Windows/macOS에서 tray/menu 동작
- local API만 호출
- provider connector 직접 import 없음
- notification payload secret test 통과
