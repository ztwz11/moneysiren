export const LOCALES = ["ko", "en", "ja"] as const;

export type Locale = (typeof LOCALES)[number];

export interface Messages {
  app: {
    title: string;
    subtitle: string;
    menu: string;
    closeMenu: string;
    locale: string;
    timezone: string;
    source: string;
    generated: string;
  };
  nav: {
    dashboard: string;
    services: string;
    settings: string;
    overview: string;
    today: string;
    forecast: string;
    risks: string;
    allServices: string;
    connections: string;
    preferences: string;
    providers: string;
  };
  dashboard: {
    overviewTitle: string;
    overviewSubtitle: string;
    monthForecast: string;
    confirmedThroughYesterday: string;
    todayLive: string;
    providersNeedingAttention: string;
    todayTitle: string;
    todaySubtitle: string;
    forecastTitle: string;
    forecastSubtitle: string;
    risksTitle: string;
    risksSubtitle: string;
    includedProviders: string;
    excludedProviders: string;
    canonicalCoverage: string;
    remainingDays: string;
    refresh: string;
    provisional: string;
    partial: string;
    noLiveValue: string;
  };
  services: {
    title: string;
    subtitle: string;
    serviceTitle: string;
    connection: string;
    access: string;
    canonicalFreshness: string;
    liveFreshness: string;
    liveGranularity: string;
    confidence: string;
    latestCanonicalSync: string;
    latestLiveCheck: string;
    cost: string;
    usage: string;
    healthRisk: string;
    dataConfidence: string;
    securityPermissions: string;
    emergencyActions: string;
    emergencyPlanned: string;
    viewRequirements: string;
    readOnly: string;
  };
  catalog: {
    title: string;
    subtitle: string;
    addProvider: string;
    search: string;
    category: string;
    status: string;
    auth: string;
    data: string;
    connect: string;
    viewRoadmap: string;
    all: string;
    available: string;
    planned: string;
    research: string;
  };
  settings: {
    connectionsTitle: string;
    connectionsSubtitle: string;
    preferencesTitle: string;
    preferencesSubtitle: string;
    authMethod: string;
    credentialSource: string;
    readOnlyTest: string;
    emergencyAccess: string;
    requiredEnv: string;
    actions: string;
    credentialSecret: string;
    accountIds: string;
    saveCredential: string;
    removeCredential: string;
    startOAuth: string;
    awsManaged: string;
    defaultLocale: string;
    dashboardTimezone: string;
    defaultStart: string;
    currencyDisplay: string;
    refreshTtl: string;
    density: string;
    telemetry: string;
    off: string;
  };
  states: Record<string, string>;
  table: {
    provider: string;
    month: string;
    today: string;
    health: string;
    risk: string;
    latest: string;
    status: string;
  };
  empty: {
    noDatabase: string;
    noProviders: string;
    noRisks: string;
  };
}

export const messages = {
  en: {
    app: {
      title: "StackSpend",
      subtitle: "Local spend, usage, and health operations.",
      menu: "Open menu",
      closeMenu: "Close menu",
      locale: "Language",
      timezone: "Timezone",
      source: "Source",
      generated: "Generated",
    },
    nav: {
      dashboard: "Dashboard",
      services: "Services",
      settings: "Settings",
      overview: "Overview",
      today: "Today Live",
      forecast: "Forecast",
      risks: "Risks",
      allServices: "All services",
      connections: "Connections",
      preferences: "Preferences",
      providers: "Provider catalog",
    },
    dashboard: {
      overviewTitle: "Overview",
      overviewSubtitle: "Month forecast first, with today's live data kept provisional.",
      monthForecast: "Month forecast",
      confirmedThroughYesterday: "Confirmed through yesterday",
      todayLive: "Today live",
      providersNeedingAttention: "Providers needing attention",
      todayTitle: "Today Live",
      todaySubtitle: "Manual read-only checks for the current dashboard day.",
      forecastTitle: "Forecast",
      forecastSubtitle: "Simple projection from canonical history and safe live values.",
      risksTitle: "Risks",
      risksSubtitle: "Provider health, stale data, and live check failures.",
      includedProviders: "Included providers",
      excludedProviders: "Excluded providers",
      canonicalCoverage: "Canonical coverage",
      remainingDays: "Remaining days",
      refresh: "Refresh live data",
      provisional: "Provisional",
      partial: "Partial",
      noLiveValue: "No live value",
    },
    services: {
      title: "All services",
      subtitle: "Provider-level cost, freshness, connection, and risk summary.",
      serviceTitle: "Service detail",
      connection: "Connection",
      access: "Access",
      canonicalFreshness: "Canonical freshness",
      liveFreshness: "Live freshness",
      liveGranularity: "Live granularity",
      confidence: "Confidence",
      latestCanonicalSync: "Latest canonical sync",
      latestLiveCheck: "Latest live check",
      cost: "Cost",
      usage: "Usage",
      healthRisk: "Health and risk",
      dataConfidence: "Data confidence",
      securityPermissions: "Security and permissions",
      emergencyActions: "Emergency actions",
      emergencyPlanned: "Planned only. Write actions are not available in this build.",
      viewRequirements: "View requirements",
      readOnly: "read-only",
    },
    catalog: {
      title: "Provider catalog",
      subtitle: "Add current providers and inspect planned integrations.",
      addProvider: "Add provider",
      search: "Search",
      category: "Category",
      status: "Status",
      auth: "Auth",
      data: "Data",
      connect: "Connect",
      viewRoadmap: "View roadmap",
      all: "All",
      available: "Available",
      planned: "Planned",
      research: "Research",
    },
    settings: {
      connectionsTitle: "Connections",
      connectionsSubtitle: "Credential status without exposing secret values.",
      preferencesTitle: "Preferences",
      preferencesSubtitle: "Local display settings only.",
      authMethod: "Auth method",
      credentialSource: "Credential source",
      readOnlyTest: "Read-only test",
      emergencyAccess: "Emergency access",
      requiredEnv: "Required env",
      actions: "Actions",
      credentialSecret: "Credential",
      accountIds: "Account IDs",
      saveCredential: "Save",
      removeCredential: "Remove local",
      startOAuth: "OAuth",
      awsManaged: "Use AWS profile or SSO outside StackSpend.",
      defaultLocale: "Default locale",
      dashboardTimezone: "Dashboard timezone",
      defaultStart: "Default start",
      currencyDisplay: "Currency display",
      refreshTtl: "Refresh TTL",
      density: "Density",
      telemetry: "Telemetry",
      off: "Off",
    },
    states: {
      fresh: "Fresh",
      stale: "Stale",
      missing: "Missing",
      live: "Live",
      error: "Error",
      unavailable: "Unavailable",
      not_configured: "Not configured",
      locked: "Locked",
      env_configured: "Env configured",
      credential_store_configured: "Credential store",
      oauth_connected: "OAuth connected",
      expired: "Expired",
      invalid: "Invalid",
      read_only_ready: "Read-only ready",
      emergency_not_configured: "Not configured",
      emergency_planned: "Planned",
      available: "Available",
      planned: "Planned",
      research: "Research",
      low: "Low",
      warning: "Warning",
      critical: "Critical",
      ok: "OK",
      degraded: "Degraded",
      down: "Down",
      unknown: "Unknown",
      exact_today: "Exact today",
      daily_bucket: "Daily bucket",
      month_to_date: "Month to date",
      current_period: "Current period",
      usage_only: "Usage only",
    },
    table: {
      provider: "Provider",
      month: "Month",
      today: "Today",
      health: "Health",
      risk: "Risk",
      latest: "Latest",
      status: "Status",
    },
    empty: {
      noDatabase: "Run the CLI sync pipeline to create local dashboard data. A safe empty state is shown.",
      noProviders: "No local provider data yet.",
      noRisks: "No risks found in local data.",
    },
  },
  ko: {
    app: {
      title: "StackSpend",
      subtitle: "로컬 비용, 사용량, 상태 운영 대시보드",
      menu: "메뉴 열기",
      closeMenu: "메뉴 닫기",
      locale: "언어",
      timezone: "시간대",
      source: "소스",
      generated: "생성 시각",
    },
    nav: {
      dashboard: "대시보드",
      services: "서비스",
      settings: "설정",
      overview: "개요",
      today: "오늘 실시간",
      forecast: "예상",
      risks: "리스크",
      allServices: "전체 서비스",
      connections: "연결",
      preferences: "환경설정",
      providers: "프로바이더 카탈로그",
    },
    dashboard: {
      overviewTitle: "개요",
      overviewSubtitle: "이번 달 예상 비용을 먼저 보고, 오늘 값은 임시 데이터로 분리합니다.",
      monthForecast: "이번 달 예상",
      confirmedThroughYesterday: "어제까지 확정",
      todayLive: "오늘 실시간",
      providersNeedingAttention: "확인이 필요한 서비스",
      todayTitle: "오늘 실시간",
      todaySubtitle: "현재 대시보드 날짜에 대해 수동으로 read-only 조회합니다.",
      forecastTitle: "예상",
      forecastSubtitle: "확정 이력과 안전한 실시간 값만 사용하는 단순 예측입니다.",
      risksTitle: "리스크",
      risksSubtitle: "서비스 상태, 오래된 데이터, 실시간 조회 실패를 모읍니다.",
      includedProviders: "포함된 서비스",
      excludedProviders: "제외된 서비스",
      canonicalCoverage: "확정 데이터 범위",
      remainingDays: "남은 일수",
      refresh: "실시간 데이터 새로고침",
      provisional: "임시",
      partial: "부분",
      noLiveValue: "실시간 값 없음",
    },
    services: {
      title: "전체 서비스",
      subtitle: "서비스별 비용, freshness, 연결 상태, 리스크 요약입니다.",
      serviceTitle: "서비스 상세",
      connection: "연결",
      access: "권한",
      canonicalFreshness: "확정 데이터 freshness",
      liveFreshness: "실시간 freshness",
      liveGranularity: "실시간 단위",
      confidence: "신뢰도",
      latestCanonicalSync: "최근 확정 sync",
      latestLiveCheck: "최근 실시간 조회",
      cost: "비용",
      usage: "사용량",
      healthRisk: "상태와 리스크",
      dataConfidence: "데이터 신뢰도",
      securityPermissions: "보안과 권한",
      emergencyActions: "긴급조치",
      emergencyPlanned: "계획된 기능입니다. 이 빌드에서는 write action을 실행할 수 없습니다.",
      viewRequirements: "요구사항 보기",
      readOnly: "읽기 전용",
    },
    catalog: {
      title: "프로바이더 카탈로그",
      subtitle: "현재 연결 가능한 서비스와 예정된 연동을 확인합니다.",
      addProvider: "프로바이더 추가",
      search: "검색",
      category: "카테고리",
      status: "상태",
      auth: "인증",
      data: "데이터",
      connect: "연결",
      viewRoadmap: "로드맵 보기",
      all: "전체",
      available: "사용 가능",
      planned: "예정",
      research: "검토",
    },
    settings: {
      connectionsTitle: "연결",
      connectionsSubtitle: "secret 값을 노출하지 않고 인증 상태만 보여줍니다.",
      preferencesTitle: "환경설정",
      preferencesSubtitle: "로컬 표시 설정만 관리합니다.",
      authMethod: "인증 방식",
      credentialSource: "자격 증명 소스",
      readOnlyTest: "읽기 전용 테스트",
      emergencyAccess: "긴급 권한",
      requiredEnv: "필수 env",
      actions: "작업",
      credentialSecret: "자격 증명",
      accountIds: "계정 ID",
      saveCredential: "저장",
      removeCredential: "로컬 제거",
      startOAuth: "OAuth",
      awsManaged: "AWS profile 또는 SSO를 StackSpend 밖에서 사용합니다.",
      defaultLocale: "기본 언어",
      dashboardTimezone: "대시보드 시간대",
      defaultStart: "기본 시작 화면",
      currencyDisplay: "통화 표시",
      refreshTtl: "새로고침 TTL",
      density: "밀도",
      telemetry: "텔레메트리",
      off: "꺼짐",
    },
    states: {
      fresh: "최신",
      stale: "오래됨",
      missing: "없음",
      live: "실시간",
      error: "오류",
      unavailable: "불가",
      not_configured: "미설정",
      locked: "잠김",
      env_configured: "env 설정됨",
      credential_store_configured: "자격 증명 저장됨",
      oauth_connected: "OAuth 연결됨",
      expired: "만료",
      invalid: "유효하지 않음",
      read_only_ready: "읽기 전용 준비됨",
      emergency_not_configured: "미설정",
      emergency_planned: "예정",
      available: "사용 가능",
      planned: "예정",
      research: "검토",
      low: "낮음",
      warning: "주의",
      critical: "심각",
      ok: "정상",
      degraded: "저하",
      down: "중단",
      unknown: "알 수 없음",
      exact_today: "오늘 정확값",
      daily_bucket: "일 단위",
      month_to_date: "월 누적",
      current_period: "현재 청구기간",
      usage_only: "사용량만",
    },
    table: {
      provider: "서비스",
      month: "월",
      today: "오늘",
      health: "상태",
      risk: "리스크",
      latest: "최근",
      status: "상태",
    },
    empty: {
      noDatabase: "CLI sync를 실행하면 로컬 대시보드 데이터가 생성됩니다. 지금은 안전한 빈 상태를 표시합니다.",
      noProviders: "아직 로컬 서비스 데이터가 없습니다.",
      noRisks: "로컬 데이터에서 리스크가 발견되지 않았습니다.",
    },
  },
  ja: {
    app: {
      title: "StackSpend",
      subtitle: "ローカルのコスト、利用量、ヘルス運用ダッシュボード",
      menu: "メニューを開く",
      closeMenu: "メニューを閉じる",
      locale: "言語",
      timezone: "タイムゾーン",
      source: "ソース",
      generated: "生成日時",
    },
    nav: {
      dashboard: "ダッシュボード",
      services: "サービス",
      settings: "設定",
      overview: "概要",
      today: "今日のライブ",
      forecast: "予測",
      risks: "リスク",
      allServices: "全サービス",
      connections: "接続",
      preferences: "環境設定",
      providers: "プロバイダーカタログ",
    },
    dashboard: {
      overviewTitle: "概要",
      overviewSubtitle: "月次予測を中心に、今日の値は暫定データとして分離します。",
      monthForecast: "月次予測",
      confirmedThroughYesterday: "昨日まで確定",
      todayLive: "今日のライブ",
      providersNeedingAttention: "確認が必要なサービス",
      todayTitle: "今日のライブ",
      todaySubtitle: "現在のダッシュボード日付を手動で read-only 確認します。",
      forecastTitle: "予測",
      forecastSubtitle: "確定履歴と安全なライブ値だけを使う単純な予測です。",
      risksTitle: "リスク",
      risksSubtitle: "サービス状態、古いデータ、ライブ確認の失敗をまとめます。",
      includedProviders: "含めたサービス",
      excludedProviders: "除外したサービス",
      canonicalCoverage: "確定データ範囲",
      remainingDays: "残り日数",
      refresh: "ライブデータを更新",
      provisional: "暫定",
      partial: "一部",
      noLiveValue: "ライブ値なし",
    },
    services: {
      title: "全サービス",
      subtitle: "サービス別のコスト、鮮度、接続状態、リスク概要です。",
      serviceTitle: "サービス詳細",
      connection: "接続",
      access: "権限",
      canonicalFreshness: "確定データ鮮度",
      liveFreshness: "ライブ鮮度",
      liveGranularity: "ライブ粒度",
      confidence: "信頼度",
      latestCanonicalSync: "最新の確定 sync",
      latestLiveCheck: "最新のライブ確認",
      cost: "コスト",
      usage: "利用量",
      healthRisk: "ヘルスとリスク",
      dataConfidence: "データ信頼度",
      securityPermissions: "セキュリティと権限",
      emergencyActions: "緊急操作",
      emergencyPlanned: "計画中の機能です。このビルドでは write action は実行できません。",
      viewRequirements: "要件を見る",
      readOnly: "読み取り専用",
    },
    catalog: {
      title: "プロバイダーカタログ",
      subtitle: "接続可能なサービスと予定中の連携を確認します。",
      addProvider: "プロバイダーを追加",
      search: "検索",
      category: "カテゴリ",
      status: "状態",
      auth: "認証",
      data: "データ",
      connect: "接続",
      viewRoadmap: "ロードマップを見る",
      all: "すべて",
      available: "利用可能",
      planned: "予定",
      research: "調査",
    },
    settings: {
      connectionsTitle: "接続",
      connectionsSubtitle: "secret 値を表示せずに認証状態だけを示します。",
      preferencesTitle: "環境設定",
      preferencesSubtitle: "ローカル表示設定のみを管理します。",
      authMethod: "認証方式",
      credentialSource: "認証情報ソース",
      readOnlyTest: "読み取り専用テスト",
      emergencyAccess: "緊急権限",
      requiredEnv: "必須 env",
      actions: "操作",
      credentialSecret: "認証情報",
      accountIds: "アカウント ID",
      saveCredential: "保存",
      removeCredential: "ローカルから外す",
      startOAuth: "OAuth",
      awsManaged: "AWS profile または SSO を StackSpend の外で使用します。",
      defaultLocale: "既定の言語",
      dashboardTimezone: "ダッシュボードタイムゾーン",
      defaultStart: "既定の開始画面",
      currencyDisplay: "通貨表示",
      refreshTtl: "更新 TTL",
      density: "密度",
      telemetry: "テレメトリー",
      off: "オフ",
    },
    states: {
      fresh: "最新",
      stale: "古い",
      missing: "なし",
      live: "ライブ",
      error: "エラー",
      unavailable: "利用不可",
      not_configured: "未設定",
      locked: "ロック中",
      env_configured: "env 設定済み",
      credential_store_configured: "認証情報保存済み",
      oauth_connected: "OAuth 接続済み",
      expired: "期限切れ",
      invalid: "無効",
      read_only_ready: "読み取り専用準備済み",
      emergency_not_configured: "未設定",
      emergency_planned: "予定",
      available: "利用可能",
      planned: "予定",
      research: "調査",
      low: "低",
      warning: "警告",
      critical: "重大",
      ok: "正常",
      degraded: "低下",
      down: "停止",
      unknown: "不明",
      exact_today: "今日の正確値",
      daily_bucket: "日次バケット",
      month_to_date: "月初来",
      current_period: "現在期間",
      usage_only: "利用量のみ",
    },
    table: {
      provider: "サービス",
      month: "月",
      today: "今日",
      health: "ヘルス",
      risk: "リスク",
      latest: "最新",
      status: "状態",
    },
    empty: {
      noDatabase: "CLI sync を実行するとローカルダッシュボードデータが作成されます。現在は安全な空状態を表示しています。",
      noProviders: "ローカルサービスデータはまだありません。",
      noRisks: "ローカルデータにリスクはありません。",
    },
  },
} satisfies Record<Locale, Messages>;

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

export function detectLocale(acceptLanguage: string | null): Locale {
  if (acceptLanguage === null || acceptLanguage.trim().length === 0) {
    return "en";
  }

  const requested = acceptLanguage
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter((part): part is string => part !== undefined && part.length > 0);

  for (const part of requested) {
    const primary = part.split("-")[0] ?? part;

    if (isLocale(primary)) {
      return primary;
    }
  }

  return "en";
}

export function localePath(locale: Locale, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${cleanPath}`;
}

export function replaceLocale(pathname: string, locale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length > 0 && isLocale(segments[0] ?? "")) {
    segments[0] = locale;
    return `/${segments.join("/")}`;
  }

  return `/${locale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
