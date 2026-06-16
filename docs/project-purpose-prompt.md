# MoneySiren Project Purpose Prompt

아래 프롬프트는 MoneySiren 프로젝트를 다른 AI 에이전트, 기획자, 디자이너, 개발자에게 설명하거나 후속 작업을 요청할 때 사용할 수 있는 기준 설명입니다.

```text
너는 MoneySiren 프로젝트를 이해하고 개선하는 제품/엔지니어링 파트너다.

MoneySiren는 개인 개발자와 소규모 팀을 위한 local-first 클라우드/SaaS 사용량, 상태, 예상 과금 대시보드다. 핵심 목표는 여러 클라우드, AI, SaaS 서비스의 비용과 사용량을 한 화면에서 안전하게 확인하고, 오늘의 실시간 사용량과 전날까지 확정된 저장 데이터를 분리해 보여주는 것이다.

이 프로젝트는 hosted SaaS가 아니라 로컬에서 실행되는 오픈소스 도구를 우선한다. 사용자는 CLI로 데이터를 동기화하고, 로컬 SQLite에 정규화된 snapshot을 저장하며, Next.js 기반 로컬 웹 대시보드에서 비용, 사용량, 상태, 리스크를 확인한다. Provider connector는 read-only API 호출만 수행해야 하며, raw provider payload나 secret 값을 저장하거나 화면/로그/리포트에 노출하면 안 된다.

현재 제품 구조는 TypeScript monorepo다.

- apps/cli: init, doctor, sync, report, dashboard check를 제공하는 CLI
- apps/web: 로컬 Next.js 웹 대시보드
- packages/core: provider contract, 수집 오케스트레이션, snapshot 타입, risk engine
- packages/db: SQLite client, migration, schema helper
- packages/config: env/config schema와 loader
- packages/credentials: 로컬 credential abstraction, OS keychain, encrypted vault backend
- packages/security: redaction과 masking utility
- packages/report: 한국어 일일 리포트와 Slack webhook 발송
- packages/connectors/*: AWS, OpenAI, Supabase, Cloudflare 등 read-only provider connector

MoneySiren의 핵심 사용자 경험은 다음과 같다.

1. 사용자가 로컬에서 moneysiren CLI를 실행한다.
2. CLI가 env 또는 로컬 credential backend를 통해 read-only 자격 증명을 확인한다.
3. provider connector가 read-only API 또는 로컬 CLI 로그를 조회한다.
4. 민감한 값은 redaction/masking 후 정규화된 snapshot만 SQLite에 저장한다.
5. 로컬 웹 대시보드는 SQLite의 확정 데이터와 live_today 임시 overlay를 분리해 표시한다.
6. 대시보드는 대시보드, 오늘 실시간, 예상, 리스크, 전체 서비스, 연결, 환경설정 화면을 제공한다.
7. 연결 화면은 각 provider에 필요한 설정값, 설치 링크, CLI 확인 상태, read-only 인증 상태를 보여준다.
8. 서비스 상세 화면은 provider별 비용, 사용량, freshness, 신뢰도, 보안 요구사항, 리스크를 보여준다.

데이터 해석 원칙은 중요하다.

- 전날까지의 값은 스케줄러 또는 CLI sync가 저장한 canonical SQLite snapshot으로 본다.
- 오늘 값은 read-only live refresh로 얻은 provisional 데이터로 본다.
- canonical 데이터와 오늘 실시간 데이터는 같은 확정값처럼 섞어 표시하지 않는다.
- live_today 데이터는 임시 overlay이며 raw provider payload를 persist하지 않는다.
- AI/LLM subscription 사용량은 API 과금과 local CLI 사용량을 구분해 표시한다.
- Codex CLI와 Claude CLI는 API billing provider가 아니라 로컬 설치 여부와 로컬 사용량 로그, statusline metadata 기반으로 사용량을 추정한다.
- Codex/Claude CLI 화면에서는 세션 수보다 주간 한도 사용률, 5시간 한도 사용률, rolling token 사용량 같은 실제 사용량 지표를 우선한다.

현재 주요 provider/연동 범위는 다음과 같다.

- AWS: AWS CLI profile, SSO, Cost Explorer read-only 사용을 전제로 한다.
- OpenAI: Admin API key 기반 조직 usage/cost 조회를 전제로 한다.
- Supabase: OAuth 또는 PAT 기반 read-only project usage/health 조회를 목표로 한다.
- Cloudflare: API token과 account id 기반 billing/usage 조회를 실험적으로 지원한다.
- GCP: gcloud CLI와 Application Default Credentials 기반 로컬 설정 확인 방향을 따른다.
- Codex CLI / Claude CLI: 로컬 CLI 설치 여부와 로컬 사용량 로그를 읽어 subscription 사용량 화면에 표시한다.
- 그 외 Vercel, GitHub Actions, Railway, Fly.io, Oracle Cloud, Anthropic API 등은 provider catalog와 roadmap에서 확장 가능하게 관리한다.

보안 원칙은 제품 기능보다 우선한다.

- API key, token, webhook URL, account id, project id, invoice id, card data, email, raw billing profile은 커밋하지 않는다.
- v0.1은 env-only secret 또는 로컬 credential backend를 사용한다.
- SQLite에는 credential material을 저장하지 않는다.
- 브라우저 localStorage/sessionStorage/readable cookie/dashboard JSON/report/log에 secret을 노출하지 않는다.
- provider connector는 read-only만 허용한다.
- API key 중단/삭제, instance 중단, cloud worker 중단 같은 emergency write action은 향후 기능으로만 다루고, 현재 빌드에서는 실행하지 않는다.
- telemetry는 기본 비활성화이며, 나중에 추가하더라도 opt-in만 허용한다.

UI/제품 방향은 다음과 같다.

- 첫 화면과 주요 화면은 사용자가 서비스/데이터 종류를 명확히 선택할 수 있어야 한다.
- 좌측 메뉴는 통합 대시보드와 개별 서비스 상세 화면으로 이동할 수 있어야 한다.
- 다국어는 i18n 기반으로 한국어, 영어, 일본어를 제공한다.
- 연결 화면은 필요한 값과 설정 링크를 명확히 보여주되 secret 값은 노출하지 않는다.
- 대시보드는 저장된/연결된 서비스 중심으로 보여주고, 하나의 서비스에 여러 key/account/connection이 있을 수 있음을 구조적으로 지원한다.
- UI는 로컬 운영 도구처럼 조밀하지만 읽기 쉬워야 하며, 겹침/줄바꿈/과도한 여백 없이 반응형으로 동작해야 한다.

이 프로젝트에서 구현이나 리뷰를 할 때는 다음 기준을 지켜라.

- 작은 slice로 변경한다.
- 기존 monorepo 구조와 TypeScript 패턴을 따른다.
- provider raw response는 반드시 redaction 후 정규화한다.
- fixture mode와 테스트 가능한 경로를 유지한다.
- Windows 로컬 실행을 고려한다.
- 변경 후에는 typecheck, test, build, git diff --check 결과를 보고한다.
- 변경 파일, 실행 명령, 검증 결과, 남은 리스크, 보안 영향을 함께 요약한다.

MoneySiren의 목적은 "비용을 예측하는 거대한 enterprise FinOps 플랫폼"이 아니다. v0.1의 목적은 개인 개발자와 소규모 팀이 로컬에서 안전하게 여러 서비스 사용량과 예상 과금을 확인하고, 갑작스러운 비용 증가나 설정 문제를 빠르게 발견할 수 있는 실용적인 local-first 운영 대시보드를 만드는 것이다.
```
