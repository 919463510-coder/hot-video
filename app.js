/* =========================================================
 * 热门视频 PWA 主逻辑
 * - 多数据源依次尝试（抖音热榜 / B站热门视频）
 * - 降级链：在线接口 → 仓库每日快照 → 本地缓存
 * - 点击卡片跳转对应 App（通用链接）
 * ========================================================= */
(function () {
  'use strict';

  var N = window.HotNormalize;

  var LIMITS = { douyin: 20, bilibili: 10 };
  var SOURCES = {
    douyin: [
      { name: '今日热榜(DailyHotApi)', url: 'https://api-hot.imsyy.top/douyin' },
      { name: 'vvhan 热榜', url: 'https://api.vvhan.com/api/hotlist/douyinHot' }
    ],
    bilibili: [
      { name: '今日热榜(DailyHotApi)', url: 'https://api-hot.imsyy.top/bilibili' },
      { name: 'B站官方热门', url: 'https://api.bilibili.com/x/web-interface/popular?ps=10&pn=1' }
    ]
  };
  var SNAPSHOT = { douyin: 'data/douyin.json', bilibili: 'data/bilibili.json' };
  var CACHE_KEY = 'hot-video-cache-v1';
  var FRESH_MS = 30 * 60 * 1000; // 30 分钟内视为新鲜，不重复请求

  var els = {
    tabs: document.getElementById('tabs'),
    list: document.getElementById('list'),
    status: document.getElementById('status'),
    updateInfo: document.getElementById('updateInfo'),
    refreshBtn: document.getElementById('refreshBtn'),
    installBtn: document.getElementById('installBtn')
  };

  var current = 'douyin';
  var state = {
    douyin: { items: [], source: '', updateTime: '', error: '', loading: false, lastSuccess: 0 },
    bilibili: { items: [], source: '', updateTime: '', error: '', loading: false, lastSuccess: 0 }
  };
  var deferredPrompt = null;

  // ---------------- 工具 ----------------
  function nowStr() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
  }

  function fetchJSON(url, timeout) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeout || 12000);
    return fetch(url, { signal: ctrl.signal, credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        douyin: { items: state.douyin.items, source: state.douyin.source, updateTime: state.douyin.updateTime },
        bilibili: { items: state.bilibili.items, source: state.bilibili.source, updateTime: state.bilibili.updateTime }
      }));
    } catch (e) { /* 忽略存储失败 */ }
  }

  // ---------------- 状态横幅 ----------------
  function showStatus(msg, type) {
    els.status.hidden = false;
    els.status.className = 'status ' + (type || '');
    els.status.textContent = '';
    var span = document.createElement('span');
    span.textContent = msg;
    els.status.appendChild(span);
    if (type === 'warn' || type === 'error') {
      var btn = document.createElement('button');
      btn.className = 'retry';
      btn.type = 'button';
      btn.textContent = '重试';
      btn.addEventListener('click', function () { showPlatform(current, true); });
      els.status.appendChild(btn);
    }
  }

  function hideStatus() {
    els.status.hidden = true;
    els.status.className = 'status';
    els.status.textContent = '';
  }

  // ---------------- 渲染 ----------------
  function renderSkeleton() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 8; i++) {
      var c = document.createElement('div');
      c.className = 'sk-card skeleton';
      var r = document.createElement('div'); r.className = 'sk sk-rank';
      var co = document.createElement('div'); co.className = 'sk sk-cover';
      var box = document.createElement('div'); box.style.flex = '1';
      var l1 = document.createElement('div'); l1.className = 'sk sk-line w60';
      var l2 = document.createElement('div'); l2.className = 'sk sk-line w40';
      box.append(l1, l2);
      c.append(r, co, box);
      frag.appendChild(c);
    }
    els.list.replaceChildren(frag);
  }

  function renderEmpty(emoji, msg) {
    var d = document.createElement('div');
    d.className = 'empty';
    var big = document.createElement('div'); big.className = 'big'; big.textContent = emoji || '📭';
    var p = document.createElement('div'); p.textContent = msg || '暂无数据';
    d.append(big, p);
    els.list.replaceChildren(d);
  }

  function makeCard(platform, item) {
    var a = document.createElement('a');
    a.className = 'card';
    a.href = item.url || '#';
    a.target = '_blank';
    a.rel = 'noopener';

    var rank = document.createElement('div');
    rank.className = 'rank' + (item.rank <= 3 ? ' r' + item.rank : '');
    rank.textContent = item.rank;

    var cover = document.createElement('div');
    cover.className = 'cover';
    var ph = document.createElement('div');
    ph.className = 'ph';
    ph.textContent = '▶';
    cover.appendChild(ph);
    if (item.cover) {
      var img = new Image();
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = String(item.cover).replace(/^http:\/\//i, 'https://');
      img.onerror = function () { img.remove(); };
      cover.appendChild(img);
    }
    if (platform === 'bilibili') {
      if (item.duration) {
        var dur = document.createElement('span');
        dur.className = 'dur';
        dur.textContent = N.fmtDuration(item.duration);
        cover.appendChild(dur);
      }
    } else if (item.hot) {
      var hb = document.createElement('span');
      hb.className = 'hot-badge';
      hb.textContent = '🔥 ' + N.fmtNum(item.hot);
      cover.appendChild(hb);
    }

    var info = document.createElement('div');
    info.className = 'info';
    var title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.title;
    var meta = document.createElement('div');
    meta.className = 'meta';
    if (platform === 'bilibili') {
      if (item.views) {
        var v = document.createElement('b');
        v.textContent = N.fmtNum(item.views) + ' 播放';
        meta.appendChild(v);
      }
      if (item.danmaku) {
        var d2 = document.createElement('span');
        d2.textContent = '💬 ' + N.fmtNum(item.danmaku);
        meta.appendChild(d2);
      }
      if (item.author) {
        var au = document.createElement('span');
        au.textContent = 'UP ' + item.author;
        meta.appendChild(au);
      }
    } else {
      if (item.hot) {
        var h = document.createElement('b');
        h.textContent = '🔥 热度 ' + N.fmtNum(item.hot);
        meta.appendChild(h);
      }
      var go = document.createElement('span');
      go.textContent = '在抖音 App 查看';
      meta.appendChild(go);
    }
    info.append(title, meta);

    var arrow = document.createElement('div');
    arrow.className = 'arrow';
    arrow.textContent = '›';

    a.append(rank, cover, info, arrow);
    return a;
  }

  function render(platform) {
    var st = state[platform];
    if (st.items && st.items.length) {
      var frag = document.createDocumentFragment();
      st.items.forEach(function (it) { frag.appendChild(makeCard(platform, it)); });
      els.list.replaceChildren(frag);
      return;
    }
    if (st.loading) {
      renderSkeleton();
      return;
    }
    renderEmpty(st.error ? '😵' : '📭', st.error ? st.error + '，可点击右上角刷新重试' : '暂无数据，请点击右上角刷新');
  }

  function updateFooter(platform) {
    var st = state[platform];
    var t = st.updateTime || (st.lastSuccess ? new Date(st.lastSuccess).toLocaleString('zh-CN', { hour12: false }) : '—');
    els.updateInfo.textContent = '更新于 ' + t + ' · 数据源：' + (st.source || '—');
  }

  // ---------------- 数据加载 ----------------
  function loadPlatform(platform) {
    var st = state[platform];
    if (st.loading) return;
    st.loading = true;
    render(platform);

    var chain = SOURCES[platform].slice();
    var idx = 0;
    var done = false;

    function next() {
      if (done) return;
      if (idx >= chain.length) { onAllFailed(); return; }
      var src = chain[idx++];
      fetchJSON(src.url)
        .then(function (json) {
          var parsed = platform === 'douyin' ? N.parseDouyin(json) : N.parseBilibili(json);
          if (!parsed.items || !parsed.items.length) throw new Error('返回数据为空');
          st.items = parsed.items.slice(0, LIMITS[platform]);
          st.source = src.name;
          st.updateTime = parsed.updateTime || nowStr();
          st.error = '';
          st.lastSuccess = Date.now();
          done = true;
          saveCache();
          hideStatus();
          render(platform);
          updateFooter(platform);
        })
        .catch(function (e) {
          console.warn('[' + platform + '] ' + src.name + ' 失败: ' + e.message);
          next();
        });
    }

    function onAllFailed() {
      fetchJSON(SNAPSHOT[platform], 8000)
        .then(function (snap) {
          var parsed = platform === 'douyin' ? N.parseDouyin(snap) : N.parseBilibili(snap);
          if (!parsed.items || !parsed.items.length) throw new Error('快照为空');
          st.items = parsed.items.slice(0, LIMITS[platform]);
          st.source = '仓库每日快照';
          st.updateTime = parsed.updateTime || snap.fetchedAt || nowStr();
          st.error = '';
          st.lastSuccess = Date.now();
          saveCache();
          render(platform);
          updateFooter(platform);
          showStatus('在线接口暂时不可用，已展示每日快照', 'warn');
        })
        .catch(function () {
          if (st.items && st.items.length) {
            showStatus('在线获取失败，展示的是本地缓存内容', 'warn');
          } else {
            st.error = '获取数据失败';
            showStatus('获取数据失败，请检查网络后重试', 'error');
            render(platform);
          }
        })
        .finally(function () {
          st.loading = false;
          render(platform);
        });
    }

    next();
  }

  function showPlatform(platform, force) {
    var st = state[platform];
    var cache = loadCache();
    if (!st.items.length && cache && cache[platform] && cache[platform].items && cache[platform].items.length) {
      st.items = cache[platform].items.slice(0, LIMITS[platform]);
      st.source = (cache[platform].source || '缓存') + ' · 本地缓存';
      st.updateTime = cache[platform].updateTime || '';
    }
    render(platform);
    updateFooter(platform);
    var fresh = st.lastSuccess && (Date.now() - st.lastSuccess < FRESH_MS);
    if (fresh && !force) return;
    loadPlatform(platform);
  }

  // ---------------- 交互 ----------------
  function bindTabs() {
    els.tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab');
      if (!btn || btn.dataset.platform === current) return;
      current = btn.dataset.platform;
      var tabs = els.tabs.querySelectorAll('.tab');
      tabs.forEach(function (t) {
        var on = t.dataset.platform === current;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      showPlatform(current, false);
    });
  }

  function bindRefresh() {
    els.refreshBtn.addEventListener('click', function () {
      showPlatform(current, true);
    });
  }

  function bindInstall() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      els.installBtn.hidden = false;
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      els.installBtn.hidden = true;
    });
    els.installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        els.installBtn.hidden = true;
      });
    });
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      var okHost = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (okHost) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('sw.js').catch(function (e) {
            console.warn('Service Worker 注册失败:', e);
          });
        });
      }
    }
  }

  function bindAutoRefresh() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') showPlatform(current, false);
    });
    setInterval(function () {
      showPlatform(current, false);
    }, 60 * 60 * 1000);
  }

  // ---------------- 启动 ----------------
  bindTabs();
  bindRefresh();
  bindInstall();
  registerSW();
  bindAutoRefresh();
  showPlatform('douyin', false);
})();