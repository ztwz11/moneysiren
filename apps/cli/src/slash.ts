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
      usage: "Run `stackspend /help` for slash usage.",
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

  if (command === "/init") {
    return noExtraArgs(command, rest, ["init"]);
  }

  if (command === "/dashboard") {
    return resolveDashboardSlash(rest);
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

    return invalidUsage(command, "Usage: stackspend /quit");
  }

  return {
    kind: "error",
    message: `Unknown slash command: ${formatSlashCommand(args)}`,
    usage: "Run `stackspend /help` for slash usage.",
  };
}

function noExtraArgs(command: string, rest: readonly string[], mappedArgs: readonly string[]): SlashDispatch {
  if (rest.length > 0) {
    return invalidUsage(command, `Usage: stackspend ${command}`);
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

  return invalidUsage("/dashboard", "Usage: stackspend /dashboard [check]");
}

function resolveSyncSlash(rest: readonly string[]): SlashDispatch {
  const [provider, ...extra] = rest;

  if (provider === undefined || extra.length > 0 || !isSupportedSyncProvider(provider)) {
    return invalidUsage("/sync", "Usage: stackspend /sync <mock|aws|openai|supabase|cloudflare>");
  }

  return {
    kind: "dispatch",
    args: ["sync", "--provider", provider],
  };
}

function resolveReportSlash(rest: readonly string[]): SlashDispatch {
  if (rest.length !== 1 || rest[0] !== "ko") {
    return invalidUsage("/report", "Usage: stackspend /report ko");
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
      return invalidUsage("/theme", "Usage: stackspend /theme <preview|image-prompt|image-generate>");
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

  return invalidUsage("/theme", "Usage: stackspend /theme <preview|image-prompt|image-generate>");
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
