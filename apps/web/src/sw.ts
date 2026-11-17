/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// ADR-015: solo se precachea el *shell* (JS, CSS, fuentes, iconos e index.html) para
// arrancar rápido. Sin modo offline: no hay runtime caching, así que las respuestas de
// /api y /realtime nunca se guardan (van siempre a la red).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navegaciones de la SPA (/g/…/compra, /entrar…) → index.html del precache.
// /api y /realtime no son rutas de la SPA (el proxy de Vite las sirve en desarrollo).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api(\/|$)/, /^\/realtime(\/|$)/],
  }),
);

// "Actualizar" en el aviso de nueva versión: `updateSW(true)` envía SKIP_WAITING al
// service worker en espera, que toma el control y la página se recarga.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Los manejadores `push` y `notificationclick` llegan en HOG-600.
