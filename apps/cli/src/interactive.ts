import { createInterface } from "node:readline/promises";
import type { CliExecutionContext } from "./cli.js";
import { isSlashQuit, parseSlashInput } from "./slash.js";

export async function runSlashPrompt(
  context: CliExecutionContext,
  execute: (args: readonly string[]) => Promise<number>,
): Promise<number> {
  if (context.stdin === undefined || context.output === undefined) {
    return 0;
  }

  const prompt = context.theme.command("moneysiren> ");
  const readline = createInterface({
    input: context.stdin,
    output: context.output,
    terminal: false,
    historySize: 0,
  });

  context.stdout("Slash prompt ready. Type /help for commands or /quit to exit.");

  try {
    let lastExitCode = 0;

    while (true) {
      const args = parseSlashInput(await readline.question(prompt));

      if (args.length === 0) {
        continue;
      }

      lastExitCode = await execute(args);

      if (isSlashQuit(args)) {
        return lastExitCode;
      }
    }
  } finally {
    readline.close();
  }
}
