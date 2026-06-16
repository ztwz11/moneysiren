# EPIC-08: Desktop Tray Notifier

## 목표

Windows 작업표시줄과 macOS 메뉴바에서 MoneySiren 요약을 확인하고, toast 알림을 받을 수 있게 한다.

## 기술 선택

기본 목표는 Tauri thin tray shell이다. Electron은 fallback으로만 고려한다.

## 작업

### TASK-08-01: Tauri app 생성

```text
apps/tray
  src-tauri/
  src/
```

초기 기능:

- app icon
- tray icon
- tooltip
- menu
- local API client

### TASK-08-02: tray menu model 연동

local API endpoint:

```text
GET /api/local/tray-menu
```

menu action:

```text
open-dashboard
open-today-live
open-connections
refresh-now
pause-30m
pause-1h
pause-until-tomorrow
start-at-login-toggle
run-doctor
quit
```

### TASK-08-03: notification digest polling

로직:

```text
앱 시작
→ local API health check
→ notification permission check
→ interval마다 GET /api/local/notification-digest
→ suppressedReason이 없으면 toast
→ delivery result 기록
```

Acceptance criteria:

- quiet hours에는 알림 표시 안 함
- pause 중에는 알림 표시 안 함
- 동일 fingerprint 재전송 방지
- click 시 dashboard 또는 관련 service page 열기

### TASK-08-04: platform handling

Windows:

- `.ico` icon 준비
- notification center 잔존 고려
- installed app 환경에서 알림 테스트

macOS:

- template icon 준비
- notification permission 안내
- code signing이 없을 때의 개발 모드 동작 문서화

### TASK-08-05: packaging

- Windows installer
- macOS app bundle/dmg
- unsigned development artifact
- signing은 release 문서에 분리

## 금지

- tray에서 provider credential 입력
- tray에서 provider API 직접 호출
- tray에서 raw SQLite query
- tray 알림에 prompt text 표시
- tray 알림에 account/project/email 표시
