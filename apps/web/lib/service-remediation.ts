export type ServiceRemediationSeverity = "info" | "warning" | "critical";
export type ServiceRemediationLocale = "en" | "ko" | "ja";

export interface ServiceRemediationInput {
  providerKey: string;
  displayName: string;
  connectionState: string;
  readOnlyTestState: string;
  missingEnvKeys: readonly string[];
  requiredEnvKeys: readonly string[];
  canonicalFreshness: string;
  liveFreshness: string;
  liveGranularity: string;
  liveConfidence: string;
  currentUsageSummary: unknown | null;
  latestCanonicalSync: string | null;
  latestLiveCheck: string | null;
  todayLiveAmountMinor: number | null;
  todayLiveIncluded: boolean;
  healthStatus: string;
  riskLevel: string;
  setupLinks: readonly { label: string; href: string }[];
}

export interface ServiceRemediationItem {
  code: string;
  severity: ServiceRemediationSeverity;
  title: string;
  cause: string;
  actions: readonly string[];
}

export interface ServiceRemediation {
  heading: string;
  noActionLabel: string;
  tableHeader: string;
  items: readonly ServiceRemediationItem[];
}

interface Labels {
  heading: string;
  noAction: string;
  tableHeader: string;
  checkDetail: string;
  openSettings: string;
  setRequiredEnv: (keys: string) => string;
  openSetup: (label: string) => string;
  runSync: (providerKey: string) => string;
  refreshLive: string;
  retryLater: string;
  contactProviderStatus: string;
}

const LABELS: Record<ServiceRemediationLocale, Labels> = {
  en: {
    heading: "Lookup issue and actions",
    noAction: "No action needed",
    tableHeader: "Action",
    checkDetail: "Open the service detail page and compare connection, live, and canonical freshness.",
    openSettings: "Open Connections and verify the local credential or environment setup.",
    setRequiredEnv: (keys) => `Set required environment values: ${keys}.`,
    openSetup: (label) => `Open the setup link: ${label}.`,
    runSync: (providerKey) => `Run moneysiren sync --provider ${providerKey} after credentials are fixed.`,
    refreshLive: "Use Refresh live data after changing credentials or local CLI login state.",
    retryLater: "Retry after a few minutes if the provider API is temporarily unavailable.",
    contactProviderStatus: "Check the provider status page when health is degraded or down.",
  },
  ko: {
    heading: "\uc870\ud68c \uc624\ub958 \ubc0f \uc870\uce58 \uc548\ub0b4",
    noAction: "\uc870\uce58 \ud544\uc694 \uc5c6\uc74c",
    tableHeader: "\uc870\uce58",
    checkDetail: "\uc11c\ube44\uc2a4 \uc0c1\uc138 \ud654\uba74\uc5d0\uc11c \uc5f0\uacb0, \uc2e4\uc2dc\uac04, \ud655\uc815 \ub370\uc774\ud130 \uc0c1\ud0dc\ub97c \ud568\uaed8 \ud655\uc778\ud558\uc138\uc694.",
    openSettings: "\uc5f0\uacb0 \uc124\uc815\uc5d0\uc11c \ub85c\uceec \uc790\uaca9 \uc99d\uba85 \ub610\ub294 \ud658\uacbd\ubcc0\uc218 \uc124\uc815\uc744 \ud655\uc778\ud558\uc138\uc694.",
    setRequiredEnv: (keys) => `\ud544\uc218 \ud658\uacbd\ubcc0\uc218\ub97c \uc124\uc815\ud558\uc138\uc694: ${keys}.`,
    openSetup: (label) => `\uc124\uc815 \ub9c1\ud06c\ub97c \uc5f4\uc5b4 \ud655\uc778\ud558\uc138\uc694: ${label}.`,
    runSync: (providerKey) => `\uc790\uaca9 \uc99d\uba85 \uc218\uc815 \ud6c4 moneysiren sync --provider ${providerKey}\ub97c \uc2e4\ud589\ud558\uc138\uc694.`,
    refreshLive: "\uc790\uaca9 \uc99d\uba85\uc774\ub098 \ub85c\uceec CLI \ub85c\uadf8\uc778 \uc0c1\ud0dc\ub97c \ubc14\uafbc \ud6c4 \uc2e4\uc2dc\uac04 \ub370\uc774\ud130 \uc0c8\ub85c\uace0\uce68\uc744 \uc2e4\ud589\ud558\uc138\uc694.",
    retryLater: "\uc81c\uacf5\uc0ac API \uc77c\uc2dc \uc624\ub958 \uac00\ub2a5\uc131\uc774 \uc788\uc73c\uba74 \uba87 \ubd84 \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uc138\uc694.",
    contactProviderStatus: "\ud5ec\uc2a4\uac00 \uc800\ud558\ub418\uac70\ub098 \uc911\ub2e8\ub41c \uacbd\uc6b0 \uc81c\uacf5\uc0ac \uc0c1\ud0dc \ud398\uc774\uc9c0\ub97c \ud655\uc778\ud558\uc138\uc694.",
  },
  ja: {
    heading: "Lookup issue and actions",
    noAction: "No action needed",
    tableHeader: "Action",
    checkDetail: "Open the service detail page and compare connection, live, and canonical freshness.",
    openSettings: "Open Connections and verify the local credential or environment setup.",
    setRequiredEnv: (keys) => `Set required environment values: ${keys}.`,
    openSetup: (label) => `Open the setup link: ${label}.`,
    runSync: (providerKey) => `Run moneysiren sync --provider ${providerKey} after credentials are fixed.`,
    refreshLive: "Use Refresh live data after changing credentials or local CLI login state.",
    retryLater: "Retry after a few minutes if the provider API is temporarily unavailable.",
    contactProviderStatus: "Check the provider status page when health is degraded or down.",
  },
};

export function buildServiceRemediation(
  service: ServiceRemediationInput,
  locale: ServiceRemediationLocale,
): ServiceRemediation {
  const labels = LABELS[locale] ?? LABELS.en;
  const items = dedupeItems([
    ...connectionItems(service, locale, labels),
    ...canonicalItems(service, locale, labels),
    ...liveItems(service, locale, labels),
    ...healthItems(service, locale, labels),
    ...usageItems(service, locale, labels),
    ...riskItems(service, locale, labels),
  ]).sort(compareItems);

  return {
    heading: labels.heading,
    noActionLabel: labels.noAction,
    tableHeader: labels.tableHeader,
    items,
  };
}

export function serviceRemediationTableHeader(locale: ServiceRemediationLocale): string {
  return LABELS[locale]?.tableHeader ?? LABELS.en.tableHeader;
}

export function serviceRemediationSummary(
  service: ServiceRemediationInput,
  locale: ServiceRemediationLocale,
): string {
  const remediation = buildServiceRemediation(service, locale);
  const first = remediation.items[0];

  if (first === undefined) {
    return remediation.noActionLabel;
  }

  return `${first.title}: ${first.actions[0] ?? first.cause}`;
}

export function hasServiceRemediation(service: ServiceRemediationInput, locale: ServiceRemediationLocale): boolean {
  return buildServiceRemediation(service, locale).items.length > 0;
}

function connectionItems(
  service: ServiceRemediationInput,
  locale: ServiceRemediationLocale,
  labels: Labels,
): ServiceRemediationItem[] {
  if (service.connectionState === "not_configured") {
    return [item({
      code: "connection_not_configured",
      severity: "warning",
      title: text(locale, "Credentials are not configured", "\uc790\uaca9 \uc99d\uba85 \ubbf8\uc124\uc815"),
      cause: text(locale, "The service has no readable env value or local credential.", "\uc77d\uc744 \uc218 \uc788\ub294 env \uac12\uc774\ub098 \ub85c\uceec \uc790\uaca9 \uc99d\uba85\uc774 \uc5c6\uc2b5\ub2c8\ub2e4."),
      actions: standardActions(service, labels, {
        includeRequiredEnv: true,
        includeSetup: true,
        includeSettings: true,
      }),
    })];
  }

  if (service.connectionState === "locked") {
    return [item({
      code: "credential_store_locked",
      severity: "critical",
      title: text(locale, "Credential store is locked", "\uc790\uaca9 \uc99d\uba85 \uc800\uc7a5\uc18c \uc7a0\uae40"),
      cause: text(locale, "MoneySiren cannot read the local credential store.", "\ub85c\uceec \uc790\uaca9 \uc99d\uba85 \uc800\uc7a5\uc18c\ub97c \uc77d\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4."),
      actions: [
        labels.openSettings,
        text(locale, "Unlock or reinitialize the OS credential store, then refresh live data.", "OS \uc790\uaca9 \uc99d\uba85 \uc800\uc7a5\uc18c\ub97c \uc7a0\uae08 \ud574\uc81c\ud558\uac70\ub098 \ub2e4\uc2dc \uc124\uc815\ud55c \ub4a4 \uc2e4\uc2dc\uac04 \ub370\uc774\ud130\ub97c \uc0c8\ub85c\uace0\uce68\ud558\uc138\uc694."),
      ],
    })];
  }

  if (service.connectionState === "expired" || service.connectionState === "invalid") {
    return [item({
      code: `credential_${service.connectionState}`,
      severity: "critical",
      title: text(locale, "Credential is invalid or expired", "\uc790\uaca9 \uc99d\uba85 \ubb34\ud6a8 \ub610\ub294 \ub9cc\ub8cc"),
      cause: text(locale, "The provider rejected the configured credential state.", "\uc81c\uacf5\uc0ac\uac00 \uc124\uc815\ub41c \uc790\uaca9 \uc99d\uba85 \uc0c1\ud0dc\ub97c \uac70\ubd80\ud588\uc2b5\ub2c8\ub2e4."),
      actions: standardActions(service, labels, {
        includeRequiredEnv: true,
        includeSetup: true,
        includeSettings: true,
      }),
    })];
  }

  if (
    service.readOnlyTestState !== "read_only_ready" &&
    service.readOnlyTestState !== "env_configured" &&
    service.readOnlyTestState !== "credential_store_configured" &&
    service.readOnlyTestState !== "oauth_connected"
  ) {
    return [item({
      code: "read_only_validation_not_ready",
      severity: "warning",
      title: text(locale, "Read-only validation is not ready", "\uc77d\uae30 \uc804\uc6a9 \uac80\uc99d \ubbf8\uc900\ube44"),
      cause: text(locale, "The service is connected, but MoneySiren has not confirmed a read-only data read.", "\uc11c\ube44\uc2a4\ub294 \uc5f0\uacb0\ub418\uc5c8\uc9c0\ub9cc MoneySiren\uc774 \uc77d\uae30 \uc804\uc6a9 \ub370\uc774\ud130 \uc870\ud68c\ub97c \ud655\uc778\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4."),
      actions: [
        labels.refreshLive,
        labels.runSync(service.providerKey),
        ...providerHints(service.providerKey, locale),
      ],
    })];
  }

  return [];
}

function canonicalItems(
  service: ServiceRemediationInput,
  locale: ServiceRemediationLocale,
  labels: Labels,
): ServiceRemediationItem[] {
  if (service.canonicalFreshness === "missing") {
    return [item({
      code: "canonical_missing",
      severity: "warning",
      title: text(locale, "Canonical sync data is missing", "\ud655\uc815 \uc218\uc9d1 \ub370\uc774\ud130 \uc5c6\uc74c"),
      cause: text(locale, "No persisted sync result exists for this service.", "\uc774 \uc11c\ube44\uc2a4\uc758 \uc800\uc7a5\ub41c sync \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4."),
      actions: [
        labels.runSync(service.providerKey),
        ...providerHints(service.providerKey, locale),
      ],
    })];
  }

  if (service.canonicalFreshness === "stale") {
    return [item({
      code: "canonical_stale",
      severity: "warning",
      title: text(locale, "Canonical sync data is stale", "\ud655\uc815 \uc218\uc9d1 \ub370\uc774\ud130 \uc624\ub798\ub428"),
      cause: text(locale, "The latest persisted provider data is older than the expected dashboard window.", "\ucd5c\uadfc \uc800\uc7a5\ub41c \uc81c\uacf5\uc0ac \ub370\uc774\ud130\uac00 \ub300\uc2dc\ubcf4\ub4dc \uae30\uc900 \uc2dc\uac04\ubcf4\ub2e4 \uc624\ub798\ub418\uc5c8\uc2b5\ub2c8\ub2e4."),
      actions: [
        labels.runSync(service.providerKey),
        labels.retryLater,
      ],
    })];
  }

  return [];
}

function liveItems(
  service: ServiceRemediationInput,
  locale: ServiceRemediationLocale,
  labels: Labels,
): ServiceRemediationItem[] {
  if (service.liveFreshness === "live") {
    return [];
  }

  if (service.liveFreshness === "not_configured") {
    return [item({
      code: "live_not_configured",
      severity: "warning",
      title: text(locale, "Live lookup is not configured", "\uc2e4\uc2dc\uac04 \uc870\ud68c \ubbf8\uc124\uc815"),
      cause: text(locale, "The service cannot run a live lookup until required credentials are available.", "\ud544\uc218 \uc790\uaca9 \uc99d\uba85\uc774 \uc900\ube44\ub418\uae30 \uc804\uae4c\uc9c0 \uc2e4\uc2dc\uac04 \uc870\ud68c\ub97c \uc2e4\ud589\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4."),
      actions: standardActions(service, labels, {
        includeRequiredEnv: true,
        includeSetup: true,
        includeSettings: true,
      }),
    })];
  }

  if (service.liveFreshness === "locked") {
    return [item({
      code: "live_locked",
      severity: "critical",
      title: text(locale, "Live lookup is locked", "\uc2e4\uc2dc\uac04 \uc870\ud68c \uc7a0\uae40"),
      cause: text(locale, "The local credential store cannot provide credentials for the live read.", "\ub85c\uceec \uc790\uaca9 \uc99d\uba85 \uc800\uc7a5\uc18c\uac00 \uc2e4\uc2dc\uac04 \uc77d\uae30\uc5d0 \ud544\uc694\ud55c \uc790\uaca9 \uc99d\uba85\uc744 \uc81c\uacf5\ud558\uc9c0 \ubabb\ud569\ub2c8\ub2e4."),
      actions: [
        labels.openSettings,
        labels.refreshLive,
      ],
    })];
  }

  if (service.liveFreshness === "unavailable") {
    return [item({
      code: "live_unavailable",
      severity: "info",
      title: text(locale, "Live lookup is unavailable", "\uc2e4\uc2dc\uac04 \uc870\ud68c \uc9c0\uc6d0 \uc5c6\uc74c"),
      cause: text(locale, "This provider does not expose a reliable current-day cost or usage surface in this build.", "\uc774 \ube4c\ub4dc\uc5d0\uc11c \ud574\ub2f9 \uc81c\uacf5\uc0ac\ub294 \uc2e0\ub8b0\ud560 \uc218 \uc788\ub294 \uc624\ub298 \ube44\uc6a9 \ub610\ub294 \uc0ac\uc6a9\ub7c9 \ud45c\uba74\uc744 \uc81c\uacf5\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."),
      actions: [
        labels.checkDetail,
        labels.openSetup(service.setupLinks[0]?.label ?? service.displayName),
      ],
    })];
  }

  if (service.liveFreshness === "error") {
    return [item({
      code: "live_error",
      severity: "critical",
      title: text(locale, "Live lookup failed", "\uc2e4\uc2dc\uac04 \uc870\ud68c \uc2e4\ud328"),
      cause: text(locale, "The provider read failed after credentials were selected.", "\uc790\uaca9 \uc99d\uba85 \uc120\ud0dd \ud6c4 \uc81c\uacf5\uc0ac \uc77d\uae30\uac00 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4."),
      actions: [
        labels.refreshLive,
        labels.retryLater,
        ...providerHints(service.providerKey, locale),
      ],
    })];
  }

  return [item({
    code: "live_stale",
    severity: "warning",
    title: text(locale, "Live lookup is stale", "\uc2e4\uc2dc\uac04 \uc870\ud68c \uac12 \uc624\ub798\ub428"),
    cause: text(locale, "The live value is missing, cached, or no longer fresh.", "\uc2e4\uc2dc\uac04 \uac12\uc774 \uc5c6\uac70\ub098 \uce90\uc2dc\ub418\uc5c8\uace0, \ub354 \uc774\uc0c1 \ucd5c\uc2e0 \uc0c1\ud0dc\uac00 \uc544\ub2d9\ub2c8\ub2e4."),
    actions: [
      labels.refreshLive,
      labels.retryLater,
    ],
  })];
}

function healthItems(
  service: ServiceRemediationInput,
  locale: ServiceRemediationLocale,
  labels: Labels,
): ServiceRemediationItem[] {
  if (service.healthStatus === "ok") {
    return [];
  }

  if (service.healthStatus === "down") {
    return [item({
      code: "health_down",
      severity: "critical",
      title: text(locale, "Provider health is down", "\uc81c\uacf5\uc0ac \ud5ec\uc2a4 \uc911\ub2e8"),
      cause: text(locale, "The latest health snapshot reports the service as down.", "\ucd5c\uadfc \ud5ec\uc2a4 \uc2a4\ub0c5\uc0f7\uc774 \uc11c\ube44\uc2a4 \uc911\ub2e8\uc744 \ubcf4\uace0\ud588\uc2b5\ub2c8\ub2e4."),
      actions: [
        labels.contactProviderStatus,
        labels.runSync(service.providerKey),
      ],
    })];
  }

  if (service.healthStatus === "degraded") {
    return [item({
      code: "health_degraded",
      severity: "warning",
      title: text(locale, "Provider health is degraded", "\uc81c\uacf5\uc0ac \ud5ec\uc2a4 \uc800\ud558"),
      cause: text(locale, "The provider is reachable but reported degraded health.", "\uc81c\uacf5\uc0ac\uc5d0 \uc811\uadfc\uc740 \uac00\ub2a5\ud558\uc9c0\ub9cc \ud5ec\uc2a4 \uc800\ud558\uac00 \ubcf4\uace0\ub418\uc5c8\uc2b5\ub2c8\ub2e4."),
      actions: [
        labels.contactProviderStatus,
        labels.retryLater,
      ],
    })];
  }

  return [item({
    code: "health_unknown",
    severity: "warning",
    title: text(locale, "Provider health is unknown", "\uc81c\uacf5\uc0ac \ud5ec\uc2a4 \ud655\uc778 \ubd88\uac00"),
    cause: text(locale, "MoneySiren has no recent health signal for this service.", "\uc774 \uc11c\ube44\uc2a4\uc758 \ucd5c\uadfc \ud5ec\uc2a4 \uc2e0\ud638\uac00 \uc5c6\uc2b5\ub2c8\ub2e4."),
    actions: [
      labels.runSync(service.providerKey),
      labels.refreshLive,
    ],
  })];
}

function usageItems(
  service: ServiceRemediationInput,
  locale: ServiceRemediationLocale,
  labels: Labels,
): ServiceRemediationItem[] {
  if (service.liveGranularity !== "usage_only" || service.currentUsageSummary !== null) {
    return [];
  }

  return [item({
    code: "usage_missing",
    severity: "warning",
    title: text(locale, "Usage data is missing", "\uc0ac\uc6a9\ub7c9 \ub370\uc774\ud130 \uc5c6\uc74c"),
    cause: text(locale, "This service exposes usage rather than cost, but no local usage records were parsed.", "\uc774 \uc11c\ube44\uc2a4\ub294 \ube44\uc6a9\ubcf4\ub2e4 \uc0ac\uc6a9\ub7c9\uc744 \ud45c\uc2dc\ud558\uc9c0\ub9cc \ub85c\uceec \uc0ac\uc6a9\ub7c9 \ub85c\uadf8\ub97c \ud30c\uc2f1\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4."),
    actions: [
      ...providerHints(service.providerKey, locale),
      labels.refreshLive,
    ],
  })];
}

function riskItems(
  service: ServiceRemediationInput,
  locale: ServiceRemediationLocale,
  labels: Labels,
): ServiceRemediationItem[] {
  if (service.riskLevel === "low") {
    return [];
  }

  return [item({
    code: `risk_${service.riskLevel}`,
    severity: service.riskLevel === "critical" ? "critical" : "warning",
    title: text(locale, "Risk threshold needs review", "\ub9ac\uc2a4\ud06c \uae30\uc900 \ud655\uc778 \ud544\uc694"),
    cause: text(locale, "Budget, stale data, health, or provider alerts pushed this service into an attention state.", "\uc608\uc0b0, \uc624\ub798\ub41c \ub370\uc774\ud130, \ud5ec\uc2a4, \uc81c\uacf5\uc0ac \uacbd\uace0 \uc911 \ud558\ub098\uac00 \uc774 \uc11c\ube44\uc2a4\ub97c \ud655\uc778 \ud544\uc694 \uc0c1\ud0dc\ub85c \ub9cc\ub4e4\uc5c8\uc2b5\ub2c8\ub2e4."),
    actions: [
      labels.checkDetail,
      labels.runSync(service.providerKey),
    ],
  })];
}

function standardActions(
  service: ServiceRemediationInput,
  labels: Labels,
  options: {
    includeRequiredEnv: boolean;
    includeSetup: boolean;
    includeSettings: boolean;
  },
): string[] {
  const actions = [
    options.includeSettings ? labels.openSettings : null,
    options.includeRequiredEnv && service.missingEnvKeys.length > 0
      ? labels.setRequiredEnv(service.missingEnvKeys.join(", "))
      : null,
    options.includeSetup && service.setupLinks[0] !== undefined
      ? labels.openSetup(service.setupLinks[0].label)
      : null,
    ...providerHints(service.providerKey, localeFromLabels(labels)),
  ].filter((action): action is string => action !== null);

  return actions.length === 0 ? [labels.checkDetail] : actions;
}

function providerHints(providerKey: string, locale: ServiceRemediationLocale): string[] {
  const isKo = locale === "ko";

  if (providerKey === "aws") {
    return isKo
      ? [
          "aws sso login --profile <profile>\uc744 \uc2e4\ud589\ud558\uace0 AWS_PROFILE\uc774 \uac19\uc740 \ud130\ubbf8\ub110/\uc11c\ubc84 \ud504\ub85c\uc138\uc2a4\uc5d0 \uc124\uc815\ub410\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
          "Cost Explorer \uad8c\ud55c ce:GetCostAndUsage, ce:GetCostForecast\uac00 \uc788\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
        ]
      : [
          "Run aws sso login --profile <profile> and confirm AWS_PROFILE is visible to the MoneySiren process.",
          "Confirm Cost Explorer permissions: ce:GetCostAndUsage and ce:GetCostForecast.",
        ];
  }

  if (providerKey === "openai") {
    return isKo
      ? [
          "OPENAI_ADMIN_KEY\uac00 \uc870\uc9c1 Admin API key\uc778\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
          "Usage/Costs API\ub97c \uc77d\uc744 \uc218 \uc788\ub294 \uc870\uc9c1 \uad8c\ud55c\uc73c\ub85c \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uc138\uc694.",
        ]
      : [
          "Confirm OPENAI_ADMIN_KEY is an organization Admin API key.",
          "Retry with an organization role that can read Usage and Costs APIs.",
        ];
  }

  if (providerKey === "supabase") {
    return isKo
      ? [
          "SUPABASE_ACCESS_TOKEN\uc774 \uc720\ud6a8\ud55c PAT \ub610\ub294 OAuth token\uc778\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
          "projects:read, analytics_usage_read \ub4f1 \ud544\uc694 scope\ub97c \ud655\uc778\ud558\uc138\uc694.",
        ]
      : [
          "Confirm SUPABASE_ACCESS_TOKEN is a valid PAT or OAuth token.",
          "Confirm required scopes such as projects:read and analytics_usage_read.",
        ];
  }

  if (providerKey === "cloudflare") {
    return isKo
      ? [
          "CLOUDFLARE_API_TOKEN\uacfc CLOUDFLARE_ACCOUNT_IDS\uac00 \ubaa8\ub450 \uc124\uc815\ub410\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
          "API token\uc5d0 Account Billing Read \uad8c\ud55c\uc774 \uc788\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
        ]
      : [
          "Confirm both CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_IDS are configured.",
          "Confirm the API token has Account Billing Read permission.",
        ];
  }

  if (providerKey === "gcp") {
    return isKo
      ? [
          "gcloud auth login \ubc0f gcloud auth application-default login\uc744 \uc2e4\ud589\ud558\uc138\uc694.",
          "GOOGLE_CLOUD_PROJECT \ub610\ub294 gcloud config set project <project-id>\ub97c \ud655\uc778\ud558\uc138\uc694.",
        ]
      : [
          "Run gcloud auth login and gcloud auth application-default login.",
          "Confirm GOOGLE_CLOUD_PROJECT or run gcloud config set project <project-id>.",
        ];
  }

  if (providerKey === "codex-cli" || providerKey === "codex-app") {
    return isKo
      ? [
          "codex --version\uacfc codex login \uc0c1\ud0dc\ub97c \ud655\uc778\ud558\uc138\uc694.",
          "CODEX_HOME, MONEYSIREN_CODEX_SESSIONS_DIR, MONEYSIREN_CODEX_APP_SESSIONS_DIR \uacbd\ub85c\uac00 \uc2e4\uc81c \ub85c\uadf8\ub97c \uac00\ub9ac\ud0a4\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
        ]
      : [
          "Confirm codex --version and codex login state.",
          "Confirm CODEX_HOME, MONEYSIREN_CODEX_SESSIONS_DIR, or MONEYSIREN_CODEX_APP_SESSIONS_DIR points to real logs.",
        ];
  }

  if (providerKey === "claude-cli" || providerKey === "claude-app") {
    return isKo
      ? [
          "claude --version \ub610\ub294 Claude \ub370\uc2a4\ud06c\ud1b1 \uc124\uce58 \uc0c1\ud0dc\ub97c \ud655\uc778\ud558\uc138\uc694.",
          "CLAUDE_CONFIG_DIR, MONEYSIREN_CLAUDE_APP_PROJECTS_DIR, .claude/projects \uacbd\ub85c\uc5d0 \uc0ac\uc6a9\ub7c9 \ub85c\uadf8\uac00 \uc788\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
        ]
      : [
          "Confirm claude --version or Claude desktop installation state.",
          "Confirm CLAUDE_CONFIG_DIR, MONEYSIREN_CLAUDE_APP_PROJECTS_DIR, or .claude/projects contains usage logs.",
        ];
  }

  if (providerKey === "antigravity") {
    return isKo
      ? [
          "Antigravity \uc571\uc774 \uc124\uce58\ub418\uc5c8\uace0 \uc0ac\uc6a9\ub7c9 \ub370\uc774\ud130 \uacbd\ub85c\uac00 \uc874\uc7ac\ud558\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
          "MONEYSIREN_ANTIGRAVITY_DATA_DIR\ub97c \uc0ac\uc6a9\ud55c\ub2e4\uba74 \uc2e4\uc81c \uc571 \ub370\uc774\ud130 \uacbd\ub85c\ub97c \uac00\ub9ac\ud0a4\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694.",
        ]
      : [
          "Confirm Antigravity is installed and its local data path exists.",
          "If using MONEYSIREN_ANTIGRAVITY_DATA_DIR, confirm it points to the real app data path.",
        ];
  }

  return [];
}

function localeFromLabels(labels: Labels): ServiceRemediationLocale {
  if (labels === LABELS.ko) {
    return "ko";
  }

  if (labels === LABELS.ja) {
    return "ja";
  }

  return "en";
}

function item(value: ServiceRemediationItem): ServiceRemediationItem {
  return value;
}

function dedupeItems(items: readonly ServiceRemediationItem[]): ServiceRemediationItem[] {
  const seen = new Set<string>();
  const result: ServiceRemediationItem[] = [];

  for (const item of items) {
    if (seen.has(item.code)) {
      continue;
    }

    seen.add(item.code);
    result.push(item);
  }

  return result;
}

function compareItems(left: ServiceRemediationItem, right: ServiceRemediationItem): number {
  const severityOrder: Record<ServiceRemediationSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return severityOrder[left.severity] - severityOrder[right.severity] ||
    left.code.localeCompare(right.code);
}

function text(locale: ServiceRemediationLocale, en: string, ko: string): string {
  return locale === "ko" ? ko : en;
}
