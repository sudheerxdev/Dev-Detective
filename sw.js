const CACHE_NAME = "devdetective-v5";

const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./src/main.js",
    "./src/config/constants.js",
    "./src/ui/elements.js",
    "./src/ui/render.js",
    "./src/ui/charts.js",
    "./src/report/markdown.js",
    "./src/utils/core.js",
    "./manifest.json",
    "./Images/logo.png",
    "./Images/favicon-32x32.png",
    "./Images/favicon-16x16.png",
    "./Images/favicon.ico",
    "./Images/apple-touch-icon.png",
    "./Images/android-chrome-192x192.png",
    "./Images/android-chrome-512x512.png",
    "./Images/mascot-detective.svg",
    "./Images/sun-icon.svg",
    "./Images/moon-icon.svg",
    "./Images/search-icon.svg"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") || url.origin === "https://api.github.com") {
        event.respondWith(fetch(request));
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }

            return fetch(request).then((response) => {
                const isStatic =
                    url.origin === self.location.origin &&
                    ["document", "script", "style", "image", "font"].includes(request.destination);

                if (isStatic && response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                }

                return response;
            });
        })
    );
});
