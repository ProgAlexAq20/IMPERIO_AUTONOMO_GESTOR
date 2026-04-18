/* ============================================================
   SERVICE WORKER — Império Autônomo PWA
   Versão: v4-google-auth
   
   ESTRATÉGIA:
   - App Shell (HTML/CSS/JS/ícones) → Cache First
   - Firebase / CDN externas → Network First (sem cache)
   - Google Auth redirect → sempre Network (nunca cachear)
   ============================================================ */

const CACHE_NAME = 'imperio-v4';
const BASE       = '/IMPERIO_AUTONOMO_GESTOR/';

/* Recursos do App Shell que serão cacheados na instalação */
const SHELL_FILES = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

/* Domínios que NUNCA devem ser interceptados/cacheados.
   Firebase Auth usa redirects e tokens sensíveis ao tempo. */
const NEVER_CACHE = [
  'firebaseapp.com',
  'googleapis.com',
  'gstatic.com',
  'accounts.google.com',
  'securetoken.google.com',
  'identitytoolkit.googleapis.com',
  'firestore.googleapis.com'
];

/* ── INSTALL: pré-cacheia o App Shell ── */
self.addEventListener('install', event => {
  console.log('[SW] Instalando', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando App Shell');
        return cache.addAll(SHELL_FILES);
      })
      .then(() => self.skipWaiting()) // Ativa imediatamente sem esperar fechar abas
  );
});

/* ── ACTIVATE: limpa caches antigos ── */
self.addEventListener('activate', event => {
  console.log('[SW] Ativando', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // Assume controle imediato de todas as abas
  );
});

/* ── FETCH: intercepta requisições ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* 1. Nunca interceptar Firebase/Google — sempre network direto */
  if (NEVER_CACHE.some(domain => url.hostname.includes(domain))) {
    return; // deixa o browser resolver normalmente
  }

  /* 2. Navegação (HTML) → Network First, fallback para cache */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          /* Atualiza o cache com a versão mais recente do HTML */
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => {
          /* Offline → retorna HTML cacheado */
          console.log('[SW] Offline — retornando index.html do cache');
          return caches.match(BASE + 'index.html');
        })
    );
    return;
  }

  /* 3. Recursos estáticos do App Shell → Cache First */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      /* Não está no cache: busca na rede e cacheia */
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      }).catch(() => {
        /* Recurso não disponível offline — retorna vazio sem travar */
        console.warn('[SW] Recurso indisponível offline:', event.request.url);
      });
    })
  );
});

/* ── MESSAGE: força atualização via postMessage ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
