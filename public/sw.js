const CACHE = "alpha-prenota-v1";
const ASSETS = ["/", "/brand/alpha-prenota-logo-v1.png", "/pwa/icon-192.png", "/pwa/icon-512.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/app/") || url.pathname === "/app") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { if (response.ok && ["style", "script", "image", "font"].includes(event.request.destination)) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone())); return response; })));
});
