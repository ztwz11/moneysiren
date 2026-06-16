import type { CliExecutionContext } from "../cli.js";
import { readSanitizedSummary } from "../summary-model.js";

const SUMMARY_USAGE = "Usage: moneysiren summary --json";

export async function runSummaryCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(SUMMARY_USAGE);
    return 0;
  }

  if (args.length !== 1 || args[0] !== "--json") {
    context.stderr(SUMMARY_USAGE);
    return 1;
  }

  context.stdout(JSON.stringify(await readSanitizedSummary(context), null, 2));
  return 0;
}
