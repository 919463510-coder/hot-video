/* =========================================================
 * 每日热门快照抓取脚本（Node 18+，GitHub Actions 定时运行）
 * 结果写入 data/douyin.json 与 data/bilibili.json，供页面离线/降级使用
 * ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { parseDouyin, parseBilibili } = require('../lib/normalize.js');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const TIMEOUT_MS = 20000;
const MAX_RETRY = 2;

const SOURCES = {
  douyin: [
    { name: '今日热榜(DailyHotApi)', url: 'https://api-hot.imsyy.top/douyin' },
    { name: 'vvhan 热榜', url: 'https://api.vvhan.com/api/hotlist/douyinHot' },
  ],
  bilibili: [
    { name: '今日热榜(DailyHotApi)', url: 'https://api-hot.imsyy.top/bilibili' },
    { name: 'B站官方热门', url: 'https://api.bilibili.com/x/web-interface/popular?ps=10&pn=1' },
  ],
};
const LIMITS = { douyin: 20, bilibili: 10 };

async function fetchJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url) {
  let lastErr;
  for (let i = 0; i < MAX_RETRY; i++) {
    try {
      return await fetchJSON(url);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

async function fetchPlatform(platform, parser) {
  const errors = [];
  for (const src of SOURCES[platform]) {
    try {
      const json = await fetchWithRetry(src.url);
      const parsed = parser(json);
      if (!parsed.items || !parsed.items.length) throw new Error('返回数据为空');
      console.log(`[${platform}] 数据源 ${src.name} 成功，${parsed.items.length} 条`);
      return { ...parsed, source: src.name, sourceUrl: src.url };
    } catch (e) {
      errors.push(`${src.name}: ${e.message}`);
      console.warn(`[${platform}] 数据源 ${src.name} 失败: ${e.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

function writeSnapshot(platform, title, result) {
  const snapshot = {
    platform,
    title,
    source: result.source,
    sourceUrl: result.sourceUrl,
    fetchedAt: new Date().toISOString(),
    updateTime: result.updateTime || '',
    items: result.items.slice(0, LIMITS[platform]),
  };
  fs.writeFileSync(path.join(DATA_DIR, platform + '.json'), JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`[${platform}] 快照已写入 data/${platform}.json（${snapshot.items.length} 条，来源 ${result.source}）`);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  let failed = 0;

  try {
    const r = await fetchPlatform('douyin', parseDouyin);
    writeSnapshot('douyin', '抖音热榜', r);
  } catch (e) {
    failed++;
    console.error(`[douyin] 全部数据源失败: ${e.message}`);
  }

  try {
    const r = await fetchPlatform('bilibili', parseBilibili);
    writeSnapshot('bilibili', 'B站热门视频', r);
  } catch (e) {
    failed++;
    console.error(`[bilibili] 全部数据源失败: ${e.message}`);
  }

  if (failed) {
    console.warn(`本次有 ${failed} 个平台抓取失败，已保留原快照。`);
    return;
  }
  console.log('全部完成 ✅');
}

// 允许被测试脚本直接调用
module.exports = { main, fetchPlatform, SOURCES };

if (require.main === module) {
  main();
}