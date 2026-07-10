import { createReadStream } from "node:fs";
import { posix } from "node:path";
import { createGunzip } from "node:zlib";

export const MAX_ARCHIVE_ENTRIES = 100_000;
export const MAX_ARCHIVE_EXPANDED_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_EXTENSION_BYTES = 1024 * 1024;
const TAR_BLOCK_BYTES = 512;
const ARCHIVE_ROOT = "/moneysiren-archive";

export interface ReleaseArchiveValidation {
  entries: number;
  expandedBytes: number;
}

interface TarEntryState {
  dataRemaining: number;
  paddingRemaining: number;
  capture: Buffer[];
  captureBytes: number;
  type: "long-name" | "long-link" | "pax" | "skip";
}

export async function validateTarGzArchive(
  path: string,
  limits: {
    maximumEntries?: number;
    maximumExpandedBytes?: number;
  } = {},
): Promise<ReleaseArchiveValidation> {
  const maximumEntries = limits.maximumEntries ?? MAX_ARCHIVE_ENTRIES;
  const maximumExpandedBytes = limits.maximumExpandedBytes ?? MAX_ARCHIVE_EXPANDED_BYTES;

  if (
    !Number.isSafeInteger(maximumEntries) ||
    maximumEntries <= 0 ||
    !Number.isSafeInteger(maximumExpandedBytes) ||
    maximumExpandedBytes <= 0
  ) {
    throw new Error("Release archive validation limits are invalid.");
  }

  const stream = createReadStream(path).pipe(createGunzip());
  let pending = Buffer.alloc(0);
  let expandedBytes = 0;
  let entries = 0;
  let zeroBlocks = 0;
  let ended = false;
  let current: TarEntryState | null = null;
  let nextLongName: string | null = null;
  let nextLongLink: string | null = null;
  let nextPax: ReadonlyMap<string, string> | null = null;

  try {
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk);
      expandedBytes += bytes.byteLength;

      if (expandedBytes > maximumExpandedBytes) {
        throw validationError("expanded content exceeds the configured limit");
      }

      pending = pending.length === 0 ? bytes : Buffer.concat([pending, bytes]);

      while (pending.length > 0) {
        if (ended) {
          if (!isZeroBuffer(pending)) {
            throw validationError("non-zero data follows the end marker");
          }

          pending = Buffer.alloc(0);
          break;
        }

        if (current !== null) {
          if (current.dataRemaining > 0) {
            const consumed = Math.min(current.dataRemaining, pending.length);
            const slice = pending.subarray(0, consumed);

            if (current.type !== "skip") {
              current.capture.push(Buffer.from(slice));
              current.captureBytes += slice.byteLength;

              if (current.captureBytes > MAX_EXTENSION_BYTES) {
                throw validationError("metadata extension exceeds the configured limit");
              }
            }

            current.dataRemaining -= consumed;
            pending = pending.subarray(consumed);

            if (current.dataRemaining > 0) {
              break;
            }
          }

          if (current.paddingRemaining > 0) {
            const consumed = Math.min(current.paddingRemaining, pending.length);

            if (!isZeroBuffer(pending.subarray(0, consumed))) {
              throw validationError("entry padding is invalid");
            }

            current.paddingRemaining -= consumed;
            pending = pending.subarray(consumed);

            if (current.paddingRemaining > 0) {
              break;
            }
          }

          const metadata = current.type === "skip"
            ? null
            : Buffer.concat(current.capture, current.captureBytes);
          const type = current.type;
          current = null;

          if (type === "long-name") {
            nextLongName = decodeExtensionString(metadata);
          } else if (type === "long-link") {
            nextLongLink = decodeExtensionString(metadata);
          } else if (type === "pax") {
            nextPax = parsePaxMetadata(metadata);
          }

          continue;
        }

        if (pending.length < TAR_BLOCK_BYTES) {
          break;
        }

        const header = pending.subarray(0, TAR_BLOCK_BYTES);
        pending = pending.subarray(TAR_BLOCK_BYTES);

        if (isZeroBuffer(header)) {
          zeroBlocks += 1;

          if (zeroBlocks === 2) {
            ended = true;
          }

          continue;
        }

        if (zeroBlocks > 0) {
          throw validationError("archive has an incomplete end marker");
        }

        validateHeaderChecksum(header);
        const rawName = tarPath(header, 0, 100, 345, 155);
        const rawLink = tarString(header, 157, 100);
        const size = tarOctal(header, 124, 12, "entry size");
        const typeFlag = tarString(header, 156, 1) || "0";
        const padding = (TAR_BLOCK_BYTES - (size % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;

        if (typeFlag === "L" || typeFlag === "K" || typeFlag === "x") {
          validateArchivePath(rawName);
          current = {
            dataRemaining: size,
            paddingRemaining: padding,
            capture: [],
            captureBytes: 0,
            type: typeFlag === "L" ? "long-name" : typeFlag === "K" ? "long-link" : "pax",
          };
          continue;
        }

        if (!["0", "1", "2", "5"].includes(typeFlag)) {
          throw validationError(`unsupported entry type ${JSON.stringify(typeFlag)}`);
        }

        const entryName = nextPax?.get("path") ?? nextLongName ?? rawName;
        const linkName = nextPax?.get("linkpath") ?? nextLongLink ?? rawLink;
        nextPax = null;
        nextLongName = null;
        nextLongLink = null;

        const normalizedPath = validateArchivePath(entryName);
        entries += 1;

        if (entries > maximumEntries) {
          throw validationError("entry count exceeds the configured limit");
        }

        if (typeFlag === "1") {
          validateArchiveLink(normalizedPath, linkName, true);
        } else if (typeFlag === "2") {
          validateArchiveLink(normalizedPath, linkName, false);
        }

        current = {
          dataRemaining: size,
          paddingRemaining: padding,
          capture: [],
          captureBytes: 0,
          type: "skip",
        };
      }
    }
  } catch (error) {
    if (error instanceof ReleaseArchiveValidationError) {
      throw error;
    }

    throw validationError("gzip or tar framing is invalid");
  }

  if (current !== null || pending.length !== 0 || !ended) {
    throw validationError("archive ended before a complete tar end marker");
  }

  if (nextLongName !== null || nextLongLink !== null || nextPax !== null) {
    throw validationError("archive metadata does not apply to an entry");
  }

  if (entries === 0) {
    throw validationError("archive contains no installable entries");
  }

  return {
    entries,
    expandedBytes,
  };
}

export function validateArchivePath(value: string): string {
  const candidate = normalizeSeparators(value);

  if (
    candidate.length === 0 ||
    candidate.startsWith("/") ||
    /^[A-Za-z]:/.test(candidate) ||
    candidate.includes("\u0000") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    throw validationError("entry path is absolute or invalid");
  }

  const segments = candidate.replace(/\/+$/, "").split("/");

  if (
    segments.length === 0 ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw validationError("entry path contains traversal or ambiguous segments");
  }

  const normalized = posix.normalize(segments.join("/"));

  if (normalized === ".." || normalized.startsWith("../") || posix.isAbsolute(normalized)) {
    throw validationError("entry path escapes the archive root");
  }

  return normalized;
}

function validateArchiveLink(entryPath: string, value: string, hardLink: boolean): void {
  const candidate = normalizeSeparators(value);

  if (
    candidate.length === 0 ||
    candidate.startsWith("/") ||
    /^[A-Za-z]:/.test(candidate) ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    throw validationError("link target is absolute or invalid");
  }

  const resolved = hardLink
    ? posix.resolve(ARCHIVE_ROOT, candidate)
    : posix.resolve(ARCHIVE_ROOT, posix.dirname(entryPath), candidate);

  if (resolved !== ARCHIVE_ROOT && !resolved.startsWith(`${ARCHIVE_ROOT}/`)) {
    throw validationError("link target escapes the archive root");
  }
}

function parsePaxMetadata(content: Buffer | null): ReadonlyMap<string, string> {
  if (content === null) {
    throw validationError("PAX metadata is missing");
  }

  const values = new Map<string, string>();
  let offset = 0;

  while (offset < content.length) {
    const space = content.indexOf(0x20, offset);

    if (space === -1) {
      throw validationError("PAX metadata length is invalid");
    }

    const lengthText = content.subarray(offset, space).toString("ascii");

    if (!/^[1-9]\d*$/.test(lengthText)) {
      throw validationError("PAX metadata length is invalid");
    }

    const length = Number(lengthText);

    if (!Number.isSafeInteger(length) || length <= space - offset + 1 || offset + length > content.length) {
      throw validationError("PAX metadata length is invalid");
    }

    const record = content.subarray(space + 1, offset + length);

    if (record.at(-1) !== 0x0a) {
      throw validationError("PAX metadata record is not newline terminated");
    }

    const separator = record.indexOf(0x3d);

    if (separator <= 0) {
      throw validationError("PAX metadata record is invalid");
    }

    const key = record.subarray(0, separator).toString("utf8");
    const value = record.subarray(separator + 1, -1).toString("utf8");

    if (key.includes("\ufffd") || value.includes("\ufffd")) {
      throw validationError("PAX metadata is not valid UTF-8");
    }

    if (key === "path" || key === "linkpath") {
      if (values.has(key)) {
        throw validationError(`PAX metadata repeats ${key}`);
      }

      values.set(key, value);
    }

    offset += length;
  }

  return values;
}

function decodeExtensionString(content: Buffer | null): string {
  if (content === null) {
    throw validationError("archive metadata extension is missing");
  }

  const zero = content.indexOf(0);
  const value = content.subarray(0, zero === -1 ? content.length : zero).toString("utf8");

  if (value.includes("\ufffd")) {
    throw validationError("archive metadata extension is not valid UTF-8");
  }

  return value;
}

function tarPath(
  header: Buffer,
  nameOffset: number,
  nameLength: number,
  prefixOffset: number,
  prefixLength: number,
): string {
  const name = tarString(header, nameOffset, nameLength);
  const prefix = tarString(header, prefixOffset, prefixLength);

  return prefix.length === 0 ? name : `${prefix}/${name}`;
}

function tarString(buffer: Buffer, offset: number, length: number): string {
  const slice = buffer.subarray(offset, offset + length);
  const zero = slice.indexOf(0);
  const value = slice.subarray(0, zero === -1 ? slice.length : zero).toString("utf8");

  if (value.includes("\ufffd")) {
    throw validationError("tar header is not valid UTF-8");
  }

  return value;
}

function tarOctal(buffer: Buffer, offset: number, length: number, label: string): number {
  const source = buffer.subarray(offset, offset + length);

  if ((source[0] ?? 0) >= 0x80) {
    throw validationError(`${label} uses unsupported base-256 encoding`);
  }

  const text = source.toString("ascii").replaceAll("\u0000", "").trim();

  if (text.length === 0) {
    return 0;
  }

  if (!/^[0-7]+$/.test(text)) {
    throw validationError(`${label} is not octal`);
  }

  const value = Number.parseInt(text, 8);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw validationError(`${label} is outside the supported range`);
  }

  return value;
}

function validateHeaderChecksum(header: Buffer): void {
  const expected = tarOctal(header, 148, 8, "header checksum");
  let actual = 0;

  for (let index = 0; index < TAR_BLOCK_BYTES; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : (header[index] ?? 0);
  }

  if (actual !== expected) {
    throw validationError("header checksum does not match");
  }
}

function normalizeSeparators(value: string): string {
  return value.replaceAll("\\", "/");
}

function isZeroBuffer(value: Buffer): boolean {
  return value.every((byte) => byte === 0);
}

function validationError(reason: string): ReleaseArchiveValidationError {
  return new ReleaseArchiveValidationError(`Release archive validation failed: ${reason}.`);
}

class ReleaseArchiveValidationError extends Error {}
