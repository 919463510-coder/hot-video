/* =========================================================
 * 热门数据通用解析器（UMD：浏览器 <script> 与 Node 快照脚本共用）
 * 兼容 DailyHotApi / vvhan / B站官方 popular 等多种返回结构
 * 暴露：HotNormalize.parseDouyin / parseBilibili / fmtNum / fmtDuration
 * ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HotNormalize = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  // 按候选键名依次取值
  function pick(obj, keys) {
    if (!isObj(obj)) return undefined;
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  }

  function num(v) {
    if (typeof v === 'string') v = parseFloat(v.replace(/[,，\s]/g, ''));
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // 从包裹层中提取数组（兼容 data / data.list / list / result / items ...）
  function extractArray(root) {
    if (Array.isArray(root)) return root;
    if (!isObj(root)) return [];
    let arr = root.data;
    if (Array.isArray(arr)) return arr;
    if (isObj(arr) && Array.isArray(arr.list)) return arr.list;
    if (isObj(arr) && Array.isArray(arr.items)) return arr.items;
    if (isObj(arr) && Array.isArray(arr.vlist)) return arr.vlist;
    if (Array.isArray(root.list)) return root.list;
    if (Array.isArray(root.result)) return root.result;
    if (Array.isArray(root.items)) return root.items;
    if (Array.isArray(root.news)) return root.news;
    return [];
  }

  function getUpdateTime(root) {
    return pick(root, ['update_time', 'updateTime', 'updated_at', 'fetchedAt', 'time']) || '';
  }

  function getTitle(root) {
    return pick(root, ['title', 'name', 'subtitle']) || '';
  }

  function ownerName(it) {
    const o = it && it.owner;
    if (isObj(o)) return pick(o, ['name', 'nickname', 'uname']) || '';
    return pick(it, ['author', 'up', 'name', 'user_name', 'nickname']) || '';
  }

  function coverOf(it) {
    return pick(it, ['pic', 'cover', 'thumbnail', 'item_cover', 'image', 'img', 'avatar', 'head']) || '';
  }

  // ---------------- 抖音 ----------------
  // DailyHotApi: { title, url, hot }
  // vvhan:       { title, url, hot }
  // 兜底：按标题构造抖音搜索/话题链接
  function douyinUrlOf(it, title) {
    const u = pick(it, ['url', 'mobileUrl', 'mobil_url', 'share_url', 'link', 'video_url']);
    if (u && /^https?:\/\//i.test(String(u))) return u;
    if (title) return 'https://www.douyin.com/search/' + encodeURIComponent(String(title).replace(/^【热】|（热）|\[热\]/g, ''));
    return '';
  }

  function parseDouyin(root) {
    const raw = extractArray(root);
    const items = [];
    raw.forEach(function (it, idx) {
      if (!isObj(it)) return;
      const title = String(pick(it, ['title', 'word', 'name', 'hot_word', 'keyword']) || '').trim();
      if (!title) return;
      const hot = num(pick(it, ['hot', 'hot_value', 'heat', 'hotScore', '热度', 'value']));
      items.push({
        platform: 'douyin',
        rank: idx + 1,
        title: title,
        url: douyinUrlOf(it, title),
        cover: coverOf(it),
        author: ownerName(it),
        hot: hot,
        views: num(pick(it, ['view', 'play', 'play_count', 'video_count'])),
        desc: String(pick(it, ['desc', 'summary', 'content']) || '').trim(),
      });
    });
    return { title: getTitle(root) || '抖音热榜', updateTime: getUpdateTime(root), items: items };
  }

  // ---------------- 哔哩哔哩 ----------------
  // DailyHotApi: { id/BV..., title, desc, pic, owner:{name}, data:{view,danmaku,like}, url, mobileUrl }
  // 官方 popular: { bvid, title, pic, owner:{name}, stat:{view,danmaku,like}, duration, short_link_v2 }
  function biliUrlOf(it) {
    const u = pick(it, ['url', 'mobileUrl', 'short_link_v2', 'short_link', 'link']);
    if (u && /^https?:\/\//i.test(String(u))) return u;
    const id = it.bvid || it.id;
    if (typeof id === 'string' && /^BV/i.test(id)) return 'https://www.bilibili.com/video/' + id;
    const aid = it.aid || (isObj(it.data) && it.data.aid) || (typeof id === 'number' ? id : 0);
    if (aid) return 'https://www.bilibili.com/video/av' + aid;
    return '';
  }

  function statOf(it, key) {
    if (isObj(it.stat)) return num(it.stat[key]);
    if (isObj(it.data) && it.data !== it.stat) return num(pick(it.data, [key]));
    return num(pick(it, [key]));
  }

  function parseBilibili(root) {
    const raw = extractArray(root);
    const items = [];
    raw.forEach(function (it, idx) {
      if (!isObj(it)) return;
      const title = String(pick(it, ['title', 'name']) || '').trim();
      if (!title) return;
      items.push({
        platform: 'bilibili',
        rank: idx + 1,
        title: title,
        url: biliUrlOf(it),
        cover: coverOf(it),
        author: ownerName(it),
        hot: num(pick(it, ['hot', 'score', 'heat'])),
        views: statOf(it, 'view'),
        danmaku: statOf(it, 'danmaku'),
        like: statOf(it, 'like'),
        duration: num(it.duration || pick(it, ['duration', 'length'])),
        desc: String(pick(it, ['desc', 'description']) || '').trim(),
      });
    });
    return { title: getTitle(root) || 'B站热门视频', updateTime: getUpdateTime(root), items: items };
  }

  // ---------------- 格式化 ----------------
  function fmtNum(n) {
    n = num(n);
    if (n <= 0) return '';
    if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万';
    return String(Math.round(n));
  }

  function fmtDuration(sec) {
    sec = num(sec);
    if (sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  return { parseDouyin, parseBilibili, extractArray, fmtNum, fmtDuration, num };
});