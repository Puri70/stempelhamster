/**
 * MS-Stempelhamster - Service Worker
 * Cache-First Strategie für vollständige Offline-Fähigkeit
 */

var CACHE_NAME = 'stempelhamster-v4';

var PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './css/variables.css',
    './css/style.css',
    './js/utils.js',
    './js/db.js',
    './js/daytype.js',
    './js/calculator.js',
    './js/timer.js',
    './js/corrections.js',
    './js/export.js',
    './js/settings.js',
    './js/views.js',
    './js/navigation.js',
    './js/app.js',
    './lib/dexie.min.js',
    './lib/jspdf.umd.min.js',
    './lib/jspdf.plugin.autotable.min.js',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Install: Alle Dateien vorab cachen
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(PRECACHE_URLS);
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// Activate: Alte Caches löschen
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return key !== CACHE_NAME;
                }).map(function(key) {
                    return caches.delete(key);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch: Cache-First
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            return cached || fetch(event.request).then(function(response) {
                // Dynamische Requests auch cachen
                if (response.ok) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        }).catch(function() {
            // Offline und nicht im Cache: Fallback
            if (event.request.destination === 'document') {
                return caches.match('./index.html');
            }
        })
    );
});
