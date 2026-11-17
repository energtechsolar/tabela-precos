// Eider Sistemas / CRM — ajustes de exibição no CRM, sem mudar o crm.js.
// Orçamento simples (só placas, só inversor ou serviço) não tem potência: tira o " · 0 kWp" dos cards, da ficha e das listas.
(function () {
  const RE = / · 0 kWp/g;
  const limpar = raiz => {
    if (!raiz) return;
    if (raiz.nodeType === 3) { if (raiz.nodeValue.includes(' · 0 kWp')) raiz.nodeValue = raiz.nodeValue.replace(RE, ''); return; }
    if (raiz.nodeType !== 1 || !raiz.textContent.includes(' · 0 kWp')) return;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) if (n.nodeValue.includes(' · 0 kWp')) n.nodeValue = n.nodeValue.replace(RE, '');
  };
  const iniciar = () => {
    limpar(document.body);
    new MutationObserver(ms => ms.forEach(m => { m.addedNodes.forEach(limpar); if (m.type === 'characterData') limpar(m.target); }))
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
