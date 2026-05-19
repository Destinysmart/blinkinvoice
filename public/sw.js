// BlinkInvoice service worker
const CACHE = 'blinkinvoice-v1';
const APP_SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(APP_SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const STATIC_DESTS = new Set(['style', 'script', 'font', 'image', 'worker']);

function isNetworkOnly(url) {
  return (
    url.hostname.endsWith('supabase.co') ||
    url.hostname === 'api.blink.sv' ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/realtime/')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache backend / realtime / auth
  if (isNetworkOnly(url)) return;

  // App shell: network-first for HTML navigations, fall back to cached shell
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(APP_SHELL, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match(APP_SHELL);
        return cached || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache-first
  if (STATIC_DESTS.has(req.destination)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok && url.origin === self.location.origin) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
  }
});
