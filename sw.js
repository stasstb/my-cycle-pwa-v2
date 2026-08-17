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

  // Обработка отправки уведомлений
  if (event.data?.type === "SEND_NOTIFICATION") {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: "./icons/icon-192.svg",
      badge: "./icons/icon-192.svg",
      ...options
    }).catch(error => {
      console.error("Ошибка при отправке уведомления через SW:", error);
    });
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

// Обработка клика на уведомление
self.addEventListener("notificationclick", event => {
  event.notification.close();

  // Открыть или сфокусировать приложение при клике на уведомление
  event.waitUntil(
    clients.matchAll({ type: "window" })
      .then(clientList => {
        // Если окно приложения уже открыто, сфокусировать его
        for (let client of clientList) {
          if (client.url === "/" || client.url.includes("index.html")) {
            return client.focus();
          }
        }
        // Если не открыто, открыть новое окно
        if (clients.openWindow) {
          return clients.openWindow("./");
        }
      })
  );
});

// Логирование закрытия уведомления
self.addEventListener("notificationclose", event => {
  console.log("📬 Уведомление закрыто:", event.notification.tag);
});
