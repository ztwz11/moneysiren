# EPIC-01. Open Source Public Readiness

## 목적

MoneySiren를 public repository로 공개할 수 있도록 루트 문서, 공개 정책, README, issue/PR template를 정리한다.

## 권장 브랜치

```text
oss/docs-public-readiness
```

## 담당 파일

```text
README.md
LICENSE
SECURITY.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SUPPORT.md
CHANGELOG.md
docs/**
.github/ISSUE_TEMPLATE/**
.github/pull_request_template.md
```

## 하지 말아야 할 것

```text
apps/web/lib/local-tools.ts 수정 금지
provider connector logic 수정 금지
secret 값이 들어간 예시 금지
real account/project/org id 예시 금지
```

## 작업 항목

- [ ] README를 공개용으로 재작성한다.
- [ ] local-first/read-only/no raw payload 원칙을 README 상단에 명시한다.
- [ ] provider support table을 추가한다.
- [ ] Codex/Claude CLI는 local-only usage estimate라고 명시한다.
- [ ] SECURITY.md를 추가한다.
- [ ] CONTRIBUTING.md를 추가한다.
- [ ] CODE_OF_CONDUCT.md를 추가한다.
- [ ] SUPPORT.md를 추가한다.
- [ ] GitHub issue template 2개를 추가한다.
- [ ] PR template를 추가한다.
- [ ] docs/security-model.md 초안을 추가한다.
- [ ] docs/local-ai-cli-usage.md 초안을 추가한다.

## Acceptance Criteria

- [ ] README만 읽어도 설치/실행/보안 모델을 이해할 수 있다.
- [ ] 공개 문서에 real secret 또는 real identifier가 없다.
- [ ] local AI CLI가 API billing으로 오해되지 않는다.
- [ ] provider write action이 현재 기능인 것처럼 보이지 않는다.
- [ ] telemetry off-by-default가 명시되어 있다.

## 검증

```bash
git diff --check
pnpm typecheck
pnpm test
```

문서-only PR이어도 최소 `git diff --check`는 필수다.
