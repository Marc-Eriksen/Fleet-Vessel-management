// OCEANHUB service worker: makes the app installable and lets the shell
// open offline. Data still comes live from Firebase, which is never cached.
const CACHE = 'ocean-hub-v8';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './privacy.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './contractors/',
  './contractors/index.html',
  './contractors/manifest.webmanifest',
  './contractors/icons/icon-192.png',
  './contractors/icons/icon-512.png',
  './contractors/icons/icon-maskable-512.png',
  './contractors/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Same-origin: network first so updates show up immediately, cache as fallback.
  // 'no-cache' revalidates with the server instead of reusing the browser's HTTP cache
  // (GitHub Pages allows 10 minutes), so a reload right after a deploy gets the new app.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(hit => hit || (req.mode === 'navigate'
            ? caches.match(url.pathname.includes('/contractors/') ? './contractors/index.html' : './index.html')
            : undefined)))
    );
    return;
  }

  // Static CDN libraries and fonts: cache first. Firebase/auth traffic passes through untouched.
  const cdn = ['www.gstatic.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  if (cdn.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }))
    );
  }
});
