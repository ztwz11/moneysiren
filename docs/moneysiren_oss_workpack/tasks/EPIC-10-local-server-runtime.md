# EPIC-10: Local Server Runtime

## 목표

웹/CLI/tray가 같은 local MoneySiren runtime을 찾고 재사용하게 한다.

## 기능

### runtime discovery

```ts
export async function findRuntime(): Promise<LocalRuntime | null>;
export async function assertRuntimeHealthy(runtime: LocalRuntime): Promise<boolean>;
```

### runtime start

```ts
export async function startRuntime(options: {
  openBrowser?: boolean;
  port?: number;
  headless?: boolean;
}): Promise<LocalRuntime>;
```

### runtime lock

```json
{
  "pid": 12345,
  "port": 47831,
  "baseUrl": "http://127.0.0.1:47831",
  "startedAt": "2026-06-09T00:00:00.000Z",
  "version": "0.1.0-alpha.0"
}
```

### single instance

- 이미 실행 중이면 새 서버를 띄우지 않는다.
- stale lock이면 제거 후 새로 시작한다.
- port 충돌 시 다른 port로 시작하고 lock 갱신한다.

## CLI 동작

```text
moneysiren serve
  - local API server 시작
  - Next.js web dashboard와 통합 또는 프록시

moneysiren open
  - runtime 탐색
  - 없으면 serve 시작
  - browser open

moneysiren desktop status
  - runtime 상태 출력
```

## Tray 동작

```text
tray start
  - runtime 탐색
  - 없으면 startRuntime(headless=true)
  - tray menu와 notification 활성화
```

## 보안

- host는 반드시 127.0.0.1
- 0.0.0.0 금지
- write endpoint는 local session 필요
- session token은 provider secret이 아님
- lock file에 provider secret 금지
- response에 secretsReturned=false 포함
