const APP_VERSION = "1.1.0";
const CACHE_NAME = `miy-cykl-${APP_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles.css?v=1.1.0",
  "./app.js?v=1.1.0",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith("miy-cykl-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHTML(request) {
  return request.mode === "navigate" ||
    request.destination === "document" ||
    request.headers.get("accept")?.includes("text/html");
}

function isAppShellAsset(request) {
  return ["style", "script", "manifest", "image", "font"].includes(
    request.destination
  );
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never intercept external resources such as the PDF.
  if (url.origin !== self.location.origin) return;

  if (isHTML(event.request)) {
    // Network-first: deployed HTML always wins when online.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put("./index.html", copy);
          });
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (isAppShellAsset(event.request)) {
    // Cache-first for versioned static assets.
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });
          return response;
        });
      })
    );
  }
});
