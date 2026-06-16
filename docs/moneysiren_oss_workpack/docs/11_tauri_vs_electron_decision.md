# Desktop Shell 선택: Tauri vs Electron

## 결론

MoneySiren의 장기 방향은 **Tauri thin tray shell**이 더 적합하다. 이유는 local-first, 보안, 작은 앱 크기, system tray 중심 도구라는 제품 성격과 잘 맞기 때문이다.

다만 현재 코드가 TypeScript/Next.js 중심이고, 빠른 dogfood가 필요하면 Electron prototype도 현실적인 선택이다.

추천 전략:

```text
1단계: local API와 notification digest를 먼저 만든다.
2단계: apps/tray는 Tauri로 시작한다.
3단계: Tauri sidecar/packaging이 막히면 Electron thin tray를 임시 fallback으로 둔다.
```

중요한 것은 desktop shell 기술이 아니라, desktop shell이 local API만 바라보도록 만드는 것이다. 그러면 Tauri와 Electron을 바꿔도 core는 유지된다.

## Tauri 방식

패키지:

```text
apps/tray
  src-tauri/
  src/
```

Tauri가 담당할 일:

- tray icon 생성
- tray menu 생성
- native notification 표시
- open dashboard URL
- autostart 설정
- single instance
- local API sidecar 실행 또는 기존 server 탐색

Tauri가 하지 말아야 할 일:

- provider credential 읽기
- provider API 호출
- raw DB query
- raw provider payload 표시
- 설정 연결 화면 구현

## Electron 방식

패키지:

```text
apps/tray-electron
  main/
  preload/
  renderer/
```

Electron이 담당할 일:

- tray icon 생성
- native notification 표시
- local API server process 관리
- 브라우저 열기

장점:

- Node/TypeScript package 재사용이 쉽다.
- Next.js server 실행 제어가 쉽다.
- 개발 속도가 빠르다.

단점:

- 앱 크기가 크다.
- 보안 설정을 더 많이 신경 써야 한다.
- desktop app이 지나치게 커 보일 수 있다.

## 공통 acceptance criteria

- tray는 `Open Dashboard` 메뉴를 제공한다.
- dashboard URL은 local runtime lock에서 읽는다.
- local server가 꺼져 있으면 시작하거나 사용자에게 안내한다.
- notification은 user-selected widgets만 표시한다.
- 연결 설정은 web/CLI에서만 가능하다.
- tray notification payload에 secret pattern이 없어야 한다.
- 앱 종료 시 local server를 같이 종료할지 유지할지 설정 가능해야 한다.

## 추천 v0.1 구현 범위

v0.1에서 할 것:

```text
- Tauri tray app 생성
- Open Dashboard
- Refresh Now
- Pause Notifications
- Start at Login
- Digest toast
- Threshold toast
- local API polling
```

v0.1에서 하지 않을 것:

```text
- desktop full dashboard
- provider 연결 설정
- credential 입력
- notification action button 의존
- provider write action
- cross-device sync
```
