import { readBoundedJsonl } from "../jsonl-reader";
import { parseCodexUsageValue } from "./parser";
import {
  createCodexUsageAccumulator,
  type CodexLocalAggregationResult,
} from "./usage-accumulator";

export interface CodexLocalUsageFile {
  path: string;
}

export interface ScanCodexLocalUsageOptions {
  files: readonly CodexLocalUsageFile[];
  eligibleFileCount: number;
  periodStart: string;
  periodEnd: string;
  inspectValue?: (value: unknown) => void;
}

export async function scanCodexLocalUsage(
  options: ScanCodexLocalUsageOptions,
): Promise<CodexLocalAggregationResult> {
  const accumulator = createCodexUsageAccumulator({
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    eligibleFileCount: options.eligibleFileCount,
    scannedFileCount: options.files.length,
    truncated: options.eligibleFileCount > options.files.length,
  });

  for (const file of options.files) {
    const readerResult = await readBoundedJsonl(file.path, (value) => {
      options.inspectValue?.(value);
      accumulator.add(parseCodexUsageValue(value));
    });

    accumulator.addReaderResult(readerResult);
  }

  return accumulator.finish();
}
