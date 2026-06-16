# MoneySiren Three Runtime Modes Workpack

이 작업팩은 MoneySiren를 다음 3가지 사용 방식으로 제공하기 위한 설계와 병렬 작업 지침이다.

1. 로컬 웹 대시보드: 브라우저에서 전체 사용량, 연결 설정, 리스크, 상세 화면 확인
2. CLI: 터미널에서 init, doctor, sync, report, summary, notify, serve, open 실행
3. 데스크톱 tray/notifier: Windows/macOS 작업표시줄/메뉴바에서 선택한 항목만 요약 표시, toast 알림, 웹페이지 열기

핵심 원칙:

- provider connector와 credential 설정은 웹 또는 CLI에서만 수행한다.
- tray/notifier는 secret을 직접 다루지 않는다.
- tray/notifier는 sanitized local view model만 읽는다.
- 로컬 서버는 127.0.0.1에만 bind한다.
- toast에는 raw provider payload, API key, account id, project id, email, invoice id를 표시하지 않는다.
- desktop app은 "full dashboard"가 아니라 "thin tray controller"로 시작한다.

추천 구현 순서:

1. packages/view-model
2. packages/local-api
3. CLI serve/open/summary/notify
4. Web notification settings
5. apps/tray thin desktop shell
6. autostart, packaging, signing, release notes
