// ============================================================================
// Service worker del cotizador.
//
// Estrategia deliberada:
//   - HTML, JS y CSS van por RED PRIMERO. Un deploy tiene que llegar al
//     dispositivo de inmediato; una caché agresiva sobre el código es la forma
//     más rápida de que alguien quede usando una versión vieja sin enterarse.
//     La caché sólo entra como respaldo si no hay red.
//   - Las imágenes van por CACHÉ PRIMERO: pesan y no cambian.
//   - Todo lo que no sea del mismo origen (Supabase, Google Fonts, el CDN) pasa
//     de largo sin tocarse. Cachear respuestas de la API daría datos viejos.
// ============================================================================

const CACHE = 'terra-cotizador-v1';

const SHELL = [
  './',
  './index.html',
  './app.js',
  './config.js',
  './ui.css',
  './documento.css',
  './manifest.webmanifest',
  '/images/logo_terraconcept.png',
  '/images/cotizador/piscina.jpg',
  '/images/cotizador/pastelones.jpg',
  '/images/cotizador/adoquines.jpg',
  '/images/cotizador/fachaletas.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Si algún archivo falla no se cae la instalación completa.
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const esImagen = (url) =>
  /\.(png|jpe?g|svg|webp|ico)$/i.test(new URL(url).pathname);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase, fuentes, CDN

  if (esImagen(req.url)) {
    // Caché primero
    e.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        })
      )
    );
    return;
  }

  // Red primero, caché como respaldo sin conexión
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
