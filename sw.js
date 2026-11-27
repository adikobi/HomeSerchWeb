const CACHE = 'maman-v3';
const SHELL = ['./', './index.html', './styles.css', './manifest.json', './logo.svg',
  './js/app.js', './js/ui.js', './js/text.js', './js/data.js', './js/scanner.js',
  './js/excel.js', './js/lazy.js', './js/recipes-data.js'];
const STATIC_HOSTS = ['www.gstatic.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { if (res && (res.ok || res.type === 'opaque')) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // network-first so deployments show up immediately; cache is the offline fallback
    e.respondWith(
      fetch(req).then((r) => put(req, r)).catch(() =>
        caches.match(req).then((m) => m || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
  } else if (STATIC_HOSTS.includes(url.hostname)) {
    // stale-while-revalidate for libraries and fonts
    e.respondWith(caches.match(req).then((m) => {
      const net = fetch(req).then((r) => put(req, r)).catch(() => m);
      return m || net;
    }));
  }
});
