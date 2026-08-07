/* DOM 冒烟测试：在 Node 中用最小 DOM 桩运行 app.js，验证断网场景不崩溃 */
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
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
};
globalThis.fetch = async () => { throw new Error('test: 网络不可用'); };
globalThis.Image = class { constructor() { this.onerror = null; this.loading = ''; this.decoding = ''; } };
const realSetInterval = globalThis.setInterval;
globalThis.setInterval = () => 0;

// 加载解析器与主逻辑
globalThis.HotNormalize = require2(path.join(ROOT, 'lib', 'normalize.js'));
require2(path.join(ROOT, 'app.js'));
globalThis.setInterval = realSetInterval;

// 等所有异步降级链走完
await new Promise((r) => setTimeout(r, 400));

function elText(el) {
  return el.textContent + ' | ' + el.children.map((c) => c.textContent).join(' | ');
}

const statusText = elText(elements.status);
console.log('启动后状态横幅:', JSON.stringify(statusText));
const listChildren = elements.list.children;
console.log('列表渲染节点数:', listChildren.length, '首个节点 class:', listChildren[0] && listChildren[0].className);

let pass = true;
if (!/获取数据失败/.test(statusText)) { console.error('FAIL: 未显示错误状态'); pass = false; }
if (listChildren.length === 0 || !/empty/.test(listChildren[0].className)) { console.error('FAIL: 未渲染空态'); pass = false; }

// 模拟切换到 B站 Tab
const tabsHandler = (elements.tabs._listeners.click || [])[0];
if (tabsHandler) {
  const fakeBtn = makeEl('button');
  fakeBtn.dataset.platform = 'bilibili';
  fakeBtn.classList.add('tab');
  tabsHandler({ target: fakeBtn });
  await new Promise((r) => setTimeout(r, 400));
  console.log('切换到 bilibili 后状态横幅:', JSON.stringify(elText(elements.status)));
}

// 模拟点击刷新
const refreshHandler = (elements.refreshBtn._listeners.click || [])[0];
if (refreshHandler) { refreshHandler(); await new Promise((r) => setTimeout(r, 400)); }

console.log('DOM 冒烟测试: ' + (pass ? 'PASS ✅' : 'FAIL ❌'));
process.exit(pass ? 0 : 1);