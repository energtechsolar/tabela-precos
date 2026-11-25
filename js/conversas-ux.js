// Eider Sistemas / CRM — tela Conversas: ajustes de uso (carregado pelo js/comum.js depois do script da tela).
// No celular: caixa de mensagem na largura toda (botões na linha de baixo) e topo amarelo compacto com a conversa aberta.
// Em todas: nome de quem enviou (cadastro da equipe) em vez do começo do e-mail.
// Celular/tablet (tela de toque): a tecla Enter do teclado só pula linha; a mensagem sai apenas no botão Enviar.
(function () {
  if (typeof renderChat !== 'function') return;
  const st = document.createElement('style');
  st.textContent = `
    .bolha .autor { font-size:11px; font-weight:600; }
    @media (max-width:760px) {
      .envio { flex-wrap:wrap; padding:8px; gap:6px; }
      .envio > textarea { order:-1; flex:1 1 100%; font-size:16px; min-height:44px; }
      .envio .btn-ico { width:42px; height:40px; }
      .envio #btn-enviar { margin-left:auto; padding:9px 24px; }
      body:has(.app.aberta) .header { padding:6px 12px; gap:6px; }
      body:has(.app.aberta) .brand-sub, body:has(.app.aberta) .header-title h1 { display:none; }
      body:has(.app.aberta) .brand-name { font-size:18px; }
      body:has(.app.aberta) .logo-icon { width:30px; height:30px; }
      body:has(.app.aberta) .logo-icon svg { width:18px; height:18px; }
      body:has(.app.aberta) .header-links { margin-top:0; }
      .chat-topo { padding:8px 10px; gap:6px; }
    }`;
  document.head.appendChild(st);

  let NOMES = null;   // começo do e-mail → primeiro nome
  sb.from('vendedores').select('email, nome').then(({ data }) => {
    NOMES = {};
    (data || []).forEach(v => { if (v.email && v.nome) NOMES[String(v.email).split('@')[0].toLowerCase()] = String(v.nome).trim().split(/\s+/)[0]; });
    if (typeof aberta !== 'undefined' && aberta) renderChat(false);
  });

  function ajustar() {
    if (NOMES) document.querySelectorAll('#msgs .bolha.saida .autor').forEach(el => {
      const n = NOMES[el.textContent.trim().toLowerCase()]; if (n) el.textContent = n;
    });
    const t = $('texto');
    if (t && !t.disabled && window.matchMedia('(max-width:760px)').matches) t.placeholder = 'Mensagem…';
    if (t && toque()) t.setAttribute('enterkeyhint', 'enter');   // teclado mostra a tecla de nova linha, não "enviar"
  }
  const toque = () => window.matchMedia('(pointer: coarse)').matches;
  // roda antes do Enter-envia da tela (fase de captura) e deixa o Enter só pular linha
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target && e.target.id === 'texto' && toque()) e.stopPropagation();
  }, true);

  const _chat = renderChat;
  renderChat = function () { _chat.apply(this, arguments); ajustar(); };
})();
