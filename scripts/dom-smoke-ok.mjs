/* DOM 冒烟测试（成功路径）：模拟接口返回数据，验证卡片渲染、Tab 切换与本地缓存 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function makeEl(tag) {
  const el = {
    tagName: tag, children: [], style: {}, dataset: {}, hidden: false,
    className: '', textContent: '', innerHTML: '', href: '', target: '', rel: '', src: '',
    _listeners: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    setAttribute() {}, getAttribute() { return null; },
    appendChild(c) { if (c && c._frag) this.children.push(...c.children); else this.children.push(c); return c; },
    append(...cs) { cs.forEach((c) => { if (c && c._frag) this.children.push(...c.children); else this.children.push(c); }); },
    replaceChildren(...cs) { const out = []; cs.forEach((c) => { if (c && c._frag) out.push(...c.children); else out.push(c); }); this.children = out; },
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener() {},
    querySelectorAll() { return []; },
    closest() { return null; },
    remove() {},
    focus() {},
  };
  return el;
}

const ids = ['tabs', 'list', 'status', 'updateInfo', 'refreshBtn', 'installBtn'];
const elements = {};
ids.forEach((id) => (elements[id] = makeEl('div')));

globalThis.window = globalThis;
globalThis.addEventListener = function () {};
globalThis.document = {
  getElementById(id) { return elements[id] || makeEl('div'); },
  createElement(tag) { return makeEl(tag); },
  createDocumentFragment() { return { _frag: true, children: [], appendChild(c) { this.children.push(c); return c; } }; },
  addEventListener() {},
  visibilityState: 'visible',
};
Object.defineProperty(globalThis, 'location', { value: { protocol: 'https:', hostname: 'example.com', href: 'https://example.com/' }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker: undefined }, configurable: true });
const store = {};
globalThis.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
};
const mocks = {
  'https://api-hot.imsyy.top/douyin': {
    name: '抖音热榜', subtitle: '热点榜', update_time: '2026-08-07 20:00:00',
    data: [
      { title: '夏日新歌挑战赛', url: 'https://www.douyin.com/search/%E5%A4%8F%E6%97%A5', hot: 1234567, pic: 'https://p3.douyinpic.com/img/cover1.jpg' },
      { title: '奥运冠军采访', url: 'https://www.douyin.com/video/7123456789012345678', hot: 987654 },
    ],
  },
  'https://api-hot.imsyy.top/bilibili': {
    name: '哔哩哔哩', subtitle: '热门榜', update_time: '2026-08-07T12:00:00Z',
    data: [
      { id: 'BV1E84y1A7z2', title: '假如我的校园是一款RPG游戏！', pic: 'https://i2.hdslb.com/bfs/archive/a.jpg',
        owner: { mid: 1, name: '某UP主' }, data: { view: 4178745, danmaku: 4229, like: 616519 },
        url: 'https://b23.tv/BV1E84y1A7z2', mobileUrl: 'https://m.bilibili.com/video/BV1E84y1A7z2' },
      { bvid: 'BV1fe411g7F5', title: '官方热门视频一号', pic: 'http://i.hdslb.com/bfs/archive/b.jpg',
        owner: { mid: 2, name: '二号UP' }, stat: { view: 1000000, danmaku: 100, like: 50000 }, duration: 245,
        short_link_v2: 'https://b23.tv/abc' },
    ],
  },
};
globalThis.fetch = async (url) => {
  const u = String(url);
  if (mocks[u]) return { ok: true, status: 200, json: async () => mocks[u] };
  throw new Error('mock 404: ' + u);
};
globalThis.Image = class { constructor() { this.onerror = null; this.loading = ''; this.decoding = ''; } };
const realSetInterval = globalThis.setInterval;
globalThis.setInterval = () => 0;

globalThis.HotNormalize = require2(path.join(ROOT, 'lib', 'normalize.js'));
require2(path.join(ROOT, 'app.js'));
globalThis.setInterval = realSetInterval;

await new Promise((r) => setTimeout(r, 400));

function elText(el) { return el.textContent + ' | ' + el.children.map((c) => c.textContent).join(' | '); }
function cards() { return elements.list.children.filter((c) => /card/.test(c.className)); }

const dyCards = cards();
console.log('抖音卡片数:', dyCards.length, '首卡 class:', dyCards[0] && dyCards[0].className);
console.log('首卡 href:', dyCards[0] && dyCards[0].href);
console.log('页脚:', elements.updateInfo.textContent);
console.log('状态横幅:', JSON.stringify(elText(elements.status)));

let pass = true;
if (dyCards.length !== 2) { console.error('FAIL: 抖音卡片数应为 2'); pass = false; }
if (!dyCards[0].href || !/douyin\.com/.test(dyCards[0].href)) { console.error('FAIL: 卡片链接异常'); pass = false; }
if (!/数据源：今日热榜/.test(elements.updateInfo.textContent)) { console.error('FAIL: 页脚数据源未更新'); pass = false; }
const cacheRaw = Object.prototype.hasOwnProperty.call(store, 'hot-video-cache-v1') ? store['hot-video-cache-v1'] : '';
const cacheObj = cacheRaw ? JSON.parse(cacheRaw) : null;
if (!cacheObj || !cacheObj.douyin || cacheObj.douyin.items.length !== 2) { console.error('FAIL: 抖音缓存未写入'); pass = false; }

// 真正触发 Tab 切换（模拟 closest 返回 .tab）
const tabsHandler = (elements.tabs._listeners.click || [])[0];
if (tabsHandler) {
  const fakeBtn = makeEl('button');
  fakeBtn.dataset.platform = 'bilibili';
  fakeBtn.classList.add('tab');
  fakeBtn.closest = () => ({ dataset: { platform: 'bilibili' } });
  tabsHandler({ target: fakeBtn });
  await new Promise((r) => setTimeout(r, 400));
  const blCards = cards();
  console.log('B站卡片数:', blCards.length);
  console.log('B站首卡链接:', blCards[0] && blCards[0].href);
  console.log('B站页脚:', elements.updateInfo.textContent);
  if (blCards.length !== 2) { console.error('FAIL: B站卡片数应为 2'); pass = false; }
  if (!blCards[0].href || !/bilibili\.com|b23\.tv/.test(blCards[0].href)) { console.error('FAIL: B站卡片链接异常'); pass = false; }
  const cache2 = JSON.parse(store['hot-video-cache-v1'] || '{}');
  if (!cache2.bilibili || !cache2.bilibili.items || cache2.bilibili.items.length !== 2) {
    console.error('FAIL: B站缓存未写入'); pass = false;
  }
}

console.log('DOM 冒烟测试(成功路径): ' + (pass ? 'PASS ✅' : 'FAIL ❌'));
process.exit(pass ? 0 : 1);