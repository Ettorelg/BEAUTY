const CACHE = "alpha-prenota-v2";
const ASSETS = ["/", "/brand/alpha-prenota-logo-v1.png", "/pwa/icon-192.png", "/pwa/icon-512.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/app/") || url.pathname === "/app") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { if (response.ok && ["style", "script", "image", "font"].includes(event.request.destination)) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone())); return response; })));
});
self.addEventListener("push",event=>{const data=event.data?.json()??{};event.waitUntil(self.registration.showNotification(data.title??"Alpha Prenota",{body:data.body??"Hai una nuova notifica",icon:data.icon??"/pwa/icon-192.png",badge:"/pwa/icon-192.png",data:{url:data.url??"/account"}}));});
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{const target=new URL(event.notification.data?.url??"/account",self.location.origin).href;const found=list.find(client=>client.url===target);return found?found.focus():clients.openWindow(target);}));});
