const CACHE_NAME = "imperio-v3";

const BASE = "/IMPERIO_AUTONOMO_GESTOR/";

const FILES = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.json",
  BASE + "icon-192.png",
  BASE + "icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
