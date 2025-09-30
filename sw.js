const CACHE_NAME = 'nexusplay-viewer-v1';
const urlsToCache = [
    '/',
    '/viewer.html',
    '/viewer.css',
    '/viewer.js',    
    '/firebase-config.js',
    '/manifest.json',
    '/assets/icons/generic-icon-192x192.png',
    '/assets/icons/generic-icon-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache abierto');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});