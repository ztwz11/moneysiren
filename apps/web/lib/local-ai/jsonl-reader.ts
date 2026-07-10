import { createReadStream } from "node:fs";
import { StringDecoder } from "node:string_decoder";

export const DEFAULT_JSONL_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  maxLines: 100_000,
  maxLineBytes: 256 * 1024,
} as const;

export interface BoundedJsonlLimits {
  maxBytes?: number;
  maxLines?: number;
  maxLineBytes?: number;
}

export interface BoundedJsonlReadResult {
  bytesRead: number;
  lineCount: number;
  parsedRecordCount: number;
  malformedRecordCount: number;
  oversizedLineCount: number;
  truncated: boolean;
  unreadable: boolean;
}

export async function readBoundedJsonl(
  path: string,
  onValue: (value: unknown) => void,
  limits: BoundedJsonlLimits = {},
): Promise<BoundedJsonlReadResult> {
  const maxBytes = positiveLimit(limits.maxBytes, DEFAULT_JSONL_LIMITS.maxBytes);
  const maxLines = positiveLimit(limits.maxLines, DEFAULT_JSONL_LIMITS.maxLines);
  const maxLineBytes = positiveLimit(limits.maxLineBytes, DEFAULT_JSONL_LIMITS.maxLineBytes);
  const result: BoundedJsonlReadResult = {
    bytesRead: 0,
    lineCount: 0,
    parsedRecordCount: 0,
    malformedRecordCount: 0,
    oversizedLineCount: 0,
    truncated: false,
    unreadable: false,
  };
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  let droppingOversizedLine = false;
  let byteLimitReached = false;
  let stopped = false;

  const consumeLine = (line: string): boolean => {
    if (result.lineCount >= maxLines) {
      result.truncated = true;
      return false;
    }

    result.lineCount += 1;

    if (droppingOversizedLine) {
      droppingOversizedLine = false;
      return true;
    }

    const trimmed = line.trim();

    if (trimmed.length === 0) {
      return true;
    }

    if (Buffer.byteLength(line, "utf8") > maxLineBytes) {
      result.oversizedLineCount += 1;
      result.truncated = true;
      return true;
    }

    try {
      onValue(JSON.parse(trimmed) as unknown);
      result.parsedRecordCount += 1;
    } catch {
      result.malformedRecordCount += 1;
    }

    return true;
  };

  const appendText = (text: string): void => {
    if (stopped || text.length === 0) {
      return;
    }

    buffer += text;
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);

      if (!consumeLine(line)) {
        stopped = true;
        buffer = "";
        return;
      }

      newlineIndex = buffer.indexOf("\n");
    }

    if (!droppingOversizedLine && Buffer.byteLength(buffer, "utf8") > maxLineBytes) {
      result.oversizedLineCount += 1;
      result.truncated = true;
      droppingOversizedLine = true;
      buffer = "";
    }
  };

  try {
    const stream = createReadStream(path, { highWaterMark: 64 * 1024 });

    for await (const rawChunk of stream) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      const remaining = maxBytes - result.bytesRead;

      if (remaining <= 0) {
        result.truncated = true;
        byteLimitReached = true;
        break;
      }

      const accepted = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
      result.bytesRead += accepted.length;
      appendText(decoder.write(accepted));

      if (chunk.length > remaining || stopped) {
        result.truncated = true;
        byteLimitReached = chunk.length > remaining;
        break;
      }
    }

    if (!byteLimitReached && !stopped) {
      appendText(decoder.end());

      if (buffer.length > 0 && !droppingOversizedLine) {
        consumeLine(buffer.replace(/\r$/, ""));
      }
    }
  } catch {
    result.unreadable = true;
  }

  return result;
}

function positiveLimit(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isSafeInteger(value) || value <= 0
    ? fallback
    : value;
}
