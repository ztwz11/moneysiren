# EPIC-06. CI & Release Gates

## 목적

public repo 운영에 필요한 CI, secret scan, 릴리스 체크를 추가한다.

## 권장 브랜치

```text
ci/release-gates
```

## 담당 파일

```text
.github/workflows/**
package.json
tools/scripts/**
```

## 작업 항목

- [ ] CI workflow 추가
- [ ] typecheck/test/build/lint 실행
- [ ] git diff --check 실행
- [ ] secret scan workflow 추가 또는 문서화
- [ ] PR template와 CI checklist 연결
- [ ] Node/pnpm 버전 고정 확인
- [ ] Windows compatibility 테스트 job 여부 검토

## 기본 CI 예시

```yaml
name: ci

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11.5.0

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm lint
      - run: git diff --check
```

## Acceptance Criteria

- [ ] PR마다 CI가 실행된다.
- [ ] typecheck/test/build/lint가 모두 gate로 작동한다.
- [ ] secret scan 경로가 존재한다.
- [ ] workflow가 secret 값을 출력하지 않는다.
- [ ] 실패한 명령이 무시되지 않는다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
git diff --check
```
