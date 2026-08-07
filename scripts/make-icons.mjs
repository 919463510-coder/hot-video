// 生成 PWA 图标（纯 Node 实现，无第三方依赖）
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '..', 'icons');

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 绘制 ----------
function roundedRectSDF(px, py, r) {
  const dx = Math.abs(px - 0.5) - (0.5 - r);
  const dy = Math.abs(py - 0.5) - (0.5 - r);
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
  return Math.sqrt(ox * ox + oy * oy) - r;
}

function mix(c1, c2, t) {
  return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
}

function distToSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)));
  const dx = ax + abx * t - px, dy = ay + aby * t - py;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointInTri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// 播放三角的 SDF（单位坐标 [0,1]）
function playSDF(px, py) {
  const ax = 0.5 - 0.11, ay = 0.54 - 0.17;
  const bx = 0.5 - 0.11, by = 0.54 + 0.17;
  const cx = 0.5 + 0.19, cy = 0.54;
  const inside = pointInTri(px, py, ax, ay, bx, by, cx, cy);
  const d = Math.min(
    distToSeg(px, py, ax, ay, bx, by),
    Math.min(distToSeg(px, py, bx, by, cx, cy), distToSeg(px, py, cx, cy, ax, ay))
  );
  return inside ? -d : d;
}

function makeIcon(size, ss = 4) {
  const S = size * ss;
  const rgba = Buffer.alloc(size * size * 4);
  const c1 = [255, 36, 66];   // #FF2442
  const c2 = [255, 159, 26];  // #FF9F1A
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = (x * ss + sx + 0.5) / S;
          const py = (y * ss + sy + 0.5) / S;
          const cover = Math.min(1, Math.max(0, 0.5 - roundedRectSDF(px, py, 0.22) * S));
          if (cover <= 0) continue;
          const grad = mix(c1, c2, (px + py) / 2);
          const pc = Math.min(1, Math.max(0, 0.5 - playSDF(px, py) * S));
          let pr = grad[0], pg = grad[1], pb = grad[2];
          if (pc > 0) {
            pr = pr + (255 - pr) * pc;
            pg = pg + (255 - pg) * pc;
            pb = pb + (255 - pb) * pc;
          }
          r += pr * cover; g += pg * cover; b += pb * cover; a += 255 * cover;
        }
      }
      const n = ss * ss;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = Math.round(a / n);
    }
  }
  return encodePNG(size, size, rgba);
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF2442"/>
      <stop offset="1" stop-color="#FF9F1A"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#g)"/>
  <path d="M216 168 L352 256 L216 344 Z" fill="#ffffff"/>
</svg>`;

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
const tasks = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['icon-180.png', 180],
  ['icon-96.png', 96],
];
for (const [name, size] of tasks) {
  const buf = makeIcon(size, size >= 180 ? 4 : 6);
  fs.writeFileSync(path.join(iconsDir, name), buf);
  console.log(`生成 ${name} (${size}x${size}) ${buf.length} bytes`);
}
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), faviconSvg, 'utf8');
console.log('生成 favicon.svg');