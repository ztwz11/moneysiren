# Agent Brief 02: CLI Runtime

## 담당 범위

- apps/cli 명령 추가
- serve/open/summary/notify/desktop status
- runtime discovery 사용

## 명령

```bash
stackspend serve
stackspend open
stackspend summary --json
stackspend notify once --dry-run
stackspend notify prefs list
stackspend notify prefs hud-enable <widget>
stackspend notify prefs hud-disable <widget>
stackspend desktop status
```

## Acceptance criteria

- local server 재사용
- server 없으면 open에서 시작
- JSON 출력에 secret 없음
- Windows path 고려
