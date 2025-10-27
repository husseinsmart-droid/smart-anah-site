const CACHE = 'anah-reports-v2';
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // تجاهل أي طلبات خارجية (مثل Node-RED)
  if (url.origin !== self.location.origin) return;
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      '/reports/',
      '/reports/manifest.webmanifest'
    ]))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

