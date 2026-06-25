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
    notifications: string;
    preferences: string;
    providers: string;
  };
  dashboard: {
    overviewTitle: string;
    overviewSubtitle: string;
    monthForecast: string;
    monthlyBudget: string;
    budgetUsage: string;
    budgetNotSet: string;
    budgetRisk: string;
    confirmedCoverage: string;
    confirmedThroughYesterday: string;
    todayLive: string;
    providersNeedingAttention: string;
    dailyUsageTrend: string;
    dailyUsageTrendNote: string;
    noDailyUsageTrend: string;
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
    groupBy: string;
    groupByService: string;
    groupByConnection: string;
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
    serviceCostBreakdown: string;
    serviceCostBreakdownNote: string;
    serviceCostShare: string;
    serviceMetric: string;
    noServiceCosts: string;
    usage: string;
    healthRisk: string;
    dataConfidence: string;
    securityPermissions: string;
    emergencyActions: string;
    emergencyPlanned: string;
    viewRequirements: string;
    readOnly: string;
    currentUsage: string;
    currentPeriod: string;
    topServices: string;
    inputTokens: string;
    outputTokens: string;
    cacheTokens: string;
    modelRequests: string;
    sessions: string;
    turns: string;
    toolCalls: string;
    logFiles: string;
    contextTokens: string;
    contextPercent: string;
    fiveHourLimit: string;
    weeklyLimit: string;
    fiveHourTokens: string;
    weeklyTokens: string;
    fiveHourRemainingTokens: string;
    weeklyRemainingTokens: string;
    usageResetCredits: string;
    usageResetCredit: string;
    usageResetCreditEstimate: string;
    lastRequestTokens: string;
    totalTokens: string;
    reasoningTokens: string;
    noCurrentUsage: string;
    localCliUsageNote: string;
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
    notificationsTitle: string;
    notificationsSubtitle: string;
    notificationsMaster: string;
    notificationsMasterHelp: string;
    notificationEnabled: string;
    notificationDisabled: string;
    digestEnabled: string;
    digestHelp: string;
    digestInterval: string;
    digestEverySixHours: string;
    digestDaily: string;
    digestWeekly: string;
    quietHours: string;
    quietHoursHelp: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    widgetsTitle: string;
    widgetsSubtitle: string;
    widgetSelection: string;
    widgetOrder: string;
    thresholdsTitle: string;
    thresholdsSubtitle: string;
    thresholdWidget: string;
    thresholdOperator: string;
    thresholdValue: string;
    thresholdCooldown: string;
    desktopStatusTitle: string;
    desktopStatus: string;
    desktopNotConnected: string;
    desktopAppInfo: string;
    hudSettingsTitle: string;
    hudSettingsSubtitle: string;
    hudAlwaysOnTop: string;
    hudBackgroundColor: string;
    hudFontColor: string;
    hudFontSize: string;
    hudOpacity: string;
    hudPadding: string;
    hudRowHeight: string;
    hudShowRemainingPercent: string;
    hudShowUsagePercent: string;
    hudMinimize: string;
    hudClose: string;
    hudSaveSettings: string;
    hudWidgetsTitle: string;
    hudWidgetsSubtitle: string;
    hudOpenWindow: string;
    testNotification: string;
    testNotificationSent: string;
    notificationLocalOnly: string;
    notificationPreview: string;
    saveNotifications: string;
    notificationPrefsSaved: string;
    notificationPrefsSaveError: string;
    notificationPrefsLoadError: string;
    notificationStoredLocally: string;
    preferencesTitle: string;
    preferencesSubtitle: string;
    authMethod: string;
    credentialSource: string;
    readOnlyTest: string;
    emergencyAccess: string;
    requiredEnv: string;
    requiredValueLinks: string;
    setupLinks: string;
    actions: string;
    savedConnections: string;
    connectionLabel: string;
    connectionId: string;
    credentialSecret: string;
    accountIds: string;
    openAiAdminKeyHint: string;
    envOnlySecrets: string;
    credentialSaveError: string;
    credentialDeleteError: string;
    saveCredential: string;
    removeCredential: string;
    startOAuth: string;
    toolLoadingTitle: string;
    toolLoadingCheckingCli: string;
    toolLoadingCheckingCredentials: string;
    toolLoadingReadingUsage: string;
    toolLoadingPreparingView: string;
    awsManaged: string;
    awsCliTitle: string;
    awsCliInstalled: string;
    awsCliMissing: string;
    awsCliError: string;
    awsCliVersion: string;
    awsCredentialChain: string;
    awsCredentialConfigured: string;
    awsCredentialMissing: string;
    installAwsCli: string;
    configureAwsSso: string;
    refreshAwsCliStatus: string;
    awsCliCommandHint: string;
    awsProfileName: string;
    registerAwsProfileGlobally: string;
    awsProfilePersistHint: string;
    awsProfilePersistSuccess: string;
    awsProfilePersistError: string;
    gcpManaged: string;
    gcpCliTitle: string;
    gcpCliInstalled: string;
    gcpCliMissing: string;
    gcpCliError: string;
    gcpAccount: string;
    gcpProject: string;
    gcpAdc: string;
    gcpConfigured: string;
    gcpMissing: string;
    installGcloudCli: string;
    configureGcloudAuth: string;
    configureGcloudAdc: string;
    refreshGcpCliStatus: string;
    gcpCliCommandHint: string;
    localCliTitle: string;
    localCliInstalled: string;
    localCliMissing: string;
    localCliCheckFailed: string;
    localCliUsageSource: string;
    localCliLatestActivity: string;
    localCliSessionsTurns: string;
    localCliNoUsage: string;
    localCliStatusLine: string;
    localCliContextWindow: string;
    localCliFiveHourLimit: string;
    localCliWeeklyLimit: string;
    localCliFiveHourWindow: string;
    localCliWeeklyWindow: string;
    localCliRemaining: string;
    localCliResetAt: string;
    localCliUsageResetCredits: string;
    localCliUsageResetCredit: string;
    localCliLearnMore: string;
    localCliDashboardTitle: string;
    localCliDashboardSubtitle: string;
    localCliDashboardMetricSelection: string;
    saveDashboardDisplay: string;
    dashboardDisplayPrefsSaved: string;
    dashboardDisplayPrefsSaveError: string;
    dashboardDisplayPrefsLoadError: string;
    dashboardWidgetsTitle: string;
    dashboardWidgetsSubtitle: string;
    dashboardWidgetScreen: string;
    dashboardWidgetSelection: string;
    dashboardWidgetSize: string;
    dashboardWidgetMoveUp: string;
    dashboardWidgetMoveDown: string;
    dashboardWidgetCompact: string;
    dashboardWidgetNormal: string;
    dashboardWidgetWide: string;
    dashboardWidgetFull: string;
    budgetTitle: string;
    budgetSubtitle: string;
    monthlyBudgetLimit: string;
    budgetCurrency: string;
    budgetWarningPercent: string;
    budgetCriticalPercent: string;
    saveBudget: string;
    budgetPrefsSaved: string;
    budgetPrefsSaveError: string;
    budgetPrefsLoadError: string;
    localCliLastRequest: string;
    localCliSessionTokens: string;
    localCliCurrentUsage: string;
    localCliReasoning: string;
    localCliLogFiles: string;
    refreshLocalCliStatus: string;
    defaultLocale: string;
    dashboardTimezone: string;
    defaultStart: string;
    currencyDisplay: string;
    refreshTtl: string;
    density: string;
    telemetry: string;
    off: string;
  };
  notificationWidgets: {
    month_forecast: string;
    today_live_cost: string;
    risk_high_count: string;
    stale_connection_count: string;
    aws_month_forecast: string;
    openai_today_cost: string;
    openai_today_tokens: string;
    claude_five_hour_percent: string;
    claude_weekly_percent: string;
    codex_five_hour_percent: string;
    codex_weekly_percent: string;
    codex_reset_credit_count: string;
    codex_reset_credit_expiry: string;
    supabase_usage_health: string;
    cloudflare_month_to_date: string;
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
      title: "MoneySiren",
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
      overview: "Dashboard",
      today: "Today Live",
      forecast: "Forecast",
      risks: "Risks",
      allServices: "All services",
      connections: "Connections",
      notifications: "Notifications",
      preferences: "Preferences",
      providers: "Provider catalog",
    },
    dashboard: {
      overviewTitle: "Dashboard",
      overviewSubtitle: "Month forecast first, with today's live data kept provisional.",
      monthForecast: "Month forecast",
      monthlyBudget: "Monthly budget",
      budgetUsage: "Budget usage",
      budgetNotSet: "No budget set",
      budgetRisk: "Budget risk",
      confirmedCoverage: "Confirmed coverage",
      confirmedThroughYesterday: "Confirmed through yesterday",
      todayLive: "Today live",
      providersNeedingAttention: "Providers needing attention",
      dailyUsageTrend: "Daily usage trend",
      dailyUsageTrendNote: "Collected-day totals",
      noDailyUsageTrend: "No daily usage snapshots yet",
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
      groupBy: "Group by",
      groupByService: "Services",
      groupByConnection: "Connections",
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
      serviceCostBreakdown: "Service cost breakdown",
      serviceCostBreakdownNote: "Latest AWS Cost Explorer service costs from the most recent canonical sync.",
      serviceCostShare: "Share",
      serviceMetric: "Metric",
      noServiceCosts: "No service-level cost rows are available yet.",
      usage: "Usage",
      healthRisk: "Health and risk",
      dataConfidence: "Data confidence",
      securityPermissions: "Security and permissions",
      emergencyActions: "Emergency actions",
      emergencyPlanned: "Planned only. Write actions are not available in this build.",
      viewRequirements: "View requirements",
      readOnly: "read-only",
      currentUsage: "Current usage",
      currentPeriod: "Current period",
      topServices: "Top services",
      inputTokens: "Input tokens",
      outputTokens: "Output tokens",
      cacheTokens: "Cache tokens",
      modelRequests: "Model requests",
      sessions: "Sessions",
      turns: "Turns",
      toolCalls: "Tool calls",
      logFiles: "Log files",
      contextTokens: "Context tokens",
      contextPercent: "Context used",
      fiveHourLimit: "5-hour usage",
      weeklyLimit: "Weekly usage",
      fiveHourTokens: "5-hour tokens",
      weeklyTokens: "Weekly tokens",
      fiveHourRemainingTokens: "5-hour remaining",
      weeklyRemainingTokens: "Weekly remaining",
      usageResetCredits: "Usage reset credits",
      usageResetCredit: "Usage reset credit",
      usageResetCreditEstimate: "Estimated reset credit expiry",
      lastRequestTokens: "Last request",
      totalTokens: "Total tokens",
      reasoningTokens: "Reasoning tokens",
      noCurrentUsage: "No current usage",
      localCliUsageNote: "Local CLI token usage from statusline and local session logs.",
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
      notificationsTitle: "Notifications",
      notificationsSubtitle: "Choose the local digest, widgets, and alert thresholds shown by the desktop notifier.",
      notificationsMaster: "Notifications",
      notificationsMasterHelp: "Controls local digest and desktop notification preferences only.",
      notificationEnabled: "On",
      notificationDisabled: "Off",
      digestEnabled: "Digest",
      digestHelp: "Selected widgets appear in the digest in the order shown below.",
      digestInterval: "Digest interval",
      digestEverySixHours: "Every 6 hours",
      digestDaily: "Daily",
      digestWeekly: "Weekly",
      quietHours: "Quiet hours",
      quietHoursHelp: "Notifications stay silent during this local time window.",
      quietHoursStart: "Start",
      quietHoursEnd: "End",
      widgetsTitle: "Digest widgets",
      widgetsSubtitle: "Only selected widgets are included in the local digest preview.",
      widgetSelection: "Widget selection",
      widgetOrder: "Order",
      thresholdsTitle: "Threshold rules",
      thresholdsSubtitle: "Threshold rows are stored locally and evaluated by the desktop notifier.",
      thresholdWidget: "Widget",
      thresholdOperator: "Operator",
      thresholdValue: "Value",
      thresholdCooldown: "Cooldown",
      desktopStatusTitle: "Desktop app",
      desktopStatus: "Status",
      desktopNotConnected: "Not connected",
      desktopAppInfo: "The tray/HUD app reads this local preference and sanitized digest data. It never receives provider secrets.",
      hudSettingsTitle: "HUD display",
      hudSettingsSubtitle: "Tune the always-on-top HUD for compact, long-running desktop use.",
      hudAlwaysOnTop: "Always on top",
      hudBackgroundColor: "Background color",
      hudFontColor: "Font color",
      hudFontSize: "Font size",
      hudOpacity: "Opacity",
      hudPadding: "Padding",
      hudRowHeight: "Row height",
      hudShowRemainingPercent: "Show remaining",
      hudShowUsagePercent: "Show usage",
      hudMinimize: "Minimize HUD",
      hudClose: "Close HUD",
      hudSaveSettings: "Save HUD",
      hudWidgetsTitle: "HUD items",
      hudWidgetsSubtitle: "Choose exactly what stays visible in the floating HUD.",
      hudOpenWindow: "Open HUD window",
      testNotification: "Test notification",
      testNotificationSent: "Preview generated",
      notificationLocalOnly: "Local preview only. No webhook or provider call is sent; the installed desktop app can consume the same digest.",
      notificationPreview: "Preview",
      saveNotifications: "Save notifications",
      notificationPrefsSaved: "Notification preferences saved locally.",
      notificationPrefsSaveError: "Notification preferences were not saved.",
      notificationPrefsLoadError: "Notification preferences could not be loaded.",
      notificationStoredLocally: "Preferences are stored in a local MoneySiren file.",
      preferencesTitle: "Preferences",
      preferencesSubtitle: "Local display settings only.",
      authMethod: "Auth method",
      credentialSource: "Credential source",
      readOnlyTest: "Read-only test",
      emergencyAccess: "Emergency access",
      requiredEnv: "Required env",
      requiredValueLinks: "Required value links",
      setupLinks: "Setup links",
      actions: "Actions",
      savedConnections: "Saved connections",
      connectionLabel: "Connection label",
      connectionId: "Connection ID",
      credentialSecret: "Credential",
      accountIds: "Account IDs",
      openAiAdminKeyHint: "Use an OpenAI Admin API key with organization usage and costs access.",
      envOnlySecrets: "MoneySiren v0.1 uses environment variables only. New API keys and OAuth tokens are not saved locally.",
      credentialSaveError: "Credential was not saved.",
      credentialDeleteError: "Credential was not removed.",
      saveCredential: "Save",
      removeCredential: "Remove local",
      startOAuth: "OAuth",
      toolLoadingTitle: "Loading local tools",
      toolLoadingCheckingCli: "Checking CLI installation",
      toolLoadingCheckingCredentials: "Checking local profile and credentials",
      toolLoadingReadingUsage: "Reading local usage logs",
      toolLoadingPreparingView: "Preparing setup details",
      awsManaged: "Use AWS profile or SSO outside MoneySiren.",
      awsCliTitle: "AWS local setup",
      awsCliInstalled: "AWS CLI installed",
      awsCliMissing: "AWS CLI missing",
      awsCliError: "AWS CLI check failed",
      awsCliVersion: "Version",
      awsCredentialChain: "Credential chain",
      awsCredentialConfigured: "Credential chain configured",
      awsCredentialMissing: "AWS_PROFILE not configured",
      installAwsCli: "Install AWS CLI",
      configureAwsSso: "Configure SSO profile",
      refreshAwsCliStatus: "Check again",
      awsCliCommandHint: "After installation, open a new terminal and run aws configure sso, aws sso login --profile <profile>, then register AWS_PROFILE for MoneySiren.",
      awsProfileName: "AWS profile",
      registerAwsProfileGlobally: "Save as user env",
      awsProfilePersistHint: "Saves AWS_PROFILE to the Windows user environment. New terminals inherit it, and the current MoneySiren server is updated immediately.",
      awsProfilePersistSuccess: "AWS_PROFILE was saved.",
      awsProfilePersistError: "AWS_PROFILE was not saved.",
      gcpManaged: "Use Google Cloud CLI and Application Default Credentials outside MoneySiren.",
      gcpCliTitle: "Google Cloud local setup",
      gcpCliInstalled: "gcloud installed",
      gcpCliMissing: "gcloud missing",
      gcpCliError: "gcloud check failed",
      gcpAccount: "Active account",
      gcpProject: "Project",
      gcpAdc: "Application Default Credentials",
      gcpConfigured: "Configured",
      gcpMissing: "Missing",
      installGcloudCli: "Install gcloud",
      configureGcloudAuth: "Configure CLI auth",
      configureGcloudAdc: "Configure ADC",
      refreshGcpCliStatus: "Check again",
      gcpCliCommandHint: "Run gcloud auth login for the CLI, gcloud auth application-default login for local SDK credentials, and set a project before using Google Cloud reads.",
      localCliTitle: "Local CLI usage",
      localCliInstalled: "CLI installed",
      localCliMissing: "CLI missing",
      localCliCheckFailed: "CLI check failed",
      localCliUsageSource: "Usage source",
      localCliLatestActivity: "Latest activity",
      localCliSessionsTurns: "Sessions / turns",
      localCliNoUsage: "No local usage logs found.",
      localCliStatusLine: "Statusline usage",
      localCliContextWindow: "Context window",
      localCliFiveHourLimit: "5-hour usage",
      localCliWeeklyLimit: "Weekly usage",
      localCliFiveHourWindow: "5 hours",
      localCliWeeklyWindow: "1 week",
      localCliRemaining: "Remaining",
      localCliResetAt: "Reset",
      localCliUsageResetCredits: "Usage reset credits",
      localCliUsageResetCredit: "Usage reset credit",
      localCliLearnMore: "Learn more",
      localCliDashboardTitle: "CLI dashboard fields",
      localCliDashboardSubtitle: "Choose which local CLI metrics appear in dashboard tables.",
      localCliDashboardMetricSelection: "CLI dashboard metric selection",
      saveDashboardDisplay: "Save dashboard display",
      dashboardDisplayPrefsSaved: "Dashboard display preferences saved locally.",
      dashboardDisplayPrefsSaveError: "Dashboard display preferences were not saved.",
      dashboardDisplayPrefsLoadError: "Dashboard display preferences could not be loaded.",
      dashboardWidgetsTitle: "Dashboard widgets",
      dashboardWidgetsSubtitle: "Hide, reorder, and resize each dashboard screen independently.",
      dashboardWidgetScreen: "Dashboard screen",
      dashboardWidgetSelection: "Dashboard widget layout",
      dashboardWidgetSize: "Size",
      dashboardWidgetMoveUp: "Move up",
      dashboardWidgetMoveDown: "Move down",
      dashboardWidgetCompact: "Compact",
      dashboardWidgetNormal: "Normal",
      dashboardWidgetWide: "Wide",
      dashboardWidgetFull: "Full",
      budgetTitle: "Monthly budget",
      budgetSubtitle: "Set the local budget used for budget risk. Leave it blank to disable budget risk.",
      monthlyBudgetLimit: "Monthly budget limit",
      budgetCurrency: "Currency",
      budgetWarningPercent: "Warning at",
      budgetCriticalPercent: "Critical at",
      saveBudget: "Save budget",
      budgetPrefsSaved: "Budget settings saved locally.",
      budgetPrefsSaveError: "Budget settings were not saved.",
      budgetPrefsLoadError: "Budget settings could not be loaded.",
      localCliLastRequest: "Last request",
      localCliSessionTokens: "Session tokens",
      localCliCurrentUsage: "Current usage",
      localCliReasoning: "Reasoning",
      localCliLogFiles: "Log files",
      refreshLocalCliStatus: "Check usage",
      defaultLocale: "Default locale",
      dashboardTimezone: "Dashboard timezone",
      defaultStart: "Default start",
      currencyDisplay: "Currency display",
      refreshTtl: "Refresh TTL",
      density: "Density",
      telemetry: "Telemetry",
      off: "Off",
    },
    notificationWidgets: {
      month_forecast: "Month forecast",
      today_live_cost: "Today live cost",
      risk_high_count: "High-risk count",
      stale_connection_count: "Stale connections",
      aws_month_forecast: "AWS month forecast",
      openai_today_cost: "OpenAI today cost",
      openai_today_tokens: "OpenAI today tokens",
      claude_five_hour_percent: "Claude 5-hour usage",
      claude_weekly_percent: "Claude weekly usage",
      codex_five_hour_percent: "Codex 5-hour usage",
      codex_weekly_percent: "Codex weekly usage",
      codex_reset_credit_count: "Codex reset credits",
      codex_reset_credit_expiry: "Codex reset credit expiry",
      supabase_usage_health: "Supabase usage health",
      cloudflare_month_to_date: "Cloudflare month to date",
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
      noProviders: "No saved services yet. Add one from Connections.",
      noRisks: "No risks found in local data.",
    },
  },
  ko: {
    app: {
      title: "MoneySiren",
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
      overview: "대시보드",
      today: "오늘 실시간",
      forecast: "예상",
      risks: "리스크",
      allServices: "전체 서비스",
      connections: "연결",
      notifications: "알림",
      preferences: "환경설정",
      providers: "프로바이더 카탈로그",
    },
    dashboard: {
      overviewTitle: "대시보드",
      overviewSubtitle: "이번 달 예상 비용을 먼저 보고, 오늘 값은 임시 데이터로 분리합니다.",
      monthForecast: "이번 달 예상",
      monthlyBudget: "월 예산",
      budgetUsage: "예산 사용률",
      budgetNotSet: "예산 없음",
      budgetRisk: "예산 리스크",
      confirmedCoverage: "확정률",
      confirmedThroughYesterday: "어제까지 확정",
      todayLive: "오늘 실시간",
      providersNeedingAttention: "확인이 필요한 서비스",
      dailyUsageTrend: "일자별 사용량 추세",
      dailyUsageTrendNote: "수집일 기준 합계",
      noDailyUsageTrend: "아직 일자별 사용량 스냅샷이 없습니다",
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
      groupBy: "보기 기준",
      groupByService: "서비스",
      groupByConnection: "연결",
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
      serviceCostBreakdown: "서비스별 비용 상세",
      serviceCostBreakdownNote: "가장 최근 확정 sync의 AWS Cost Explorer 서비스별 비용입니다.",
      serviceCostShare: "비중",
      serviceMetric: "지표",
      noServiceCosts: "아직 서비스별 비용 행이 없습니다.",
      usage: "사용량",
      healthRisk: "상태와 리스크",
      dataConfidence: "데이터 신뢰도",
      securityPermissions: "보안과 권한",
      emergencyActions: "긴급조치",
      emergencyPlanned: "계획된 기능입니다. 이 빌드에서는 write action을 실행할 수 없습니다.",
      viewRequirements: "요구사항 보기",
      readOnly: "읽기 전용",
      currentUsage: "현재 사용량",
      currentPeriod: "현재 기간",
      topServices: "상위 서비스",
      inputTokens: "입력 토큰",
      outputTokens: "출력 토큰",
      cacheTokens: "캐시 토큰",
      modelRequests: "모델 요청",
      sessions: "세션",
      turns: "턴",
      toolCalls: "툴 호출",
      logFiles: "로그 파일",
      contextTokens: "컨텍스트 토큰",
      contextPercent: "컨텍스트 사용률",
      fiveHourLimit: "5시간 사용량",
      weeklyLimit: "주간 사용량",
      fiveHourTokens: "5시간 토큰",
      weeklyTokens: "주간 토큰",
      fiveHourRemainingTokens: "5시간 남은 토큰",
      weeklyRemainingTokens: "주간 남은 토큰",
      usageResetCredits: "초기화권",
      usageResetCredit: "초기화권",
      usageResetCreditEstimate: "초기화권 추정 만료",
      lastRequestTokens: "마지막 요청",
      totalTokens: "전체 토큰",
      reasoningTokens: "Reasoning 토큰",
      noCurrentUsage: "현재 사용량 없음",
      localCliUsageNote: "statusline과 로컬 세션 로그 기반 CLI 토큰 사용량입니다.",
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
      notificationsTitle: "알림",
      notificationsSubtitle: "로컬 digest, 위젯, desktop notifier에 표시할 기준을 선택합니다.",
      notificationsMaster: "알림",
      notificationsMasterHelp: "로컬 digest와 desktop 알림 환경설정만 제어합니다.",
      notificationEnabled: "켜짐",
      notificationDisabled: "꺼짐",
      digestEnabled: "Digest",
      digestHelp: "선택한 위젯은 아래 순서대로 digest에 표시됩니다.",
      digestInterval: "Digest 주기",
      digestEverySixHours: "6시간마다",
      digestDaily: "매일",
      digestWeekly: "매주",
      quietHours: "조용한 시간",
      quietHoursHelp: "이 로컬 시간대에는 알림을 무음으로 둡니다.",
      quietHoursStart: "시작",
      quietHoursEnd: "종료",
      widgetsTitle: "Digest 위젯",
      widgetsSubtitle: "선택한 위젯만 로컬 digest preview에 포함합니다.",
      widgetSelection: "위젯 선택",
      widgetOrder: "순서",
      thresholdsTitle: "Threshold 규칙",
      thresholdsSubtitle: "Threshold 행은 로컬에 저장되고 데스크톱 알리미가 평가합니다.",
      thresholdWidget: "위젯",
      thresholdOperator: "연산자",
      thresholdValue: "값",
      thresholdCooldown: "쿨다운",
      desktopStatusTitle: "Desktop app",
      desktopStatus: "상태",
      desktopNotConnected: "연결 안 됨",
      desktopAppInfo: "Tray/HUD 앱은 이 로컬 설정과 정리된 digest 데이터만 읽습니다. provider secret은 받지 않습니다.",
      hudSettingsTitle: "HUD 표시",
      hudSettingsSubtitle: "항상 위에 띄워둘 수 있도록 작고 오래 보기 편하게 조절합니다.",
      hudAlwaysOnTop: "항상 위에 표시",
      hudBackgroundColor: "배경색",
      hudFontColor: "폰트색",
      hudFontSize: "폰트 크기",
      hudOpacity: "투명도",
      hudPadding: "여백",
      hudRowHeight: "각 행 높이",
      hudShowRemainingPercent: "남은량 표시",
      hudShowUsagePercent: "사용량 표시",
      hudMinimize: "HUD 최소화",
      hudClose: "HUD 닫기",
      hudSaveSettings: "HUD 저장",
      hudWidgetsTitle: "HUD 표시 항목",
      hudWidgetsSubtitle: "떠 있는 HUD에 계속 보여줄 항목을 고릅니다.",
      hudOpenWindow: "HUD 창 열기",
      testNotification: "테스트 알림",
      testNotificationSent: "Preview 생성됨",
      notificationLocalOnly: "로컬 미리보기 전용입니다. webhook이나 provider 호출은 보내지 않고, 설치된 데스크톱 앱이 같은 digest를 읽을 수 있습니다.",
      notificationPreview: "Preview",
      saveNotifications: "알림 저장",
      notificationPrefsSaved: "알림 환경설정을 로컬에 저장했습니다.",
      notificationPrefsSaveError: "알림 환경설정을 저장하지 못했습니다.",
      notificationPrefsLoadError: "알림 환경설정을 불러오지 못했습니다.",
      notificationStoredLocally: "환경설정은 MoneySiren 로컬 파일에 저장됩니다.",
      preferencesTitle: "환경설정",
      preferencesSubtitle: "로컬 표시 설정만 관리합니다.",
      authMethod: "인증 방식",
      credentialSource: "자격 증명 소스",
      readOnlyTest: "읽기 전용 테스트",
      emergencyAccess: "긴급 권한",
      requiredEnv: "필수 env",
      requiredValueLinks: "필요 값 확인 링크",
      setupLinks: "설정 링크",
      actions: "작업",
      savedConnections: "저장된 연결",
      connectionLabel: "연결 이름",
      connectionId: "연결 ID",
      credentialSecret: "자격 증명",
      accountIds: "계정 ID",
      openAiAdminKeyHint: "조직 사용량과 비용 조회 권한이 있는 OpenAI Admin API key가 필요합니다.",
      envOnlySecrets: "MoneySiren v0.1은 환경 변수만 사용합니다. 새 API key와 OAuth token은 로컬에 저장하지 않습니다.",
      credentialSaveError: "자격 증명이 저장되지 않았습니다.",
      credentialDeleteError: "자격 증명이 삭제되지 않았습니다.",
      saveCredential: "저장",
      removeCredential: "로컬 제거",
      startOAuth: "OAuth",
      toolLoadingTitle: "로컬 도구 확인 중",
      toolLoadingCheckingCli: "CLI 설치 상태 확인",
      toolLoadingCheckingCredentials: "로컬 프로필과 자격 증명 확인",
      toolLoadingReadingUsage: "로컬 사용량 로그 읽기",
      toolLoadingPreparingView: "화면 표시 정보 정리",
      awsManaged: "AWS profile 또는 SSO를 MoneySiren 밖에서 사용합니다.",
      awsCliTitle: "AWS 로컬 설정",
      awsCliInstalled: "AWS CLI 설치됨",
      awsCliMissing: "AWS CLI 없음",
      awsCliError: "AWS CLI 확인 실패",
      awsCliVersion: "버전",
      awsCredentialChain: "자격 증명 체인",
      awsCredentialConfigured: "자격 증명 체인 설정됨",
      awsCredentialMissing: "AWS_PROFILE 미설정",
      installAwsCli: "AWS CLI 설치",
      configureAwsSso: "SSO 프로필 설정",
      refreshAwsCliStatus: "다시 확인",
      awsCliCommandHint: "설치 후 새 터미널에서 aws configure sso, aws sso login --profile <profile>를 실행하고 MoneySiren용 AWS_PROFILE을 등록합니다.",
      awsProfileName: "AWS 프로필",
      registerAwsProfileGlobally: "사용자 env 저장",
      awsProfilePersistHint: "AWS_PROFILE을 Windows 사용자 환경변수로 저장합니다. 새 터미널은 이 값을 상속하고, 현재 MoneySiren 서버도 즉시 갱신됩니다.",
      awsProfilePersistSuccess: "AWS_PROFILE을 저장했습니다.",
      awsProfilePersistError: "AWS_PROFILE을 저장하지 못했습니다.",
      gcpManaged: "Google Cloud CLI와 Application Default Credentials는 MoneySiren 밖에서 설정합니다.",
      gcpCliTitle: "Google Cloud 로컬 설정",
      gcpCliInstalled: "gcloud 설치됨",
      gcpCliMissing: "gcloud 없음",
      gcpCliError: "gcloud 확인 실패",
      gcpAccount: "활성 계정",
      gcpProject: "프로젝트",
      gcpAdc: "Application Default Credentials",
      gcpConfigured: "설정됨",
      gcpMissing: "미설정",
      installGcloudCli: "gcloud 설치",
      configureGcloudAuth: "CLI 인증 설정",
      configureGcloudAdc: "ADC 설정",
      refreshGcpCliStatus: "다시 확인",
      gcpCliCommandHint: "CLI에는 gcloud auth login, 로컬 SDK 자격 증명에는 gcloud auth application-default login을 실행하고 프로젝트를 설정합니다.",
      localCliTitle: "로컬 CLI 사용량",
      localCliInstalled: "CLI 설치됨",
      localCliMissing: "CLI 없음",
      localCliCheckFailed: "CLI 확인 실패",
      localCliUsageSource: "사용량 소스",
      localCliLatestActivity: "최근 활동",
      localCliSessionsTurns: "세션 / 턴",
      localCliNoUsage: "로컬 사용량 로그를 찾지 못했습니다.",
      localCliStatusLine: "Statusline 사용량",
      localCliContextWindow: "컨텍스트 창",
      localCliFiveHourLimit: "5시간 사용량",
      localCliWeeklyLimit: "주간 사용량",
      localCliFiveHourWindow: "5시간",
      localCliWeeklyWindow: "1주",
      localCliRemaining: "남은 사용량",
      localCliResetAt: "초기화",
      localCliUsageResetCredits: "초기화권",
      localCliUsageResetCredit: "초기화권",
      localCliLearnMore: "자세히 알아보기",
      localCliDashboardTitle: "CLI 대시보드 항목",
      localCliDashboardSubtitle: "대시보드 테이블에 표시할 로컬 CLI 지표를 선택합니다.",
      localCliDashboardMetricSelection: "CLI 대시보드 지표 선택",
      saveDashboardDisplay: "대시보드 표시 저장",
      dashboardDisplayPrefsSaved: "대시보드 표시 설정이 로컬에 저장되었습니다.",
      dashboardDisplayPrefsSaveError: "대시보드 표시 설정을 저장하지 못했습니다.",
      dashboardDisplayPrefsLoadError: "대시보드 표시 설정을 불러오지 못했습니다.",
      dashboardWidgetsTitle: "대시보드 위젯",
      dashboardWidgetsSubtitle: "화면별 항목을 숨기고, 순서를 바꾸고, 크기를 조정합니다.",
      dashboardWidgetScreen: "대시보드 화면",
      dashboardWidgetSelection: "대시보드 위젯 레이아웃",
      dashboardWidgetSize: "크기",
      dashboardWidgetMoveUp: "위로 이동",
      dashboardWidgetMoveDown: "아래로 이동",
      dashboardWidgetCompact: "작게",
      dashboardWidgetNormal: "보통",
      dashboardWidgetWide: "넓게",
      dashboardWidgetFull: "전체",
      budgetTitle: "월 예산",
      budgetSubtitle: "예산 리스크에 사용할 로컬 월 예산을 설정합니다. 비워두면 예산 리스크를 계산하지 않습니다.",
      monthlyBudgetLimit: "월 예산 한도",
      budgetCurrency: "통화",
      budgetWarningPercent: "경고 기준",
      budgetCriticalPercent: "위험 기준",
      saveBudget: "예산 저장",
      budgetPrefsSaved: "예산 설정이 로컬에 저장되었습니다.",
      budgetPrefsSaveError: "예산 설정을 저장하지 못했습니다.",
      budgetPrefsLoadError: "예산 설정을 불러오지 못했습니다.",
      localCliLastRequest: "마지막 요청",
      localCliSessionTokens: "세션 토큰",
      localCliCurrentUsage: "현재 사용량",
      localCliReasoning: "Reasoning",
      localCliLogFiles: "로그 파일",
      refreshLocalCliStatus: "사용량 확인",
      defaultLocale: "기본 언어",
      dashboardTimezone: "대시보드 시간대",
      defaultStart: "기본 시작 화면",
      currencyDisplay: "통화 표시",
      refreshTtl: "새로고침 TTL",
      density: "밀도",
      telemetry: "텔레메트리",
      off: "꺼짐",
    },
    notificationWidgets: {
      month_forecast: "이번 달 예상",
      today_live_cost: "오늘 실시간 비용",
      risk_high_count: "높은 리스크 수",
      stale_connection_count: "오래된 연결",
      aws_month_forecast: "AWS 이번 달 예상",
      openai_today_cost: "OpenAI 오늘 비용",
      openai_today_tokens: "OpenAI 오늘 토큰",
      claude_five_hour_percent: "Claude 5시간 사용률",
      claude_weekly_percent: "Claude 주간 사용률",
      codex_five_hour_percent: "Codex 5시간 사용률",
      codex_weekly_percent: "Codex 주간 사용률",
      codex_reset_credit_count: "Codex 초기화권",
      codex_reset_credit_expiry: "Codex 초기화권 만료일",
      supabase_usage_health: "Supabase 사용량 상태",
      cloudflare_month_to_date: "Cloudflare 월 누적",
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
      noProviders: "아직 저장된 서비스가 없습니다. 연결 메뉴에서 서비스를 추가하세요.",
      noRisks: "로컬 데이터에서 리스크가 발견되지 않았습니다.",
    },
  },
  ja: {
    app: {
      title: "MoneySiren",
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
      overview: "ダッシュボード",
      today: "今日のライブ",
      forecast: "予測",
      risks: "リスク",
      allServices: "全サービス",
      connections: "接続",
      notifications: "通知",
      preferences: "環境設定",
      providers: "プロバイダーカタログ",
    },
    dashboard: {
      overviewTitle: "ダッシュボード",
      overviewSubtitle: "月次予測を中心に、今日の値は暫定データとして分離します。",
      monthForecast: "月次予測",
      monthlyBudget: "月次予算",
      budgetUsage: "予算使用率",
      budgetNotSet: "予算未設定",
      budgetRisk: "予算リスク",
      confirmedCoverage: "確定率",
      confirmedThroughYesterday: "昨日まで確定",
      todayLive: "今日のライブ",
      providersNeedingAttention: "確認が必要なサービス",
      dailyUsageTrend: "日別使用量推移",
      dailyUsageTrendNote: "収集日基準の合計",
      noDailyUsageTrend: "日別使用量スナップショットはまだありません",
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
      groupBy: "表示単位",
      groupByService: "サービス",
      groupByConnection: "接続",
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
      serviceCostBreakdown: "サービス別コスト詳細",
      serviceCostBreakdownNote: "最新の確定 sync から取得した AWS Cost Explorer のサービス別コストです。",
      serviceCostShare: "比率",
      serviceMetric: "メトリック",
      noServiceCosts: "サービス別コスト行はまだありません。",
      usage: "利用量",
      healthRisk: "ヘルスとリスク",
      dataConfidence: "データ信頼度",
      securityPermissions: "セキュリティと権限",
      emergencyActions: "緊急操作",
      emergencyPlanned: "計画中の機能です。このビルドでは write action は実行できません。",
      viewRequirements: "要件を見る",
      readOnly: "読み取り専用",
      currentUsage: "現在の使用量",
      currentPeriod: "現在の期間",
      topServices: "上位サービス",
      inputTokens: "入力トークン",
      outputTokens: "出力トークン",
      cacheTokens: "キャッシュトークン",
      modelRequests: "モデルリクエスト",
      sessions: "セッション",
      turns: "ターン",
      toolCalls: "ツール呼び出し",
      logFiles: "ログファイル",
      contextTokens: "コンテキストトークン",
      contextPercent: "コンテキスト使用率",
      fiveHourLimit: "5時間使用量",
      weeklyLimit: "週間使用量",
      fiveHourTokens: "5時間トークン",
      weeklyTokens: "週間トークン",
      fiveHourRemainingTokens: "5時間残りトークン",
      weeklyRemainingTokens: "週間残りトークン",
      usageResetCredits: "リセット権",
      usageResetCredit: "リセット権",
      usageResetCreditEstimate: "リセット権の推定期限",
      lastRequestTokens: "直近リクエスト",
      totalTokens: "合計トークン",
      reasoningTokens: "Reasoning トークン",
      noCurrentUsage: "現在の使用量なし",
      localCliUsageNote: "statusline とローカルセッションログに基づく CLI トークン使用量です。",
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
      notificationsTitle: "通知",
      notificationsSubtitle: "ローカル digest、ウィジェット、desktop notifier に表示する条件を選びます。",
      notificationsMaster: "通知",
      notificationsMasterHelp: "ローカル digest と desktop 通知の環境設定だけを制御します。",
      notificationEnabled: "オン",
      notificationDisabled: "オフ",
      digestEnabled: "Digest",
      digestHelp: "選択したウィジェットは下の順序で digest に表示されます。",
      digestInterval: "Digest 間隔",
      digestEverySixHours: "6時間ごと",
      digestDaily: "毎日",
      digestWeekly: "毎週",
      quietHours: "静音時間",
      quietHoursHelp: "このローカル時間帯は通知を静かにします。",
      quietHoursStart: "開始",
      quietHoursEnd: "終了",
      widgetsTitle: "Digest ウィジェット",
      widgetsSubtitle: "選択したウィジェットだけをローカル digest preview に含めます。",
      widgetSelection: "ウィジェット選択",
      widgetOrder: "順序",
      thresholdsTitle: "Threshold ルール",
      thresholdsSubtitle: "Threshold 行はローカルに保存され、デスクトップ通知側で評価されます。",
      thresholdWidget: "ウィジェット",
      thresholdOperator: "演算子",
      thresholdValue: "値",
      thresholdCooldown: "クールダウン",
      desktopStatusTitle: "Desktop app",
      desktopStatus: "状態",
      desktopNotConnected: "未接続",
      desktopAppInfo: "Tray/HUD app はこのローカル設定と整形済み digest だけを読みます。provider secret は受け取りません。",
      hudSettingsTitle: "HUD 表示",
      hudSettingsSubtitle: "常時表示しやすい小さな HUD に調整します。",
      hudAlwaysOnTop: "常に手前に表示",
      hudBackgroundColor: "背景色",
      hudFontColor: "フォント色",
      hudFontSize: "フォントサイズ",
      hudOpacity: "透明度",
      hudPadding: "余白",
      hudRowHeight: "行の高さ",
      hudShowRemainingPercent: "残量を表示",
      hudShowUsagePercent: "使用量を表示",
      hudMinimize: "HUD を最小化",
      hudClose: "HUD を閉じる",
      hudSaveSettings: "HUD を保存",
      hudWidgetsTitle: "HUD 表示項目",
      hudWidgetsSubtitle: "浮かせた HUD に表示する項目を選びます。",
      hudOpenWindow: "HUD ウィンドウを開く",
      testNotification: "テスト通知",
      testNotificationSent: "Preview 生成済み",
      notificationLocalOnly: "ローカルプレビュー専用です。webhook や provider 呼び出しは送信せず、インストール済み desktop app が同じ digest を読めます。",
      notificationPreview: "Preview",
      saveNotifications: "通知を保存",
      notificationPrefsSaved: "通知設定をローカルに保存しました。",
      notificationPrefsSaveError: "通知設定を保存できませんでした。",
      notificationPrefsLoadError: "通知設定を読み込めませんでした。",
      notificationStoredLocally: "設定は MoneySiren のローカルファイルに保存されます。",
      preferencesTitle: "環境設定",
      preferencesSubtitle: "ローカル表示設定のみを管理します。",
      authMethod: "認証方式",
      credentialSource: "認証情報ソース",
      readOnlyTest: "読み取り専用テスト",
      emergencyAccess: "緊急権限",
      requiredEnv: "必須 env",
      requiredValueLinks: "必要な値のリンク",
      setupLinks: "設定リンク",
      actions: "操作",
      savedConnections: "保存済み接続",
      connectionLabel: "接続名",
      connectionId: "接続 ID",
      credentialSecret: "認証情報",
      accountIds: "アカウント ID",
      openAiAdminKeyHint: "組織の使用量とコストを読める OpenAI Admin API key が必要です。",
      envOnlySecrets: "MoneySiren v0.1 は環境変数のみを使用します。新しい API key と OAuth token はローカルに保存しません。",
      credentialSaveError: "認証情報は保存されませんでした。",
      credentialDeleteError: "認証情報は削除されませんでした。",
      saveCredential: "保存",
      removeCredential: "ローカルから外す",
      startOAuth: "OAuth",
      toolLoadingTitle: "ローカルツール確認中",
      toolLoadingCheckingCli: "CLI インストール状態を確認",
      toolLoadingCheckingCredentials: "ローカルプロファイルと認証情報を確認",
      toolLoadingReadingUsage: "ローカル使用量ログを読み込み",
      toolLoadingPreparingView: "表示情報を準備",
      awsManaged: "AWS profile または SSO を MoneySiren の外で使用します。",
      awsCliTitle: "AWS ローカル設定",
      awsCliInstalled: "AWS CLI インストール済み",
      awsCliMissing: "AWS CLI なし",
      awsCliError: "AWS CLI 確認失敗",
      awsCliVersion: "バージョン",
      awsCredentialChain: "認証チェーン",
      awsCredentialConfigured: "認証チェーン設定済み",
      awsCredentialMissing: "AWS_PROFILE 未設定",
      installAwsCli: "AWS CLI をインストール",
      configureAwsSso: "SSO プロファイル設定",
      refreshAwsCliStatus: "再確認",
      awsCliCommandHint: "インストール後、新しいターミナルで aws configure sso、aws sso login --profile <profile> を実行し、MoneySiren 用の AWS_PROFILE を登録します。",
      awsProfileName: "AWS プロファイル",
      registerAwsProfileGlobally: "ユーザー env に保存",
      awsProfilePersistHint: "AWS_PROFILE を Windows ユーザー環境変数に保存します。新しいターミナルに継承され、現在の MoneySiren サーバーもすぐに更新されます。",
      awsProfilePersistSuccess: "AWS_PROFILE を保存しました。",
      awsProfilePersistError: "AWS_PROFILE を保存できませんでした。",
      gcpManaged: "Google Cloud CLI と Application Default Credentials は MoneySiren の外で設定します。",
      gcpCliTitle: "Google Cloud ローカル設定",
      gcpCliInstalled: "gcloud インストール済み",
      gcpCliMissing: "gcloud なし",
      gcpCliError: "gcloud 確認失敗",
      gcpAccount: "有効なアカウント",
      gcpProject: "プロジェクト",
      gcpAdc: "Application Default Credentials",
      gcpConfigured: "設定済み",
      gcpMissing: "未設定",
      installGcloudCli: "gcloud をインストール",
      configureGcloudAuth: "CLI 認証設定",
      configureGcloudAdc: "ADC 設定",
      refreshGcpCliStatus: "再確認",
      gcpCliCommandHint: "CLI には gcloud auth login、ローカル SDK 認証には gcloud auth application-default login を実行し、プロジェクトを設定します。",
      localCliTitle: "ローカル CLI 使用量",
      localCliInstalled: "CLI インストール済み",
      localCliMissing: "CLI なし",
      localCliCheckFailed: "CLI 確認失敗",
      localCliUsageSource: "使用量ソース",
      localCliLatestActivity: "最新アクティビティ",
      localCliSessionsTurns: "セッション / ターン",
      localCliNoUsage: "ローカル使用量ログが見つかりません。",
      localCliStatusLine: "Statusline 使用量",
      localCliContextWindow: "コンテキスト枠",
      localCliFiveHourLimit: "5時間使用量",
      localCliWeeklyLimit: "週間使用量",
      localCliFiveHourWindow: "5時間",
      localCliWeeklyWindow: "1週間",
      localCliRemaining: "残り使用量",
      localCliResetAt: "リセット",
      localCliUsageResetCredits: "リセット権",
      localCliUsageResetCredit: "リセット権",
      localCliLearnMore: "詳しく見る",
      localCliDashboardTitle: "CLI ダッシュボード項目",
      localCliDashboardSubtitle: "ダッシュボード表に表示するローカル CLI 指標を選択します。",
      localCliDashboardMetricSelection: "CLI ダッシュボード指標選択",
      saveDashboardDisplay: "表示設定を保存",
      dashboardDisplayPrefsSaved: "ダッシュボード表示設定をローカルに保存しました。",
      dashboardDisplayPrefsSaveError: "ダッシュボード表示設定を保存できませんでした。",
      dashboardDisplayPrefsLoadError: "ダッシュボード表示設定を読み込めませんでした。",
      dashboardWidgetsTitle: "ダッシュボードウィジェット",
      dashboardWidgetsSubtitle: "画面ごとに項目の非表示、並べ替え、サイズ変更を行います。",
      dashboardWidgetScreen: "ダッシュボード画面",
      dashboardWidgetSelection: "ダッシュボードウィジェット配置",
      dashboardWidgetSize: "サイズ",
      dashboardWidgetMoveUp: "上へ移動",
      dashboardWidgetMoveDown: "下へ移動",
      dashboardWidgetCompact: "小",
      dashboardWidgetNormal: "標準",
      dashboardWidgetWide: "広い",
      dashboardWidgetFull: "全幅",
      budgetTitle: "月次予算",
      budgetSubtitle: "予算リスクに使うローカル月次予算を設定します。空欄なら予算リスクを計算しません。",
      monthlyBudgetLimit: "月次予算上限",
      budgetCurrency: "通貨",
      budgetWarningPercent: "警告しきい値",
      budgetCriticalPercent: "危険しきい値",
      saveBudget: "予算を保存",
      budgetPrefsSaved: "予算設定をローカルに保存しました。",
      budgetPrefsSaveError: "予算設定を保存できませんでした。",
      budgetPrefsLoadError: "予算設定を読み込めませんでした。",
      localCliLastRequest: "直近リクエスト",
      localCliSessionTokens: "セッショントークン",
      localCliCurrentUsage: "現在の使用量",
      localCliReasoning: "Reasoning",
      localCliLogFiles: "ログファイル",
      refreshLocalCliStatus: "使用量を確認",
      defaultLocale: "既定の言語",
      dashboardTimezone: "ダッシュボードタイムゾーン",
      defaultStart: "既定の開始画面",
      currencyDisplay: "通貨表示",
      refreshTtl: "更新 TTL",
      density: "密度",
      telemetry: "テレメトリー",
      off: "オフ",
    },
    notificationWidgets: {
      month_forecast: "月次予測",
      today_live_cost: "今日のライブコスト",
      risk_high_count: "高リスク数",
      stale_connection_count: "古い接続",
      aws_month_forecast: "AWS 月次予測",
      openai_today_cost: "OpenAI 今日のコスト",
      openai_today_tokens: "OpenAI 今日のトークン",
      claude_five_hour_percent: "Claude 5時間使用率",
      claude_weekly_percent: "Claude 週間使用率",
      codex_five_hour_percent: "Codex 5時間使用率",
      codex_weekly_percent: "Codex 週間使用率",
      codex_reset_credit_count: "Codex リセット権",
      codex_reset_credit_expiry: "Codex リセット権の期限",
      supabase_usage_health: "Supabase 利用ヘルス",
      cloudflare_month_to_date: "Cloudflare 月初来",
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
      noProviders: "保存済みサービスはまだありません。接続メニューから追加してください。",
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
