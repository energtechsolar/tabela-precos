// Eider Sistemas / CRM — link "💬 Conversas" (WhatsApp) no topo do CRM, com o número de mensagens não lidas.
// Só para admin e vendas internas (as mesmas pessoas que o banco deixa ver as conversas).
// Carregado pelo crm.html depois de js/crm.js: envolve renderHeader() sem mudar o crm.js.
(function () {
  if (typeof renderHeader !== 'function') return;
  let naoLidas = 0, ultimaBusca = 0;
  const pode = () => typeof perfil !== 'undefined' && perfil && (perfil.admin || perfil.papel === 'interno');
  async function contar() {
    if (!pode() || typeof sb === 'undefined' || !sb) return;
    ultimaBusca = Date.now();
    const { data, error } = await sb.from('whatsapp_conversas').select('nao_lidas').gt('nao_lidas', 0).limit(500);
    if (error) return;   // módulo desligado ou sem acesso: o link aparece sem número
    const n = (data || []).reduce((a, c) => a + (c.nao_lidas || 0), 0);
    if (n !== naoLidas) { naoLidas = n; renderHeader(); }
  }
  const _render = renderHeader;
  renderHeader = function () {
    const r = _render.apply(this, arguments);
    const el = document.getElementById('header-links');
    if (el && pode() && !el.querySelector('.link-conversas')) {
      const a = document.createElement('a');
      a.href = 'conversas.html'; a.className = 'link-conversas';
      a.textContent = '💬 Conversas' + (naoLidas ? ` (${naoLidas})` : '');
      const primeiro = el.querySelector('a'), ref = primeiro ? primeiro.nextSibling : null;   // logo depois do 1º link
      el.insertBefore(document.createTextNode(' · '), ref);
      el.insertBefore(a, ref);
    }
    if (pode() && Date.now() - ultimaBusca > 60000) contar();
    return r;
  };
  setInterval(() => { if (document.visibilityState === 'visible') contar(); }, 60000);
})();
