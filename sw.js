// AML 인사이트 서비스 워커: 앱 설치를 가능하게 하고, 인터넷이 끊겼을 때 마지막으로 본 화면을 보여 줘요.
// 항상 네트워크를 먼저 쓰고(새 기사·규정이 바로 보이게), 실패할 때만 저장해 둔 사본을 써요.
const CACHE = 'aml-v1';
const CORE = ['/', '/index.html', '/platform.js', '/pwa.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/fonts/P-4Regular.woff2', '/fonts/P-6SemiBold.woff2', '/fonts/P-8ExtraBold.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(res => {
      const home = r.mode === 'navigate' && (u.pathname === '/' || u.pathname === '/index.html');
      if (r.mode === 'navigate' && !home) return res;
      if (res.ok && (home ||u.pathname.startsWith('/fonts/') || u.pathname.startsWith('/data/') || CORE.includes(u.pathname))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(r.mode === 'navigate' ? '/' : r, copy));
      }
      return res;
    }).catch(() => caches.match(r.mode === 'navigate' ? '/' : r).then(m => m || caches.match('/')))
  );
});
