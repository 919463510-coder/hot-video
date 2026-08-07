/* 端到端冒烟测试：模拟数据跑快照脚本 + 本地静态服务资源检查 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- Part A: 模拟 fetch 跑快照脚本 ----------
const mocks = {
  'https://api-hot.imsyy.top/douyin': {
    name: '抖音热榜', subtitle: '热点榜', update_time: '2026-08-07 20:00:00',
    data: [
      { title: '夏日新歌挑战赛', url: 'https://www.douyin.com/search/%E5%A4%8F%E6%97%A5', hot: 1234567 },
      { title: '奥运冠军采访', url: 'https://www.douyin.com/video/7123456789012345678', hot: 987654 },
      { title: '城市夜景大片', url: 'https://www.douyin.com/video/7123456789012345679', hot: 654321 }
    ]
  },
  'https://api.bilibili.com/x/web-interface/popular?ps=10&pn=1': {
    code: 0, message: '0', data: { list: [
      { bvid: 'BV1fe411g7F5', title: '官方热门视频一号', pic: 'http://i.hdslb.com/bfs/archive/a.jpg',
        owner: { mid: 2, name: '测试UP' }, stat: { view: 1000000, danmaku: 100, like: 50000 }, duration: 245,
        short_link_v2: 'https://b23.tv/abc' },
      { bvid: 'BV1xx411g7F6', title: '官方热门视频二号', pic: 'https://i.hdslb.com/bfs/archive/b.jpg',
        owner: { mid: 3, name: '二号UP' }, stat: { view: 800000, danmaku: 80, like: 40000 }, duration: 90 }
    ] }
  }
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (mocks[u]) {
    return { ok: true, status: 200, json: async () => mocks[u] };
  }
  throw new Error('mock 网络错误: ' + u); // vvhan / DailyHotApi bilibili 模拟失败，验证降级
};

const require2 = createRequire(import.meta.url);
const snap = require2(path.join(__dirname, 'fetch-snapshot.cjs'));
await snap.main();
globalThis.fetch = realFetch;

const dy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'douyin.json'), 'utf8'));
const bl = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'bilibili.json'), 'utf8'));
console.log('[Part A] douyin: items=' + dy.items.length + ' source=' + dy.source + ' first=' + dy.items[0].title);
console.log('[Part A] bilibili: items=' + bl.items.length + ' source=' + bl.source + ' first=' + bl.items[0].title);
let passA = true;
if (dy.items.length !== 3 || dy.source !== '今日热榜(DailyHotApi)') { console.error('FAIL douyin snapshot'); passA = false; }
if (bl.items.length !== 2 || bl.source !== 'B站官方热门') { console.error('FAIL bilibili snapshot'); passA = false; }
// 恢复种子文件（避免把模拟数据留在交付物中）
const seed = (platform, title) => JSON.stringify({ platform, title, source: 'seed', sourceUrl: '', fetchedAt: '', updateTime: '', items: [] }, null, 2);
fs.writeFileSync(path.join(ROOT, 'data', 'douyin.json'), seed('douyin', '抖音热榜') + '\n');
fs.writeFileSync(path.join(ROOT, 'data', 'bilibili.json'), seed('bilibili', 'B站热门视频') + '\n');

// ---------- Part B: 本地静态服务资源检查 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.yml': 'text/plain',
  '.cjs': 'text/plain', '.mjs': 'text/plain'
};
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (p === '/') p = '/index.html';
  const fp = path.normalize(path.join(ROOT, p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;
const assets = ['/', '/index.html', '/style.css', '/app.js', '/lib/normalize.js', '/manifest.webmanifest',
  '/sw.js', '/icons/icon-96.png', '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/favicon.svg', '/data/douyin.json', '/data/bilibili.json', '/README.md'];
let failB = 0;
for (const a of assets) {
  const r = await fetch(base + a);
  const ct = r.headers.get('content-type') || '';
  console.log('[Part B] ' + r.status + ' ' + a + ' → ' + ct);
  if (r.status !== 200) failB++;
}
server.close();
console.log('Part A: ' + (passA ? 'PASS ✅' : 'FAIL ❌'));
console.log('Part B: ' + (failB === 0 ? 'PASS ✅ (全部 200)' : 'FAIL ❌ (' + failB + ' 个失败)'));
process.exit(passA && failB === 0 ? 0 : 1);