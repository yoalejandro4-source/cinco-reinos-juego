/* Service worker de la versión web: hace que el juego se pueda instalar como app en la PC
 * y el celular. Siempre pide primero la versión nueva a internet; si no hay conexión usa
 * la copia guardada. Los videos no se guardan (son grandes y el navegador los pide en partes). */
'use strict';
const CACHE = 'cinco-reinos-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // el servidor online y las fuentes van directo
  if (url.pathname.endsWith('.mp4') || req.headers.has('range')) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) {
      const copia = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => { /* sin espacio: se juega igual */ });
    }
    return res;
  }).catch(() => caches.match(req).then((r) => r || Response.error())));
});
