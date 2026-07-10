type SlashDispatch =
  | {
      kind: "dispatch";
      args: readonly string[];
    }
  | {
      kind: "quit";
    }
  | {
      kind: "error";
      message: string;
      usage?: string;
    };

const SUPPORTED_SYNC_PROVIDERS = ["mock", "aws", "openai", "supabase", "cloudflare"] as const;
type SupportedSyncProvider = (typeof SUPPORTED_SYNC_PROVIDERS)[number];

export function parseSlashInput(input: string): readonly string[] {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return [];
  }

  return trimmed.split(/\s+/);
}

export function isSlashQuit(args: readonly string[]): boolean {
  return args.length === 1 && args[0]?.toLowerCase() === "/quit";
}

export function resolveSlashCommand(args: readonly string[]): SlashDispatch {
  const [rawCommand, ...rest] = args;

  if (rawCommand === undefined || !rawCommand.startsWith("/")) {
    return {
      kind: "error",
      message: "Slash commands must start with `/`.",
      usage: "Run `moneysiren /help` for slash usage.",
    };
  }

  const command = rawCommand.toLowerCase();

  if (command === "/help") {
    return noExtraArgs(command, rest, ["--help"]);
  }

  if (command === "/version") {
    return noExtraArgs(command, rest, ["--version"]);
  }

  if (command === "/doctor") {
    return noExtraArgs(command, rest, ["doctor"]);
  }

  if (command === "/demo") {
    return {
      kind: "dispatch",
      args: ["demo", ...rest],
    };
  }

  if (command === "/install") {
    return resolveInstallSlash(rest);
  }

  if (command === "/modes") {
    return noExtraArgs(command, rest, ["modes"]);
  }

  if (command === "/start") {
    return {
      kind: "dispatch",
      args: ["start", ...rest],
    };
  }

  if (command === "/hud") {
    return {
      kind: "dispatch",
      args: ["hud", ...rest],
    };
  }

  if (command === "/status") {
    return noExtraArgs(command, rest, ["status"]);
  }

  if (command === "/stop") {
    return {
      kind: "dispatch",
      args: ["stop", ...rest],
    };
  }

  if (command === "/restart") {
    return {
      kind: "dispatch",
      args: ["restart", ...rest],
    };
  }

  if (command === "/init") {
    return noExtraArgs(command, rest, ["init"]);
  }

  if (command === "/dashboard") {
    return resolveDashboardSlash(rest);
  }

  if (command === "/summary") {
    return resolveSummarySlash(rest);
  }

  if (command === "/notify") {
    return resolveNotifySlash(rest);
  }

  if (command === "/desktop") {
    return resolveDesktopSlash(rest);
  }

  if (command === "/sync") {
    return resolveSyncSlash(rest);
  }

  if (command === "/report") {
    return resolveReportSlash(rest);
  }

  if (command === "/theme") {
    return resolveThemeSlash(rest);
  }

  if (command === "/quit") {
    if (rest.length === 0) {
      return {
        kind: "quit",
      };
    }

    return invalidUsage(command, "Usage: moneysiren /quit");
  }

  return {
    kind: "error",
    message: `Unknown slash command: ${formatSlashCommand(args)}`,
    usage: "Run `moneysiren /help` for slash usage.",
  };
}

function noExtraArgs(command: string, rest: readonly string[], mappedArgs: readonly string[]): SlashDispatch {
  if (rest.length > 0) {
    return invalidUsage(command, `Usage: moneysiren ${command}`);
  }

  return {
    kind: "dispatch",
    args: mappedArgs,
  };
}

function resolveDashboardSlash(rest: readonly string[]): SlashDispatch {
  if (rest.length === 0) {
    return {
      kind: "dispatch",
      args: ["dashboard", "check"],
    };
  }

  const [subcommand, ...subcommandRest] = rest;

  if (subcommand === "check") {
    return {
      kind: "dispatch",
      args: ["dashboard", "check", ...subcommandRest],
    };
  }

  return invalidUsage("/dashboard", "Usage: moneysiren /dashboard [check]");
}

function resolveInstallSlash(rest: readonly string[]): SlashDispatch {
  if (rest.length === 0) {
    return {
      kind: "dispatch",
      args: ["install"],
    };
  }

  if (rest.length === 1 && rest[0] === "status") {
    return {
      kind: "dispatch",
      args: ["install", "--status"],
    };
  }

  return {
    kind: "dispatch",
    args: ["install", ...rest],
  };
}

function resolveSyncSlash(rest: readonly string[]): SlashDispatch {
  const [provider, ...extra] = rest;

  if (provider === undefined || extra.length > 0 || !isSupportedSyncProvider(provider)) {
    return invalidUsage("/sync", "Usage: moneysiren /sync <mock|aws|openai|supabase|cloudflare>");
  }

  return {
    kind: "dispatch",
    args: ["sync", "--provider", provider],
  };
}

function resolveSummarySlash(rest: readonly string[]): SlashDispatch {
  if (rest.length !== 1 || rest[0] !== "json") {
    return invalidUsage("/summary", "Usage: moneysiren /summary json");
  }

  return {
    kind: "dispatch",
    args: ["summary", "--json"],
  };
}

function resolveNotifySlash(rest: readonly string[]): SlashDispatch {
  if (rest.length === 1 && rest[0] === "dry-run") {
    return {
      kind: "dispatch",
      args: ["notify", "once", "--dry-run"],
    };
  }

  if (rest.length === 1 && rest[0] === "prefs") {
    return {
      kind: "dispatch",
      args: ["notify", "prefs", "list"],
    };
  }

  return invalidUsage("/notify", "Usage: moneysiren /notify <dry-run|prefs>");
}

function resolveDesktopSlash(rest: readonly string[]): SlashDispatch {
  if (rest.length !== 1 || rest[0] !== "status") {
    return invalidUsage("/desktop", "Usage: moneysiren /desktop status");
  }

  return {
    kind: "dispatch",
    args: ["desktop", "status"],
  };
}

function resolveReportSlash(rest: readonly string[]): SlashDispatch {
  if (rest.length !== 1 || rest[0] !== "ko") {
    return invalidUsage("/report", "Usage: moneysiren /report ko");
  }

  return {
    kind: "dispatch",
    args: ["report", "daily", "--lang", "ko"],
  };
}

function resolveThemeSlash(rest: readonly string[]): SlashDispatch {
  const [subcommand, ...extra] = rest;

  if (subcommand === "preview" || subcommand === "image-prompt") {
    if (extra.length > 0) {
      return invalidUsage("/theme", "Usage: moneysiren /theme <preview|image-prompt|image-generate>");
    }

    return {
      kind: "dispatch",
      args: ["theme", subcommand],
    };
  }

  if (subcommand === "image-generate") {
    return {
      kind: "dispatch",
      args: ["theme", subcommand, ...extra],
    };
  }

  return invalidUsage("/theme", "Usage: moneysiren /theme <preview|image-prompt|image-generate>");
}

function invalidUsage(command: string, usage: string): SlashDispatch {
  return {
    kind: "error",
    message: `Invalid slash command usage: ${command}`,
    usage,
  };
}

function isSupportedSyncProvider(provider: string): provider is SupportedSyncProvider {
  return SUPPORTED_SYNC_PROVIDERS.includes(provider as SupportedSyncProvider);
}

function formatSlashCommand(args: readonly string[]): string {
  return args.join(" ");
}
