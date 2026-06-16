# EPIC-05. Provider Catalog & Connection Semantics

## 목적

provider catalog와 connection status 용어를 정리해서 공개 저장소 사용자에게 혼란을 줄인다.

## 권장 브랜치

```text
feature/provider-catalog-semantics
```

## 담당 파일

```text
apps/web/lib/provider-catalog.ts
apps/web/lib/connection-status.ts
packages/config/**
```

## 현재 문제

- `LIVE_PROVIDER_KEYS`가 AWS/OpenAI/Supabase/Cloudflare만 포함하지만 Codex/Claude도 live usage collector가 있다.
- Codex/Claude CLI가 `env_configured`처럼 표시될 수 있다.
- local CLI/log source와 env credential source가 구분되지 않는다.

## 수정 제안

### provider key 분리

```ts
export const REMOTE_LIVE_PROVIDER_KEYS = ["aws", "openai", "supabase", "cloudflare"] as const;
export const LOCAL_USAGE_PROVIDER_KEYS = ["codex-cli", "claude-cli"] as const;
export const LIVE_PROVIDER_KEYS = [
  ...REMOTE_LIVE_PROVIDER_KEYS,
  ...LOCAL_USAGE_PROVIDER_KEYS,
] as const;
```

또는 기존 `LIVE_PROVIDER_KEYS` 의미가 remote-only라면 이름을 `REMOTE_LIVE_PROVIDER_KEYS`로 바꾼다.

### CredentialSource 확장

```ts
export type CredentialSource =
  | "env"
  | "credential_store"
  | "oauth"
  | "local_cli"
  | "local_logs"
  | "locked"
  | "none";
```

### Local CLI state

Codex/Claude는 다음처럼 표시한다.

```text
connectionState: local_usage_ready
credentialSource: local_cli 또는 local_logs
readOnlyTestState: read_only_ready
```

기존 union을 크게 바꾸기 어렵다면 최소한 UI label만이라도 바꾼다.

```text
env_configured -> local CLI/log detected
```

## Acceptance Criteria

- [ ] Codex/Claude가 env credential provider처럼 보이지 않는다.
- [ ] local CLI 설치와 local log 존재가 별도 source로 표시된다.
- [ ] remote live provider와 local usage provider가 구분된다.
- [ ] README/provider table에 같은 용어가 반영된다.
- [ ] 기존 AWS/OpenAI/Supabase/Cloudflare 연결 상태가 깨지지 않는다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```
