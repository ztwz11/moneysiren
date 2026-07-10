import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  validateArchivePath,
  validateTarGzArchive,
} from "./release-archive.js";

describe("release archive validation", () => {
  it("accepts a bounded tar.gz with regular entries and an in-root symlink", async () => {
    const path = await writeArchive([
      tarEntry("moneysiren-web-runtime/", {
        type: "5",
      }),
      tarEntry("moneysiren-web-runtime/start.mjs", {
        content: Buffer.from("console.log('synthetic')\n"),
      }),
      tarEntry("moneysiren-web-runtime/start-link.mjs", {
        type: "2",
        linkName: "start.mjs",
      }),
    ]);

    await expect(validateTarGzArchive(path)).resolves.toMatchObject({
      entries: 3,
    });
  });

  it.each([
    "../outside.txt",
    "/absolute.txt",
    "C:\\outside.txt",
    "runtime/../../outside.txt",
    "runtime//ambiguous.txt",
  ])("rejects unsafe archive path %s", (path) => {
    expect(() => validateArchivePath(path)).toThrow(/archive validation failed/);
  });

  it("rejects traversal entries before extraction", async () => {
    const path = await writeArchive([
      tarEntry("../outside.txt", {
        content: Buffer.from("synthetic"),
      }),
    ]);

    await expect(validateTarGzArchive(path)).rejects.toThrow(/traversal|escapes|absolute/);
  });

  it("rejects symlink and hard-link targets that escape the archive root", async () => {
    const symlink = await writeArchive([
      tarEntry("runtime/deep/link", {
        type: "2",
        linkName: "../../../outside",
      }),
    ]);
    const hardLink = await writeArchive([
      tarEntry("runtime/link", {
        type: "1",
        linkName: "../outside",
      }),
    ]);

    await expect(validateTarGzArchive(symlink)).rejects.toThrow(/link target escapes/);
    await expect(validateTarGzArchive(hardLink)).rejects.toThrow(/link target escapes/);
  });

  it("rejects unsupported special entries, malformed framing, and expansion limits", async () => {
    const device = await writeArchive([
      tarEntry("runtime/device", {
        type: "3",
      }),
    ]);
    const large = await writeArchive([
      tarEntry("runtime/large.bin", {
        content: Buffer.alloc(2048),
      }),
    ]);
    const root = await mkdtemp(join(tmpdir(), "moneysiren-archive-"));
    const malformed = join(root, "malformed.tar.gz");

    await writeFile(malformed, Buffer.from("not gzip"));

    await expect(validateTarGzArchive(device)).rejects.toThrow(/unsupported entry type/);
    await expect(validateTarGzArchive(malformed)).rejects.toThrow(/gzip or tar framing/);
    await expect(validateTarGzArchive(large, {
      maximumExpandedBytes: 1024,
    })).rejects.toThrow(/expanded content exceeds/);
  });
});

async function writeArchive(entries: readonly Buffer[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "moneysiren-archive-"));
  const path = join(root, "fixture.tar.gz");
  const tar = Buffer.concat([
    ...entries,
    Buffer.alloc(1024),
  ]);

  await writeFile(path, gzipSync(tar));
  return path;
}

function tarEntry(
  name: string,
  options: {
    content?: Buffer;
    linkName?: string;
    type?: string;
  } = {},
): Buffer {
  const content = options.content ?? Buffer.alloc(0);
  const type = options.type ?? "0";
  const header = Buffer.alloc(512);

  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, type === "2" ? 0o777 : 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, content.byteLength);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  writeString(header, 156, 1, type);
  writeString(header, 157, 100, options.linkName ?? "");
  writeString(header, 257, 6, "ustar");
  writeString(header, 263, 2, "00");

  let checksum = 0;

  for (const byte of header) {
    checksum += byte;
  }

  const checksumText = checksum.toString(8).padStart(6, "0");
  header.write(checksumText, 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;

  const padding = Buffer.alloc((512 - (content.byteLength % 512)) % 512);

  return Buffer.concat([header, content, padding]);
}

function writeString(buffer: Buffer, offset: number, length: number, value: string): void {
  const encoded = Buffer.from(value, "utf8");

  if (encoded.length > length) {
    throw new Error("Synthetic tar test value is too long.");
  }

  encoded.copy(buffer, offset);
}

function writeOctal(buffer: Buffer, offset: number, length: number, value: number): void {
  const encoded = `${value.toString(8).padStart(length - 1, "0")}\0`;
  buffer.write(encoded, offset, length, "ascii");
}
