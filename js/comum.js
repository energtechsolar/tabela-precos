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
