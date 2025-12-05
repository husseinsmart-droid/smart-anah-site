/* Smart Anah — Service Worker (Fixed for Digital Twin) */

const CACHE_NAME = "smart-anah-v2";

// الملفات التي نريد أن يتجاوزها الـ SW ولا يعترضها
const BYPASS_EXT = [
  ".slpk", ".glb", ".gltf", ".bin", ".3tz", ".ktx2",
  ".jsonz", ".geopkg"
];

// الملفات التي نريد تخزينها مسبقاً
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/sw.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];

// التفعيل
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// التثبيت
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

// التعامل مع الطلبات
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // ❗ ملفات التوأم الرقمي يتم تجاوزها (لا كاش ولا اعتراض)
  for (const ext of BYPASS_EXT) {
    if (url.pathname.toLowerCase().endsWith(ext)) {
      event.respondWith(fetch(req));
      return;
    }
  }

  // تنقّلات HTML
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;

        const net = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
        return net;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || (await cache.match("/"));
      }
    })());
    return;
  }

  // الأيقونات وملفات PWA
  if (sameOrigin && (
    url.pathname.startsWith("/assets/icons/") ||
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
      } catch {
        return new Response("", { status: 504 });
      }
    })());
    return;
  }

  // باقي الملفات – Network First
  event.respondWith((async () => {
    try {
      const net = await fetch(req);
      if (sameOrigin && req.method === "GET") {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, net.clone());
      }
      return net;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      if (req.destination === "image")
        return new Response("", { status: 204 });

      return new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
