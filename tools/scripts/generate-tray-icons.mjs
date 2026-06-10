import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const iconDir = resolve(repoRoot, "apps/tray/src-tauri/icons");
const size = 64;
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

mkdirSync(iconDir, { recursive: true });

const png = buildPng(size, size);
writeFileSync(resolve(iconDir, "tray.png"), png);
writeFileSync(resolve(iconDir, "tray.ico"), buildIco(png, size, size));
writeFileSync(resolve(iconDir, "tray-template.svg"), buildTemplateSvg(), "utf8");

console.log(`Generated tray icons in ${iconDir}`);

function buildPng(width, height) {
  const data = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    data[rowOffset] = 0;

    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const color = pixelColor(x, y, width, height);
      data[pixelOffset] = color.r;
      data[pixelOffset + 1] = color.g;
      data[pixelOffset + 2] = color.b;
      data[pixelOffset + 3] = color.a;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", deflateSync(data)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function pixelColor(x, y, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  const radius = Math.sqrt(dx * dx + dy * dy);
  const inside = radius <= 29;
  const inRing = radius >= 23 && radius <= 28;
  const onLineA = distanceToSegment(x, y, 20, 22, 43, 34) < 2.1;
  const onLineB = distanceToSegment(x, y, 20, 42, 43, 34) < 2.1;
  const onNode = [
    [20, 22],
    [20, 42],
    [43, 34],
  ].some(([nodeX, nodeY]) => Math.hypot(x - nodeX, y - nodeY) < 5.4);

  if (!inside) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  if (onLineA || onLineB || onNode) {
    return { r: 255, g: 255, b: 255, a: 255 };
  }

  if (inRing) {
    return { r: 48, g: 176, b: 189, a: 255 };
  }

  return { r: 0, g: 98, b: 115, a: 255 };
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const ax = x - x1;
  const ay = y - y1;
  const bx = x2 - x1;
  const by = y2 - y1;
  const lengthSquared = bx * bx + by * by;
  const t = Math.max(0, Math.min(1, (ax * bx + ay * by) / lengthSquared));
  const px = x1 + t * bx;
  const py = y1 + t * by;

  return Math.hypot(x - px, y - py);
}

function ihdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;

  return buffer;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function buildIco(png, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = width >= 256 ? 0 : width;
  entry[1] = height >= 256 ? 0 : height;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

function buildTemplateSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="28" fill="#000"/>
  <path d="M20 22 L43 34 L20 42" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="20" cy="22" r="6" fill="#fff"/>
  <circle cx="20" cy="42" r="6" fill="#fff"/>
  <circle cx="43" cy="34" r="6" fill="#fff"/>
</svg>
`;
}
