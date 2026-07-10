import type {
  CollectedProviderSnapshots,
  CollectionStatus,
  ProviderKind,
} from "../../../../packages/core/src/index.js";

export type SyncExitCode = 0 | 1 | 2;

export type SyncErrorCode =
  | "SYNC_ARGUMENT"
  | "SYNC_CONFIGURATION"
  | "SYNC_FIXTURE_CONFIGURATION"
  | "SYNC_EXECUTION"
  | "SYNC_COLLECTION"
  | "SYNC_NO_USABLE_DATA"
  | "SYNC_PERSISTENCE"
  | "SYNC_PARTIAL";

export interface SyncSnapshotCounts {
  usage: number;
  billing: number;
  health: number;
  estimates: number;
  alerts: number;
}

export interface SyncResult {
  provider: ProviderKind;
  status: CollectionStatus;
  counts: SyncSnapshotCounts;
  errorCode: SyncErrorCode | null;
  errorMessage: string | null;
}

const EMPTY_COUNTS: SyncSnapshotCounts = {
  usage: 0,
  billing: 0,
  health: 0,
  estimates: 0,
  alerts: 0,
};

export function createCollectionSyncResult(
  collection: CollectedProviderSnapshots,
): SyncResult {
  const counts: SyncSnapshotCounts = {
    usage: collection.snapshots.usage.length,
    billing: collection.snapshots.billing.length,
    health: collection.snapshots.serviceHealth.length,
    estimates: collection.snapshots.costEstimates.length,
    alerts: collection.alerts.length,
  };
  const usableSnapshotCount =
    counts.usage +
    counts.billing +
    counts.health +
    counts.estimates;

  if (collection.status === "partial" && usableSnapshotCount === 0) {
    return {
      provider: collection.provider,
      status: "error",
      counts,
      errorCode: "SYNC_NO_USABLE_DATA",
      errorMessage: "Provider collection returned no usable normalized snapshots.",
    };
  }

  if (collection.status === "error") {
    return {
      provider: collection.provider,
      status: "error",
      counts,
      errorCode: "SYNC_COLLECTION",
      errorMessage: "Provider collection failed before usable normalized data was collected.",
    };
  }

  if (collection.status === "partial") {
    return {
      provider: collection.provider,
      status: "partial",
      counts,
      errorCode: "SYNC_PARTIAL",
      errorMessage: "Usable normalized data was saved, but one or more provider surfaces were unavailable.",
    };
  }

  return {
    provider: collection.provider,
    status: "ok",
    counts,
    errorCode: null,
    errorMessage: null,
  };
}

export function createSyncFailure(
  provider: ProviderKind,
  errorCode: Exclude<SyncErrorCode, "SYNC_PARTIAL">,
  errorMessage: string,
): SyncResult {
  return {
    provider,
    status: "error",
    counts: { ...EMPTY_COUNTS },
    errorCode,
    errorMessage,
  };
}

export function syncResultExitCode(result: SyncResult): SyncExitCode {
  if (result.status === "ok") {
    return 0;
  }

  if (result.status === "partial") {
    return 2;
  }

  return 1;
}

export function renderSyncResult(result: SyncResult): {
  summary: string;
  diagnostic?: string;
} {
  const summary = [
    `Sync ${result.provider}: ${result.status}`,
    `usage=${result.counts.usage}`,
    `billing=${result.counts.billing}`,
    `health=${result.counts.health}`,
    `estimates=${result.counts.estimates}`,
    `alerts=${result.counts.alerts}`,
  ].join(" ");

  if (result.errorCode === null) {
    return { summary };
  }

  return {
    summary,
    diagnostic: `Sync ${result.provider} ${result.errorCode}: ${result.errorMessage ?? "Sync failed."}`,
  };
}
