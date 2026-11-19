/* Minimal service worker for the HR Scanner app (scope: /scanner).
   It only makes the app installable; it does not cache API data, so
   attendance is always recorded live on the server. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* network only – let the browser handle every request normally */
});
