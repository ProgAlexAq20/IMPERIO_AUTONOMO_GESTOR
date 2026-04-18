/* ============================================================
   SERVICE WORKER — Império Autônomo PWA v5
   ============================================================
   ESTRATÉGIA:
   - App Shell (HTML/CSS/JS/ícones) → Cache First
   - Firebase / CDN externas       → Network First (sem cache)
   - Google Auth redirect          → sempre Network
   - Notificações Push             → suportadas via push event
   ============================================================ */

const CACHE_NAME = 'imperio-v5';
const BASE       = '/IMPERIO_AUTONOMO_GESTOR/';

const SHELL_FILES = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

const NEVER_CACHE = [
  'firebaseapp.com','googleapis.com','gstatic.com',
  'accounts.google.com','securetoken.google.com',
  'identitytoolkit.googleapis.com','firestore.googleapis.com',
  'generativelanguage.googleapis.com'
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  console.log('[SW v5] Instalando', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES).catch(e => console.warn('[SW] Shell parcial:', e)))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', event => {
  console.log('[SW v5] Ativando', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (NEVER_CACHE.some(d => url.hostname.includes(d))) return;
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(r => { caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone())); return r; })
        .catch(() => caches.match(BASE + 'index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const net = fetch(event.request).then(r => {
        if (r && r.status === 200 && r.type !== 'opaque')
          caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

/* ── PUSH ── */
self.addEventListener('push', event => {
  let data = { title: 'Império Autônomo', body: 'Nova notificação financeira.' };
  try { data = event.data?.json() || data; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: BASE + 'icon-192.png',
      badge: BASE + 'icon-192.png', vibrate: [200, 100, 200],
      data: data.url || BASE,
      actions: [{ action: 'open', title: '📊 Abrir painel' }, { action: 'dismiss', title: 'Dispensar' }]
    })
  );
});

/* ── NOTIFICATION CLICK ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const found = list.find(c => c.url.includes(BASE) && 'focus' in c);
      return found ? found.focus() : clients.openWindow(event.notification.data || BASE);
    })
  );
});

/* ── MESSAGE ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body, icon: BASE + 'icon-192.png', vibrate: [150, 80, 150]
    });
  }
});
