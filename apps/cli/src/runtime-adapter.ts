import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { startLocalApiServer, type LocalApiServer } from "../../../packages/local-api/src/index.js";
import {
  assertRuntimeHealthy as assertPackageRuntimeHealthy,
  findRuntime,
  type LocalRuntime,
} from "../../../packages/runtime/src/index.js";
import { readLocalStore, type LocalStore } from "../../../packages/db/src/index.js";
import type { ViewModelStore } from "../../../packages/view-model/src/index.js";
import type { CliExecutionContext } from "./cli.js";
import { loadCliConfig, resolveDbPath } from "./commands/shared.js";

export type { LocalRuntime } from "../../../packages/runtime/src/index.js";

export interface StartRuntimeOptions {
  openBrowser?: boolean;
  port?: number;
  headless?: boolean;
}

export type StartRuntimeResult =
  | {
      status: "running" | "started";
      runtime: LocalRuntime;
    }
  | {
      status: "unavailable";
      reason: string;
      guidance: readonly string[];
    };

export interface CliLocalRuntimeAdapter {
  findRuntime(): Promise<LocalRuntime | null>;
  assertRuntimeHealthy(runtime: LocalRuntime): Promise<boolean>;
  startRuntime(options: StartRuntimeOptions): Promise<StartRuntimeResult>;
}

let activeLocalApiServer: LocalApiServer | null = null;
let registeredShutdownHandlers = false;

export function createFallbackLocalRuntimeAdapter(context: CliExecutionContext): CliLocalRuntimeAdapter {
  return {
    async findRuntime() {
      return findRuntime({
        cwd: context.cwd,
        env: context.env,
      });
    },
    async assertRuntimeHealthy(runtime) {
      return assertPackageRuntimeHealthy(runtime, {
        fetchImpl: context.fetch,
      });
    },
    async startRuntime(options) {
      const runtime = await findRuntime({
        cwd: context.cwd,
        env: context.env,
      });

      if (runtime !== null && await assertPackageRuntimeHealthy(runtime, {
        fetchImpl: context.fetch,
      })) {
        return {
          status: "running",
          runtime,
        };
      }

      if (activeLocalApiServer !== null) {
        return {
          status: "running",
          runtime: activeLocalApiServer.runtime,
        };
      }

      const api = await startLocalApiServer({
        ...(options.port === undefined ? {} : { port: options.port }),
        runtimeLock: {
          cwd: context.cwd,
          env: context.env,
        },
        viewModel: {
          now: context.now,
          readStore: () => readViewModelStore(context),
        },
      });

      activeLocalApiServer = api;
      registerShutdownHandlers();

      return {
        status: "started",
        runtime: api.runtime,
      };
    },
  };
}

export async function openUrlInBrowser(url: string): Promise<void> {
  const parsedUrl = new URL(url);

  if (!isLoopbackHttpUrl(parsedUrl)) {
    throw new Error("Refusing to open a non-loopback runtime URL.");
  }

  const child = process.platform === "win32"
    ? spawn("rundll32.exe", ["url.dll,FileProtocolHandler", parsedUrl.toString()], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      })
    : process.platform === "darwin"
      ? spawn("open", [parsedUrl.toString()], {
          detached: true,
          stdio: "ignore",
        })
      : spawn("xdg-open", [parsedUrl.toString()], {
          detached: true,
          stdio: "ignore",
        });

  child.unref();
}

function isLoopbackHttpUrl(url: URL): boolean {
  return url.protocol === "http:" &&
    (
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "::1" ||
      url.hostname === "[::1]"
    );
}

async function readViewModelStore(context: CliExecutionContext): Promise<ViewModelStore> {
  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);

  if (!await pathExists(dbPath)) {
    return emptyViewModelStore();
  }

  return localStoreToViewModelStore(await readLocalStore({ dbPath }));
}

function localStoreToViewModelStore(store: LocalStore): ViewModelStore {
  return {
    providers: store.providers.map((provider) => ({
      key: provider.key,
      displayName: provider.displayName,
    })),
    usageSnapshots: store.usageSnapshots.map((snapshot) => ({
      providerKey: snapshot.providerKey,
      collectedAt: snapshot.collectedAt,
      service: snapshot.service,
      metric: snapshot.metric,
      unit: snapshot.unit,
      value: snapshot.value,
    })),
    billingSnapshots: store.billingSnapshots.map((snapshot) => ({
      providerKey: snapshot.providerKey,
      collectedAt: snapshot.collectedAt,
      amountMinor: snapshot.amountMinor,
      currency: snapshot.currency,
      status: snapshot.status,
    })),
    serviceHealthSnapshots: store.serviceHealthSnapshots.map((snapshot) => ({
      providerKey: snapshot.providerKey,
      collectedAt: snapshot.collectedAt,
      service: snapshot.service,
      status: snapshot.status,
      ...(snapshot.region === undefined ? {} : { region: snapshot.region }),
      ...(snapshot.message === undefined ? {} : { message: snapshot.message }),
    })),
    costEstimates: store.costEstimates.map((estimate) => ({
      providerKey: estimate.providerKey,
      collectedAt: estimate.collectedAt,
      estimatedAmountMinor: estimate.estimatedAmountMinor,
      currency: estimate.currency,
      confidence: estimate.confidence,
    })),
    alerts: store.alerts.map((alert) => ({
      ...(alert.providerKey === undefined ? {} : { providerKey: alert.providerKey }),
      createdAt: alert.createdAt,
      severity: alert.severity,
      category: alert.category,
      title: alert.title,
      message: alert.message,
    })),
  };
}

function emptyViewModelStore(): ViewModelStore {
  return {
    providers: [],
    usageSnapshots: [],
    billingSnapshots: [],
    serviceHealthSnapshots: [],
    costEstimates: [],
    alerts: [],
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function registerShutdownHandlers(): void {
  if (registeredShutdownHandlers) {
    return;
  }

  registeredShutdownHandlers = true;
  const closeActiveServer = () => {
    const server = activeLocalApiServer;
    activeLocalApiServer = null;

    if (server !== null) {
      void server.close();
    }
  };

  process.once("beforeExit", closeActiveServer);
  process.once("SIGINT", () => {
    closeActiveServer();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    closeActiveServer();
    process.exit(0);
  });
}
