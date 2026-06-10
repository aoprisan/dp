// DressPanic! service worker — cache-first app shell.
// Bump CACHE_VERSION whenever shell assets change to invalidate old caches.
const CACHE_VERSION = "dresspanic-v3";

// Paths are relative to the SW scope, so this works under any base path.
const APP_SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "js/db.js",
  "js/ui.js",
  "js/wardrobe.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "fonts/fonts.css",
  "fonts/fraunces-normal-latin.woff2",
  "fonts/fraunces-italic-latin.woff2",
  "fonts/fraunces-normal-latin-ext.woff2",
  "fonts/fraunces-italic-latin-ext.woff2",
  "fonts/instrumentsans-normal-latin.woff2",
  "fonts/instrumentsans-normal-latin-ext.woff2",
  "fonts/jetbrainsmono-normal-latin.woff2",
  "fonts/jetbrainsmono-normal-latin-ext.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // cache: "reload" bypasses the HTTP cache so a version bump always
      // precaches fresh copies, not heuristically-cached stale ones.
      .then((cache) =>
        cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" })))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Network-first for navigations so deploys are picked up; fall back to cache offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("index.html"))
    );
    return;
  }

  // Cache-first for static shell assets.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
