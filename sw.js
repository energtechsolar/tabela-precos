// Energtech — funcionamento offline (PWA)
// Páginas: tenta a internet primeiro e guarda uma cópia; sem internet usa a cópia.
// Bibliotecas, fontes e fotos: usa a cópia guardada e atualiza em segundo plano.
// Dados do banco (Supabase) nunca passam por aqui, exceto as fotos públicas da proposta.
const VERSAO = 'energtech-20261022c';
const CASCA = ['./', 'index.html', 'crm.html', 'manifest.webmanifest',
  'css/precificador.css?v=20261019a', 'js/comum.js?v=20261019a', 'js/precificador.js?v=20261020b', 'js/logo.js?v=20261019a', 'js/pdf.js?v=20261020b', 'js/proposta.js?v=20261020c', 'js/admin.js?v=20261019a', 'js/app.js?v=20261020c', 'js/crm.js?v=20261022b', 'js/contrato.js?v=20261019a', 'icone-192.png', 'icone-512.png', 'apple-touch-icon.png', 'proposta-capa.jpg',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSAO).then(c => Promise.all(CASCA.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))));
  self.skipWaiting();
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function guardar(req, resp) {
  if (resp && (resp.ok || resp.type === 'opaque')) { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
  return resp;
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) {
    if (!url.pathname.includes('/storage/v1/object/public/')) return;      // dados: sempre online
    ev.respondWith(caches.match(req).then(c => c || fetch(req).then(r => guardar(req, r))));
    return;
  }
  if (url.hostname.includes('nominatim') || url.hostname.includes('wa.me')) return;
  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).then(r => guardar(req, r)).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(c => c || caches.match('index.html')).then(c => c || caches.match('./'))));
    return;
  }
  ev.respondWith(caches.match(req).then(c => {
    const rede = fetch(req).then(r => guardar(req, r)).catch(() => c);
    return c || rede;
  }));
});
