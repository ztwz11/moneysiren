import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const iconDir = resolve(repoRoot, "apps/tray/src-tauri/icons");
const traySize = 64;
const appSize = 512;
const appIcoSizes = [16, 20, 24, 32, 48, 64, 128, 256];
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

mkdirSync(iconDir, { recursive: true });

const trayPng = buildPng(traySize, traySize);
const appPng = buildPng(appSize, appSize);
writeFileSync(resolve(iconDir, "tray.png"), trayPng);
writeFileSync(resolve(iconDir, "tray.ico"), buildIco([{ png: trayPng, width: traySize, height: traySize }]));
writeFileSync(resolve(iconDir, "app-icon.png"), appPng);
writeFileSync(
  resolve(iconDir, "app-icon.ico"),
  buildIco(appIcoSizes.map((iconSize) => ({ png: buildPng(iconSize, iconSize), width: iconSize, height: iconSize }))),
);
writeFileSync(resolve(iconDir, "tray-template.svg"), buildTemplateSvg(), "utf8");

console.log(`Generated tray icons in ${iconDir}`);

function buildPng(width, height) {
  const data = Buffer.alloc((width * 4 + 1) * height);
  const samplesPerAxis = 4;
  const sampleCount = samplesPerAxis * samplesPerAxis;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    data[rowOffset] = 0;

    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      let alpha = 0;
      let premultipliedRed = 0;
      let premultipliedGreen = 0;
      let premultipliedBlue = 0;

      for (let sampleY = 0; sampleY < samplesPerAxis; sampleY += 1) {
        for (let sampleX = 0; sampleX < samplesPerAxis; sampleX += 1) {
          const color = pixelColor(
            x + (sampleX + 0.5) / samplesPerAxis,
            y + (sampleY + 0.5) / samplesPerAxis,
            width,
            height,
          );
          const sampleAlpha = color.a / 255;
          alpha += sampleAlpha;
          premultipliedRed += color.r * sampleAlpha;
          premultipliedGreen += color.g * sampleAlpha;
          premultipliedBlue += color.b * sampleAlpha;
        }
      }

      const averageAlpha = alpha / sampleCount;
      data[pixelOffset] = alpha === 0 ? 0 : Math.round(premultipliedRed / alpha);
      data[pixelOffset + 1] = alpha === 0 ? 0 : Math.round(premultipliedGreen / alpha);
      data[pixelOffset + 2] = alpha === 0 ? 0 : Math.round(premultipliedBlue / alpha);
      data[pixelOffset + 3] = Math.round(averageAlpha * 255);
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
  const scaleX = width / 64;
  const scaleY = height / 64;
  const px = x / scaleX;
  const py = y / scaleY;

  if (!insideRoundedRect(px, py, 2, 2, 60, 60, 13)) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const darkTeal = { r: 0, g: 90, b: 109, a: 255 };
  const cyan = { r: 66, g: 199, b: 217, a: 255 };
  const amber = { r: 242, g: 160, b: 0, a: 255 };
  const warmWhite = { r: 251, g: 250, b: 247, a: 255 };
  const dx = px - 32;
  const dy = py - 32.5;
  const radius = Math.hypot(dx, dy);
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (angle < 0) {
    angle += 360;
  }
  if (angle < 150) {
    angle += 360;
  }

  const inGaugeArc = radius >= 14.5 && radius <= 20 && angle >= 150 && angle <= 390;
  const inBase = insideRoundedRect(px, py, 10.5, 40.5, 43, 6, 1.6);
  const inNeedle = insideTriangle(px, py, 30.4, 32.6, 33.7, 35, 43.2, 21.2);
  const inHub = Math.hypot(px - 32, py - 33.2) <= 3.3;
  const inClapper = Math.hypot(px - 32, py - 49.2) <= 4.2 && py >= 47.2;

  if (inClapper) {
    return amber;
  }
  if (inBase) {
    return warmWhite;
  }
  if (inNeedle || inHub) {
    return cyan;
  }
  if (inGaugeArc) {
    return angle >= 330 ? amber : cyan;
  }

  return darkTeal;
}

function insideRoundedRect(x, y, left, top, width, height, radius) {
  const right = left + width;
  const bottom = top + height;
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));

  return x >= left && x <= right && y >= top && y <= bottom && Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function insideTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = triangleSign(px, py, ax, ay, bx, by);
  const d2 = triangleSign(px, py, bx, by, cx, cy);
  const d3 = triangleSign(px, py, cx, cy, ax, ay);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;

  return !(hasNegative && hasPositive);
}

function triangleSign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
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

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let imageOffset = header.length + images.length * 16;
  const entries = images.map(({ png, width, height }) => {
    const entry = Buffer.alloc(16);
    entry[0] = width >= 256 ? 0 : width;
    entry[1] = height >= 256 ? 0 : height;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(imageOffset, 12);
    imageOffset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

function buildTemplateSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="13" fill="#005A6D"/>
  <path d="M15.9 42.5 A17.5 17.5 0 0 1 45.3 19.1" fill="none" stroke="#42C7D9" stroke-width="5.5"/>
  <path d="M45.3 19.1 A17.5 17.5 0 0 1 48.1 42.5" fill="none" stroke="#F2A000" stroke-width="5.5"/>
  <rect x="10.5" y="40.5" width="43" height="6" rx="1.6" fill="#FBFAF7"/>
  <path d="M30.4 32.6 L33.7 35 L43.2 21.2 Z" fill="#42C7D9"/>
  <circle cx="32" cy="33.2" r="3.3" fill="#42C7D9"/>
  <path d="M27.8 49.2 A4.2 4.2 0 0 0 36.2 49.2 L36.2 47.2 L27.8 47.2 Z" fill="#F2A000"/>
</svg>
`;
}
