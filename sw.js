/* =============================================================================
 * sw.js — 單字探險家 Service Worker
 * -----------------------------------------------------------------------------
 * 目的：
 *   1. 讓網站可以被「安裝」成 App（PWA 的必要條件之一）。
 *   2. 把 App 外殼（HTML／圖示／manifest）快取起來，斷網時仍能開啟並使用
 *      離線備援語料；連網時照常即時查詢。
 *
 * 策略：
 *   - 導覽請求        → network-first，失敗時回快取的 index.html（離線可用）
 *   - Tailwind CDN    → cache-first + 背景更新（第一次載入後就不再依賴網路）
 *   - 同源靜態資源    → stale-while-revalidate
 *   - 字典／翻譯 API  → 「完全不攔截」，交給瀏覽器直連
 *     （App 自己在 localStorage 有 30 天查詢快取，不需要 SW 再包一層）
 *
 * 改版時請把 VERSION 往上加，舊快取會在 activate 時自動清掉。
 * ========================================================================== */

const VERSION = 'v5';
const SHELL_CACHE = 'word-explorer-shell-' + VERSION;
const CDN_CACHE = 'word-explorer-cdn-' + VERSION;

/* App 外殼：離線時要能完整開起來的檔案 */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './privacy-policy.html',
  './icons/favicon-48.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

/* 需要快取的外部 CDN（Tailwind） */
const CDN_HOSTS = ['cdn.tailwindcss.com'];

/* -----------------------------------------------------------------------------
 * install：逐一快取外殼檔案（個別失敗不影響整體安裝）
 * -------------------------------------------------------------------------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL_ASSETS.map(async url => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        // 某個檔案不存在（例如還沒建立 privacy-policy.html）不該讓整個 App 裝不起來
        console.warn('[SW] 略過無法快取的資源：' + url, err);
      }
    }));
    await self.skipWaiting();
  })());
});

/* -----------------------------------------------------------------------------
 * activate：清掉舊版本快取，立刻接管頁面
 * -------------------------------------------------------------------------- */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => {
      if (key !== SHELL_CACHE && key !== CDN_CACHE) {
        console.log('[SW] 刪除舊快取：' + key);
        return caches.delete(key);
      }
      return Promise.resolve(false);
    }));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch (e) { /* 忽略 */ }
    }
    await self.clients.claim();
  })());
});

/* -----------------------------------------------------------------------------
 * 工具
 * -------------------------------------------------------------------------- */
function offlineResponse(message) {
  return new Response(message || '目前離線，且這個資源沒有快取。', {
    status: 504,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** 網路優先；失敗時退回快取 */
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      // 導覽請求的回應改存到固定的 index.html 鍵，離線時才找得到
      cache.put(fallbackUrl || request, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackUrl || request, { ignoreSearch: true });
    if (hit) return hit;
    const root = await cache.match('./index.html');
    if (root) return root;
    return offlineResponse('目前離線。請先連上網路開啟一次，之後就能離線使用。');
  }
}

/** 快取優先，背景順便更新（CDN 資源用） */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  if (hit) return hit;
  return (await network) || offlineResponse();
}

/** 先回快取，同時背景更新（同源靜態資源用） */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && res.ok) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  if (hit) return hit;
  return (await network) || offlineResponse();
}

/* -----------------------------------------------------------------------------
 * fetch
 * -------------------------------------------------------------------------- */
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // 只處理 http / https（chrome-extension 之類一律放行）
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* 1) 頁面導覽：乾淨的 network-first，離線時用快取的外殼開起來 */
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, './index.html'));
    return;
  }

  /* 2) Tailwind CDN：第一次抓到之後就幾乎不再需要網路 */
  if (CDN_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith(cacheFirst(request, CDN_CACHE));
    return;
  }

  /* 3) 同源靜態資源（HTML／圖示／manifest）：先回快取再背景更新 */
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  /* 4) 其他跨網域（Wiktionary／Datamuse／Google 翻譯／MyMemory）
   *    → 不呼叫 respondWith，完全不攔截，讓瀏覽器直連，
   *      以免影響 CORS 與 App 自己的快取邏輯。 */
});

/* -----------------------------------------------------------------------------
 * 讓頁面可以主動要求新版 SW 立刻接手
 * -------------------------------------------------------------------------- */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
