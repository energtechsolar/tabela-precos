// Energtech — links dos módulos extras no menu do topo (#header-links), conforme o acesso de quem está logado.
// O banco decide (RLS): só aparece o link se a pessoa consegue ler o módulo. Hoje: ☀️ Usinas (só o admin, módulo ativo).
// Carregar depois de js/comum.js. Não muda nada da página: só acrescenta o link quando o menu é (re)desenhado.
(function () {
  const MODULOS = [
    { id: 'usinas', href: 'usinas.html', rotulo: '☀️ Usinas', tem: async () => { const r = await sb.from('usinas').select('id').limit(1); return !r.error && (r.data || []).length > 0; } },
  ];
  const acesso = {};   // cache por sessão de página
  let emAndamento = false;
  async function aplicar() {
    if (typeof sb === 'undefined' || !sb || emAndamento) return;
    const el = document.getElementById('header-links'); if (!el) return;
    emAndamento = true;
    try {
      const { data } = await sb.auth.getSession();
      if (!data || !data.session) return;
      for (const m of MODULOS) {
        if (el.querySelector('[data-mod="' + m.id + '"]') || location.pathname.endsWith('/' + m.href)) continue;
        if (acesso[m.id] === undefined) acesso[m.id] = await m.tem().catch(() => false);
        if (!acesso[m.id]) continue;
        const a = document.createElement('a'); a.href = m.href; a.dataset.mod = m.id; a.textContent = m.rotulo;
        // entra antes do "👤 nome" (ou no fim, se não houver)
        const alvo = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('👤'));
        if (alvo) { const i = alvo.textContent.indexOf('👤'); const depois = alvo.splitText(i); el.insertBefore(a, depois); el.insertBefore(document.createTextNode(' · '), depois); }
        else { el.appendChild(document.createTextNode(' · ')); el.appendChild(a); }
      }
    } finally { emAndamento = false; }
  }
  function iniciar() {
    const el = document.getElementById('header-links'); if (!el) return;
    new MutationObserver(() => { if (!el.querySelector('[data-mod]')) setTimeout(aplicar, 50); }).observe(el, { childList: true });
    if (typeof sb !== 'undefined' && sb) sb.auth.onAuthStateChange(() => setTimeout(aplicar, 300));
    setTimeout(aplicar, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
