# 04. 병렬 작업 지침

## 목표

여러 명 또는 여러 AI 에이전트가 같은 저장소에서 동시에 작업하더라도 충돌을 최소화한다.  
각 작업은 작은 slice로 나누고, 파일 소유권을 명확히 한다.

## 공통 브랜치 규칙

```text
main
  ├─ oss/docs-public-readiness
  ├─ oss/security-redaction
  ├─ feature/local-ai-quota-core
  ├─ feature/local-ai-quota-ui
  ├─ feature/provider-catalog-semantics
  └─ ci/release-gates
```

## 공통 PR 규칙

각 PR은 다음을 포함한다.

```md
## Summary
무엇을 바꿨는지

## Security impact
secret, raw payload, local logs, browser output에 미치는 영향

## Files changed
주요 파일 목록

## Verification
- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm build
- [ ] pnpm lint
- [ ] git diff --check

## Remaining risks
남은 위험 또는 후속 작업
```

## 파일 소유권 매트릭스

| Workstream | 주 담당 파일 | 수정 금지/주의 파일 |
|---|---|---|
| A. Open source docs | `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `docs/**` | `apps/web/lib/local-tools.ts` |
| B. Security hardening | `packages/security/**`, secret scan tests, redaction tests | UI copy 대량 수정 |
| C. Local AI quota core | `apps/web/lib/local-tools.ts`, `apps/web/lib/live-today.ts`, `apps/web/lib/local-tools.test.ts` | `OperationsViews.tsx`는 type 필요 시 최소 수정 |
| D. Quota UI/i18n | `apps/web/components/OperationsViews.tsx`, CSS, i18n message files | parser logic 수정 금지 |
| E. Provider catalog/connection semantics | `apps/web/lib/provider-catalog.ts`, `apps/web/lib/connection-status.ts`, config schema | local-tools parser 수정 금지 |
| F. CI/release gates | `.github/workflows/**`, `package.json`, scripts | 앱 로직 수정 금지 |

## 병렬 작업 가능 조합

동시에 진행 가능:

```text
A + C + F
A + D + E
B + D + E
C + F
```

주의가 필요한 조합:

```text
C + D
- type/interface 변경이 겹칠 수 있음.
- C가 먼저 metric shape를 확정하고 D는 그 타입에 맞춘다.

B + C
- redaction helper 적용 위치가 겹칠 수 있음.
- B는 helper 제공, C는 사용만 한다.

A + F
- README badge/CI status 문구가 겹칠 수 있음.
- F 완료 후 A가 badge를 정리한다.
```

피해야 하는 조합:

```text
C와 E가 동시에 connection/local CLI semantics를 바꾸는 것
D와 A가 같은 i18n/docs copy를 동시에 대량 수정하는 것
```

## 병합 순서

추천 merge order:

```text
1. A. Open source docs
2. F. CI/release gates
3. B. Security hardening
4. E. Provider catalog/connection semantics
5. C. Local AI quota core
6. D. Quota UI/i18n
```

단, C와 D를 빠르게 진행해야 하면 C에서 type만 먼저 작은 PR로 분리한다.

```text
C-0: usage metric type/source/window 확장
D-1: UI가 확장된 metric type을 사용
C-1: parser/capture 구현
```

## 작업자 체크인 포맷

매 작업 종료 시 다음 형식으로 공유한다.

```md
### 작업자
이름 또는 agent id

### Branch
feature/local-ai-quota-core

### 완료한 것
- ...

### 변경 파일
- ...

### 검증
- pnpm typecheck: pass/fail
- pnpm test: pass/fail
- pnpm build: pass/fail
- pnpm lint: pass/fail
- git diff --check: pass/fail

### 보안 영향
- secret output 없음
- raw payload 저장 없음
- local prompt text 저장 없음

### 다음 작업자에게 알릴 것
- ...
```

## AI 에이전트 작업 지침

에이전트에게 작업을 줄 때는 `tasks/AGENT_BRIEF_TEMPLATE.md`를 복사해서 사용한다.

필수 원칙:

1. 범위 밖 파일을 수정하지 않는다.
2. raw provider payload를 저장하지 않는다.
3. prompt text, API key, webhook URL을 fixture/test output에 넣지 않는다.
4. 실패한 검증 명령은 숨기지 않는다.
5. 큰 PR 대신 작은 PR을 만든다.
6. 타입 변경이 있으면 downstream 작업자에게 명확히 알린다.
7. Windows path와 PowerShell 환경 변수를 고려한다.
