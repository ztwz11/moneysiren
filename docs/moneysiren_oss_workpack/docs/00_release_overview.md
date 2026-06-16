# 00. MoneySiren 공개 릴리스 개요

## 제품 포지션

MoneySiren는 개인 개발자와 소규모 팀을 위한 **local-first cloud/SaaS/AI 사용량, 상태, 예상 과금 대시보드**다.

오픈소스 공개 시 핵심 메시지는 다음이어야 한다.

> MoneySiren는 사용자의 API key와 provider raw response를 서버로 보내지 않고, 로컬에서 read-only로 여러 서비스의 사용량과 비용 리스크를 확인하는 운영 도구다.

## 공개 저장소에서 강조할 원칙

1. **Local-first**
   - 기본 실행 위치는 사용자 로컬 머신이다.
   - SQLite, credential backend, logs, reports는 로컬에 남는다.
   - hosted SaaS가 아니다.

2. **Read-only**
   - provider connector는 read-only API/CLI/로그 조회만 수행한다.
   - AWS instance stop, API key revoke, worker disable 같은 write action은 v0.1 범위 밖이다.
   - 로컬 환경 변수 저장 같은 local write는 provider write와 명확히 구분한다.

3. **No raw payload persistence**
   - provider raw response를 SQLite, browser JSON, report, Slack payload, fixture, log에 저장하지 않는다.
   - connector는 raw response를 normalized snapshot으로 변환한 뒤 버린다.

4. **Canonical vs live_today 분리**
   - 전날까지 저장된 확정 데이터는 canonical snapshot이다.
   - 오늘 live refresh 데이터는 provisional overlay다.
   - 두 값을 같은 확정값처럼 섞지 않는다.

5. **AI subscription usage는 API billing과 분리**
   - OpenAI API billing과 Codex CLI local subscription usage는 다르다.
   - Anthropic API billing과 Claude Code subscription usage도 다르다.
   - Codex/Claude CLI는 “청구 비용”이 아니라 “로컬 사용량/한도 사용률 추정”으로 표현한다.

## 공개 전 위험 요소

| 위험 | 영향 | 우선순위 |
|---|---|---:|
| real API key, webhook URL, account id가 commit history나 fixture에 포함됨 | 즉시 보안 사고 | P0 |
| raw provider response가 DB/API/log/report로 노출됨 | 사용자 신뢰도 상실 | P0 |
| Codex/Claude CLI를 API billing처럼 표시함 | 제품 의미 왜곡 | P0 |
| Claude/Codex 5h/weekly 한도가 token/session 수로만 표시됨 | 핵심 UX 미달 | P1 |
| provider catalog에서 available/planned/live 용어가 섞임 | onboarding 혼란 | P1 |
| public README, SECURITY, CONTRIBUTING 부재 | 오픈소스 운영 미흡 | P1 |
| CI에서 typecheck/test/build/secret scan 미수행 | 공개 후 회귀 가능성 증가 | P1 |

## 공개 릴리스 최소 조건

- [ ] README에 설치, 로컬 실행, 보안 모델, provider 범위가 설명되어 있다.
- [ ] `.env.example`에는 실제 secret 또는 provider identifier가 없다.
- [ ] `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`가 있다.
- [ ] fixture는 synthetic data만 사용한다.
- [ ] secret scanning이 CI 또는 릴리스 체크리스트에 포함되어 있다.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm lint`, `git diff --check`가 통과한다.
- [ ] Codex/Claude CLI 화면에서 5시간/주간 한도 사용률이 session 수보다 우선 표시된다.
- [ ] Claude statusline capture는 prompt text를 저장하지 않고 quota metadata만 저장한다.
- [ ] local write action, provider write action, telemetry 정책이 명확히 구분되어 있다.
