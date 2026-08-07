/* =========================================================
 * Service Worker：应用壳缓存 + 数据快照网络优先/离线回退
 * 注意：修改静态资源后请同步更新 CACHE 版本号
 * ========================================================= */
'use strict';

const CACHE = 'hot-video-shell-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './lib/normalize.js',
  './manifest.webmanifest',
  './icons/icon-96.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 数据快照：网络优先，失败回退缓存（离线可用）
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || Response.error()))
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(req).then(
      (m) =>
        m ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => caches.match('./index.html'))
    )
  );
});