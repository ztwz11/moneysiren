# 03. Codex/Claude CLI 5시간/주간 한도 % 구현 지침

## 목표

Codex CLI와 Claude CLI 화면은 session 수보다 아래 값을 우선 표시해야 한다.

```text
5시간 한도 사용률 %
주간 한도 사용률 %
현재 context 사용률 %
rolling 5h token 사용량
rolling 7d token 사용량
reset time
source/confidence
```

## 현재 문제 요약

현재 코드 구조에는 `five_hour_limit_percent`, `weekly_limit_percent` metric key와 `LocalCliStatusLineUsage` 필드가 이미 있다.  
하지만 실제 수집 경로가 불안정하다.

주요 문제:

1. Claude 공식 statusline의 `seven_day`를 weekly로 인식하지 못할 수 있다.
2. `resets_at`이 숫자 epoch일 때 reset time을 못 읽을 수 있다.
3. percent/used 값 선택이 latest가 아니라 max 중심이다.
4. 주간 window가 월초에 이전 달 파일을 읽지 못할 수 있다.
5. `total_tokens`가 input/output과 중복 합산될 수 있다.
6. UI에 progress bar가 연결되지 않았다.
7. source/confidence가 metric 단위로 표현되지 않는다.

---

## 1. 데이터 모델 확장

대상 파일:

```text
apps/web/lib/live-today.ts
apps/web/lib/local-tools.ts
```

### 권장 타입

```ts
export type UsageMetricWindow =
  | "rolling_5h"
  | "rolling_7d"
  | "current_context"
  | "current_session"
  | "current_month";

export type UsageMetricSource =
  | "provider_reported"
  | "statusline_capture"
  | "local_log_estimate"
  | "manual_limit_estimate";

export interface LiveTodayUsageMetric {
  key:
    | "five_hour_limit_percent"
    | "weekly_limit_percent"
    | "five_hour_tokens"
    | "weekly_tokens"
    | "context_percent"
    | "context_tokens"
    | "last_request_tokens"
    | "total_tokens"
    | "input_tokens"
    | "output_tokens"
    | "cache_tokens"
    | "reasoning_tokens"
    | "estimated_cost_usd"
    | "sessions"
    | "turns"
    | "tool_calls"
    | "log_files";

  value: number;
  unit: "tokens" | "requests" | "sessions" | "turns" | "calls" | "files" | "percent" | "usd";

  window?: UsageMetricWindow;
  source?: UsageMetricSource;
  confidence?: "high" | "medium" | "low";

  used?: number;
  limit?: number;
  resetAt?: string | null;
}
```

### 이유

현재 `LiveTodayUsageSummary.period`가 `"current_month"` 중심인데, 5시간/주간 한도는 current month가 아니라 rolling window다.  
metric마다 window/source/confidence를 갖게 해야 UI에서 사용자가 숫자의 의미를 알 수 있다.

---

## 2. Claude statusline capture 추가

대상 파일 신규 추가 추천:

```text
apps/web/lib/local-ai-statusline-capture.ts
tools/local-ai/claude-statusline-capture.mjs
```

또는 CLI package가 있다면:

```text
apps/cli/src/commands/local-ai/claude-statusline.ts
```

### capture file 위치

```text
~/.moneysiren/local-ai/claude-statusline.jsonl
```

Windows:

```text
%APPDATA%\MoneySiren\local-ai\claude-statusline.jsonl
```

### capture script 예시

```js
#!/usr/bin/env node
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

let input = "";
process.stdin.setEncoding("utf8");

for await (const chunk of process.stdin) {
  input += chunk;
}

try {
  const data = JSON.parse(input);

  const outDir = join(
    process.env.MONEYSIREN_HOME ?? join(homedir(), ".moneysiren"),
    "local-ai",
  );

  mkdirSync(outDir, { recursive: true });

  const event = {
    provider: "claude-cli",
    capturedAt: new Date().toISOString(),
    model: data.model?.id ?? data.model?.display_name ?? null,
    contextWindow: {
      usedPercentage: numberOrNull(data.context_window?.used_percentage),
      contextWindowSize: numberOrNull(data.context_window?.context_window_size),
      inputTokens: numberOrNull(data.context_window?.current_usage?.input_tokens),
      outputTokens: numberOrNull(data.context_window?.current_usage?.output_tokens),
      cacheReadTokens: numberOrNull(data.context_window?.current_usage?.cache_read_input_tokens),
      cacheCreationTokens: numberOrNull(data.context_window?.current_usage?.cache_creation_input_tokens),
    },
    rateLimits: {
      fiveHour: {
        usedPercentage: numberOrNull(data.rate_limits?.five_hour?.used_percentage),
        resetsAt: timestampOrNull(data.rate_limits?.five_hour?.resets_at),
      },
      weekly: {
        usedPercentage: numberOrNull(data.rate_limits?.seven_day?.used_percentage),
        resetsAt: timestampOrNull(data.rate_limits?.seven_day?.resets_at),
      },
    },
    cost: {
      totalCostUsd: numberOrNull(data.cost?.total_cost_usd),
    },
    secretsReturned: false,
    rawPersisted: false,
  };

  appendFileSync(
    join(outDir, "claude-statusline.jsonl"),
    JSON.stringify(event) + "\n",
    "utf8",
  );

  console.log(
    [
      "MoneySiren",
      `5h ${formatPercent(event.rateLimits.fiveHour.usedPercentage)}`,
      `7d ${formatPercent(event.rateLimits.weekly.usedPercentage)}`,
      `ctx ${formatPercent(event.contextWindow.usedPercentage)}`,
    ].join(" · "),
  );
} catch {
  console.log("MoneySiren usage unavailable");
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestampOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  return null;
}

function formatPercent(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}%`
    : "--";
}
```

### 주의

- 기존 사용자의 Claude statusline 설정을 덮어쓰지 않는다.
- 설치 명령은 기존 statusline이 있으면 wrapper 또는 chain 전략을 사용한다.
- capture 파일에는 prompt text, tool input, command body를 저장하지 않는다.

---

## 3. Claude parser hotfix

대상 파일:

```text
apps/web/lib/local-tools.ts
```

### `seven_day` 인식

```ts
function usageLimitWindowFromPath(path: readonly string[]): "fiveHour" | "weekly" | null {
  const normalizedPath = path.map((item) => item.toLowerCase()).join(".");

  if (
    normalizedPath.includes("five_hour") ||
    normalizedPath.includes("fivehour") ||
    normalizedPath.includes("5_hour") ||
    normalizedPath.includes("5hour") ||
    normalizedPath.includes("5h") ||
    normalizedPath.includes("five.hour") ||
    (normalizedPath.includes("five") && normalizedPath.includes("hour"))
  ) {
    return "fiveHour";
  }

  if (
    normalizedPath.includes("weekly") ||
    normalizedPath.includes("week") ||
    normalizedPath.includes("seven_day") ||
    normalizedPath.includes("sevenday") ||
    normalizedPath.includes("seven.day") ||
    normalizedPath.includes("7_day") ||
    normalizedPath.includes("7day")
  ) {
    return "weekly";
  }

  return null;
}
```

### numeric `resets_at` 인식

```ts
if (
  (normalizedPath.includes("reset") || normalizedPath.includes("resets_at")) &&
  (typeof value === "string" || typeof value === "number")
) {
  const resetAt = readTimestampValue(value);

  if (resetAt !== null) {
    setUsageLimitResetAt(statusLine, window, resetAt.toISOString());
  }

  return;
}
```

---

## 4. latest observed 선택

현재 max 기반으로 percent/used를 선택하면 reset 이후에도 이전 최고 사용률이 남을 수 있다.

### 권장 구조

```ts
interface ObservedNumber {
  value: number;
  observedAt: string | null;
  source: UsageMetricSource;
}
```

### 간단 대체 구현

기존 타입을 크게 바꾸기 어렵다면 내부 accumulator에 observedAt map만 추가한다.

```ts
interface UsageAccumulator {
  // existing fields...
  statusLineObservedAt: {
    fiveHourPercent: string | null;
    weeklyPercent: string | null;
    fiveHourUsed: string | null;
    weeklyUsed: string | null;
  };
}
```

```ts
function shouldReplaceObserved(previousAt: string | null, nextAt: string | null): boolean {
  if (previousAt === null) {
    return true;
  }

  if (nextAt === null) {
    return false;
  }

  return Date.parse(nextAt) >= Date.parse(previousAt);
}
```

`accumulateLimitMetadataFromValue`에서 record timestamp를 읽어 넘긴다.

```ts
function accumulateLimitMetadataFromValue(
  value: unknown,
  statusLine: MutableLocalCliStatusLineUsage,
  observed: UsageAccumulator["statusLineObservedAt"],
): void {
  const record = asRecord(value);

  if (record === null) {
    return;
  }

  const observedAt = readTimestamp(record)?.toISOString() ?? null;
  accumulateLimitMetadata(record, statusLine, observed, [], observedAt);
}
```

---

## 5. 주간 scan window 수정

현재 월초에는 최근 7일 중 이전 달 파일을 놓칠 수 있다.

```ts
const monthStart = new Date(Date.UTC(
  options.now.getUTCFullYear(),
  options.now.getUTCMonth(),
  1,
));

const weeklyWindowStart = new Date(options.now.getTime() - 7 * 24 * 60 * 60 * 1000);

const scanStart = new Date(Math.min(
  monthStart.getTime(),
  weeklyWindowStart.getTime(),
));
```

그리고:

```ts
const files = (await listJsonlFiles(options.root, scanStart))
```

---

## 6. token double count 수정

`total_tokens`가 있는 usage object는 explicit total을 우선하고, input/output/cache/reasoning을 또 total에 더하지 않는다.

```ts
function readTokenUsageObject(usage: Record<string, unknown>): {
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  reasoningTokens: number;
  totalTokens: number;
} | null {
  const inputTokens = readNumber(usage.input_tokens) ?? readNumber(usage.prompt_tokens) ?? 0;
  const outputTokens = readNumber(usage.output_tokens) ?? readNumber(usage.completion_tokens) ?? 0;
  const cacheTokens = readCacheTokens(usage) ?? 0;
  const reasoningTokens = readNumber(usage.reasoning_output_tokens) ?? 0;
  const explicitTotal = readNumber(usage.total_tokens);
  const inferredTotal = inputTokens + outputTokens + cacheTokens + reasoningTokens;

  if ((explicitTotal ?? inferredTotal) <= 0) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    cacheTokens,
    reasoningTokens,
    totalTokens: explicitTotal !== null && explicitTotal > 0
      ? explicitTotal
      : inferredTotal,
  };
}
```

---

## 7. Codex 구현 정책

Codex는 다음 순서로 quota percent를 결정한다.

```text
1. 로그/status metadata에 provider-reported percent가 있으면 사용
2. 로그/status metadata에 used/limit token이 있으면 used / limit 계산
3. env manual token limit이 있으면 rolling used / manual limit 계산
4. limit이 없으면 token 수만 표시하고 percent는 unavailable
```

env fallback:

```env
MONEYSIREN_CODEX_FIVE_HOUR_TOKEN_LIMIT=
MONEYSIREN_CODEX_WEEKLY_TOKEN_LIMIT=
```

UI에는 반드시 source/confidence를 보여준다.

```text
5시간 한도: 64%
128,000 / 200,000 tokens
source: manual_limit_estimate
confidence: low
```

---

## 8. UI 연결

대상 파일:

```text
apps/web/components/OperationsViews.tsx
```

### helper 추가

```tsx
function usageMetricNumber(
  summary: OperationsProvider["currentUsageSummary"],
  key: string,
): number | null {
  return summary?.metrics.find((item) => item.key === key)?.value ?? null;
}

function quotaState(percent: number | null | undefined): "low" | "medium" | "high" | "critical" {
  if (percent === undefined || percent === null) {
    return "low";
  }

  if (percent >= 95) {
    return "critical";
  }

  if (percent >= 80) {
    return "high";
  }

  if (percent >= 60) {
    return "medium";
  }

  return "low";
}
```

### MetricCard 사용

```tsx
const fiveHourPercent = usageMetricNumber(summary, "five_hour_limit_percent");
const weeklyPercent = usageMetricNumber(summary, "weekly_limit_percent");

<MetricCard
  label={messages.services.fiveHourLimit}
  value={fiveHourLimit}
  meta={metricMeta(summary, "five_hour_tokens", locale, messages)}
  progress={fiveHourPercent ?? undefined}
  warning={(fiveHourPercent ?? 0) >= 80}
/>

<MetricCard
  label={messages.services.weeklyLimit}
  value={weeklyLimit}
  meta={metricMeta(summary, "weekly_tokens", locale, messages)}
  progress={weeklyPercent ?? undefined}
  warning={(weeklyPercent ?? 0) >= 80}
/>
```

`MetricCard`에 `progressState`를 추가하면 더 좋다.

---

## 9. 테스트 케이스

대상 파일:

```text
apps/web/lib/local-tools.test.ts
```

### 추가해야 할 테스트

1. Claude `rate_limits.seven_day.used_percentage`가 weekly percent로 매핑된다.
2. Claude numeric `resets_at`이 ISO string으로 변환된다.
3. reset 이후 낮은 최신 percent가 이전 max보다 우선한다.
4. 월초에도 weekly window가 이전 달 파일을 읽는다.
5. `total_tokens`가 input/output과 중복 합산되지 않는다.
6. statusline capture output에 prompt text가 없다.
7. Codex manual token limit fallback으로 percent가 계산된다.
8. limit이 없으면 percent metric은 만들지 않고 token metric만 만든다.

### 테스트 fixture 예시

```ts
await writeFile(join(claudeProjectDir, "session.jsonl"), [
  JSON.stringify({
    timestamp: "2026-06-09T01:00:00.000Z",
    rate_limits: {
      five_hour: {
        used_percentage: 72,
        resets_at: 1788840000,
      },
      seven_day: {
        used_percentage: 38,
        resets_at: 1789120000,
      },
    },
    message: {
      content: "FAKE_CLAUDE_PROMPT_TEXT",
    },
  }),
].join("\n"), "utf8");
```

기대:

```ts
expect(claude?.usage.statusLine).toMatchObject({
  fiveHourLimitPercent: 72,
  weeklyLimitPercent: 38,
});
expect(JSON.stringify(status)).not.toContain("FAKE_CLAUDE_PROMPT_TEXT");
```

---

## 완료 기준

- [ ] Claude 5시간/주간 percent가 statusline capture에서 우선 수집된다.
- [ ] Codex percent는 source/confidence와 함께 표시된다.
- [ ] limit 없는 경우 percent 대신 token 수만 표시한다.
- [ ] reset 이후 최신 percent가 정확히 표시된다.
- [ ] 월초 weekly window가 깨지지 않는다.
- [ ] token total 중복 합산이 없다.
- [ ] UI에서 progress bar가 보인다.
- [ ] prompt text는 어떠한 API/view/report에도 노출되지 않는다.
