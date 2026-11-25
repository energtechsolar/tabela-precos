// Energtech — código comum (precificador, CRM e painel)
// A chave abaixo é a "publishable" (pública por natureza). Quem pode ler/gravar é controlado no banco (RLS).
const SUPABASE_URL = 'https://cmrndntnaaooapbdmgip.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wKf3jP-0lmaK07vMpxdRlA_UXqMJdBO';
const sb = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// nome padrão dos arquivos: Tipo_Nome-do-Cliente_3,72kWp_AAAA-MM-DD_N01281.pdf
function nomeArquivoPadrao(tipo, nome, kwp, numero, quando) {
  const limpa = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().replace(/\s+/g, '-');
  const h = quando ? new Date(quando) : new Date(), data = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
  const pot = (Math.round((+kwp || 0) * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits:2 }) + 'kWp';
  const num = String(numero || '').startsWith('S') ? String(numero) : 'N' + String(numero || '').padStart(5, '0');
  return [tipo, limpa(nome).slice(0, 50) || 'Cliente', pot, data, num].join('_') + '.pdf';
}

// Fotos HEIC/HEIF (padrão do iPhone): o Chrome/Edge não abrem e a leitura por IA não aceita.
// paraJpeg(arquivo) converte para JPEG no próprio aparelho antes de enviar; outros arquivos passam como estão.
// Safari abre HEIC: converte pelo canvas. Nos outros navegadores baixa o conversor (heic-to, ~3 MB) só quando
// aparece uma foto HEIC. A página precisa de "worker-src 'self' blob:" no Content-Security-Policy ('self' é o modo offline).
const ehHeic = f => !!f && (/^image\/hei[cf]/i.test(f.type || '') || /\.(heic|heif)$/i.test(f.name || ''));
let _conversorHeic = null;
async function paraJpeg(f) {
  if (!ehHeic(f)) return f;
  const nome = String(f.name || 'foto').replace(/\.(heic|heif)$/i, '') + '.jpg';
  try {
    const b = await new Promise((ok, erro) => {
      const u = URL.createObjectURL(f), i = new Image();
      i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); URL.revokeObjectURL(u); c.toBlob(x => x ? ok(x) : erro(new Error('canvas')), 'image/jpeg', 0.9); };
      i.onerror = () => { URL.revokeObjectURL(u); erro(new Error('sem suporte')); };
      i.src = u;
    });
    return new File([b], nome, { type: 'image/jpeg' });
  } catch (e) { /* navegador sem HEIC: usa o conversor */ }
  if (!_conversorHeic) _conversorHeic = import('https://cdn.jsdelivr.net/npm/heic-to@1.6.7/dist/csp/heic-to.min.js')
    .catch(e => { _conversorHeic = null; console.error('conversor HEIC:', e); throw new Error('não foi possível carregar o conversor de fotos do iPhone (HEIC) — verifique a internet'); });
  const m = await _conversorHeic;
  let b;
  try { b = await m.heicTo({ blob: f, type: 'image/jpeg', quality: 0.9 }); }
  catch (e) { console.error('HEIC:', e); throw new Error('não foi possível converter a foto HEIC — no iPhone, mande como JPG (Ajustes › Câmera › Formatos › Mais compatível)'); }
  return new File([b], nome, { type: 'image/jpeg' });
}

// legibilidade e campos de mês (todas as telas)
// - botões pequenos: letra normal (a condensada em negrito pesado ficava borrada em tamanho pequeno)
// - color-scheme dark: ícone do calendário e listas aparecem claros no fundo escuro
// - clicar em qualquer ponto do campo de mês/data abre o calendário; o filtro de mês (f-mes) ganha ◀ ▶
(function () {
  const st = document.createElement('style');
  st.textContent = `
    :root { color-scheme: dark; }
    .btn.btn-p, .btn[style*="font-size:11px"], .btn[style*="font-size:12px"] { font-family:'Barlow',sans-serif; font-weight:700; font-size:13px !important; letter-spacing:0; }
    input[type=month], input[type=date] { cursor:pointer; }
    .mes-nav { display:inline-flex; align-items:center; gap:4px; vertical-align:middle; }
    .mes-nav button { background:var(--card2,#222); border:1px solid var(--borda,#2e2e2e); color:var(--texto,#e0e0e0); border-radius:8px; width:34px; height:36px; cursor:pointer; font-size:14px; }
    .mes-nav button:hover { border-color:var(--amarelo,#FFC107); }
    .papel-obras button[onclick^="kitPagoBanco"] { display:none !important; }`;
  document.head.appendChild(st);
  document.addEventListener('click', e => {
    const i = e.target;
    if (i && i.tagName === 'INPUT' && (i.type === 'month' || i.type === 'date') && !i.disabled && !i.readOnly && typeof i.showPicker === 'function') { try { i.showPicker(); } catch (_) { /* navegador sem suporte */ } }
  });
  const somarMes = (ym, n) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  document.addEventListener('DOMContentLoaded', () => {
    const i = document.getElementById('f-mes'); if (!i || i.closest('.mes-nav')) return;
    const nav = document.createElement('span'); nav.className = 'mes-nav'; i.parentNode.insertBefore(nav, i);
    const bt = (txt, n, dica) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = dica;
      b.onclick = ev => { ev.preventDefault(); const hoje = new Date(); const atual = /^\d{4}-\d{2}$/.test(i.value) ? i.value : hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
        i.value = somarMes(atual, n); i.dispatchEvent(new Event('change', { bubbles: true })); };
      return b; };
    nav.append(bt('◀', -1, 'Mês anterior'), i, bt('▶', 1, 'Próximo mês'));
  });
})();

// papel "obras" (agenda de obras, sem valores): nas telas Instalações e Clientes ele usa os mesmos botões da engenharia.
// O banco continua decidindo o que ele lê e grava (sem diárias, custos, estoque nem "kit pago"). O papel real fica em perfil.papel_real
// e a página ganha <html class="papel-obras"> (esconde o botão do kit pago).
(function () {
  const pg = location.pathname.split('/').pop();
  if (!sb || !['instalacoes.html', 'clientes.html'].includes(pg)) return;
  const rpc = sb.rpc.bind(sb);
  sb.rpc = function (fn, args, opts) {
    const q = rpc(fn, args, opts);
    if (fn !== 'meu_perfil') return q;
    return Promise.resolve(q).then(r => {
      if (r && r.data && r.data.papel === 'obras') { r.data.papel_real = 'obras'; r.data.papel = 'engenheiro'; document.documentElement.classList.add('papel-obras'); }
      return r;
    });
  };
})();

// barra de menu do topo, igual em todas as telas (js/menu-topo.js)
(function () { const s = document.createElement('script'); s.src = 'js/menu-topo.js?v=20261125d'; s.async = false; document.body.appendChild(s); })();

// complementos de algumas telas: carregados depois do script da própria tela (assim a tela grande não precisa mudar)
(function () {
  const EXTRAS = {
    'instalacoes.html': ['js/agenda-extra.js?v=20261118a', 'js/obras-dias.js?v=20261125d'],
    'equipe.html': ['js/equipe-dias.js?v=20261125d'],
    'financeiro.html': ['js/obra-resumo.js?v=20261118a'],
    'conversas.html': ['js/leo-conversas.js?v=20261118a', 'js/conversas-ux.js?v=20261125b'],
    'crm.html': ['js/contrato-v2.js?v=20261124a'],
    'index.html': ['js/weg-kit.js?v=20261125f', 'js/weg-admin.js?v=20261125h', 'js/weg-proposta.js?v=20261125i'],
  };
  const lista = EXTRAS[location.pathname.split('/').pop() || 'index.html'];
  if (!lista) return;
  document.addEventListener('DOMContentLoaded', () => lista.forEach(src => {
    const s = document.createElement('script'); s.src = src; s.async = false; document.body.appendChild(s);
  }));
})();
