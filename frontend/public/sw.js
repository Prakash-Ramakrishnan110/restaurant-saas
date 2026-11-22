const CACHE_NAME = "servemyfood-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"]).catch(() => undefined))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept or cache API or media responses
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) return;

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
