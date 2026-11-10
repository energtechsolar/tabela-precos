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
