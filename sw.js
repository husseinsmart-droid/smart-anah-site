/* Smart Anah — Service Worker (كامل) */
const CACHE_NAME = "smart-anah-v1";
const PRECACHE = [
  "/",                          // الصفحة الرئيسية
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png"
];

// تفعيل Navigation Preload عند توفره
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    // حذف الكاشات القديمة
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// التثبيت + precache
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

// استراتيجية:
// - للطلبات الملاحية (HTML): شبكة أولاً ثم كاش كاحتياط.
// - للأصول الثابتة داخل نفس الأصل (icons/manifest/sw): كاش أولاً ثم شبكة للتحديث.
// - لبقية الطلبات: نحاول الشبكة، وإن فشلنا نرجع الكاش إن وجد.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // نتعامل فقط مع نفس المصدر (origin)
  const sameOrigin = url.origin === self.location.origin;

  // طلبات الملاحة (الصفحات)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        // استخدم navigation preload إن توفر
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const net = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
        return net;
      } catch (err) {
        // رجوع إلى نسخة الكاش أو الصفحة الرئيسية
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match("/"));
      }
    })());
    return;
  }

  // أصول ثابتة محلية (أيقونات/مانيفست/SW) — Cache First
  if (sameOrigin && (
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname === "/sw.js"
    )) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        cache.put(req, net.clone());
        return net;
      } catch (e) {
        return new Response("", { status: 504, statusText: "Gateway Timeout" });
      }
    })());
    return;
  }

  // باقي الطلبات — Network First مع fallback للكاش
  event.respondWith((async () => {
    try {
      const net = await fetch(req);
      if (sameOrigin && req.method === "GET") {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
      }
      return net;
    } catch (e) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      // للصور المفقودة مثلاً: رجّع 204 بدلاً من كسر الصفحة
      if (req.destination === "image") {
        return new Response("", { status: 204 });
      }
      // افتراضي
      return new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
