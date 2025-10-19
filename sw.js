// sw.js
const CACHE = 'anah-v2';   // <-- غيّر الرقم كلما حدثت الموقع
const ASSETS = [
  '/', '/styles.css', '/manifest.json',
  '/dashboard/', '/city3d/', '/opendata/'
];

// تثبيت
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting(); // فعّل التحديث فورًا
});

// تفعيل
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k)))
    )
  );
  self.clients.claim(); // سيطر على كل الصفحات مباشرة
});

// جلب
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request).catch(()=> caches.match('/')))
    );
  }
});
