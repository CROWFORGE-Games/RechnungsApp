const STATIC_CACHE = "rechnungsapp-static-v44";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/assets/KaindlLogo.png",
  "/assets/KaindlBanner.png",
  "/assets/app-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  const isAppShellAsset =
    requestUrl.origin === self.location.origin &&
    ["/", "/index.html", "/styles.css", "/app.js", "/manifest.webmanifest"].includes(
      requestUrl.pathname
    );

  const isBrandAsset =
    requestUrl.origin === self.location.origin &&
    ["/assets/KaindlLogo.png", "/assets/KaindlBanner.png"].includes(requestUrl.pathname);

  if (isAppShellAsset || isBrandAsset) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
        return networkResponse;
      });
    })
  );
});
